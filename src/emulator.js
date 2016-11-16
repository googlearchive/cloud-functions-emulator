/**
 * Copyright 2016, Google, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License")
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const responseTime = require('response-time');
const path = require('path');
const jsonfile = require('jsonfile');
const fs = require('fs');
const winston = require('winston');
const config = require('../config');
const invoker = require('./invoker');
const loadHandler = require('./loadhandler');
const logs = require('./logs');

var self = {
  _log: null,
  _app: null,
  _server: null,
  _functions: null,
  _functionsFile: null,

  _init: function () {
    // Add a global error handler to catch all unexpected exceptions in the process
    // Note that this will not include any unexpected system errors (syscall failures)
    process.on('uncaughtException', function (err) {
      console.error(err.stack);

      // HACK:  An uncaught exception may leave the process in an incomplete state
      // however exiting the process prematurely may result in the above log call
      // to not complete.  This we're just going to wait for an arbitrary amount
      // of time for the log entry to complete.
      // Possible future solution here: https://github.com/winstonjs/winston/issues/228
      setTimeout(function () {
        process.exit(1);
      }, 1000);
    });

    // Setup the winston logger.  We're going to write to a file which will
    // automatically roll when it exceeds ~1MB.

    var logsDir = logs.assertLogsPath();
    var logLevel = 'info';

    if (config.verbose === true) {
      logLevel = 'debug';
    }

    self._log = new winston.Logger({
      transports: [
        new winston.transports.File({
          json: false,
          filename: path.resolve(logsDir, config.logFileName),
          maxsize: 1048576,
          level: logLevel
        })
      ],
      exitOnError: false
    });

    // Override default console log calls to redirect them to winston.
    // This is required because when the server is run as a spawned process
    // from the CLI, stdout and stderr will be written to /dev/null.  In order
    // to capture logs emitted from user functions we need to globally redirect
    // console logs for this process.  Note that this will also redirect logs
    // from the emulator itself, so all emulator logs should be written at the
    // DEBUG level.  We've made an exception for error logs in the emulator, just
    // to make it easier for developers to recognize failures in the emulator.

    console.log = function () {
      self._log.info.apply(self._log, arguments);
    };

    console.info = console.log;

    console.error = function () {
      self._log.error.apply(self._log, arguments);
    };
    console.debug = function () {
      self._log.debug.apply(self._log, arguments);
    };

    // Set the project ID to be used
    config.projectId = process.argv[3] || config.projectId;
    process.env['GCLOUD_PROJECT'] = config.projectId;
    process.env['GCP_PROJECT'] = config.projectId;

    if (config.projectId) {
      console.debug('Set project ID to ' + config.projectId);
    }

    // The functions file is a registry of deployed functions.  We want
    // function deployments to survive emulator restarts.
    var rootDir = path.resolve(__dirname, '../');
    self._functionsFile = path.resolve(rootDir, 'functions.json');

    // Ensure the function registry file exists
    if (!self._pathExists(self._functionsFile)) {
      jsonfile.writeFileSync(self._functionsFile, {});
    }

    // Create or read the current registry file
    self._functions = jsonfile.readFileSync(self._functionsFile);

    // Create Express App
    self._setupApp();

    // Override Module._load to we can inject mocks into calls to require()
    if (config.useMocks) {
      try {
        var override = require('../mocks');
        if (override) {
          loadHandler.init(override);
          console.debug('Mock handler found.  Require calls will be intercepted');
        }
      } catch (e) {
        console.error('Mocks enabled but no mock handler found.  Require calls will NOT be intercepted');
      }
    }
  },

  _setupApp: function () {
    // Standard ExpressJS app.  Where possible this should mimic the *actual*
    // setup of Cloud Functions regarding the use of body parsers etc.
    self._app = express();
    self._app.use(bodyParser.json());
    self._app.use(bodyParser.raw());
    self._app.use(bodyParser.text());
    self._app.use(bodyParser.urlencoded({
      extended: true
    }));

    // Never cache
    self._app.use(function (err, req, res, next) {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', 0);
      next(err);
    });

    // responseTime will allow us to track the execution time of a function
    self._app.use(responseTime());

    // Define error handlers last
    self._app.use(self._errorHandler);

    // Not really anything we need to do here, but responding to a browser GET
    // seems reasonable in case the developer wonders what's hogging their port
    // All internal emulator capabilities will be registered under the /function
    // path.  This should be safe because it would not be possible to deploy a
    // function with that name if we assume that all function names in the
    // emulator are *actual* function names from the module
    self._app.get('/', function (req, res) {
      if (req.query.env) {
        res.set('Content-type', 'application/json');
        res.send({
          projectId: config.projectId,
          debug: process.env.DEBUG
        });
      } else {
        res.send('Cloud Functions Emulator RUNNING');
      }
    });

    // Use a DELETE to signal the shutdown of the emulator.  The process will
    // ultimately be "spawned" from the CLI so the channel to the parent process
    // will be lost
    self._app.delete('/', function (req, res) {
      console.debug('Server stopped');
      res.status(200).end();
      self._server.close();
    });

    /**
     * Deploys a function to the emulator
     * `functions deploy [options] <module> <function>`
     *
     * @example
     * functions deploy --type H ../myfunctions helloWorld
     *
     * @param {String} type (Optional)  The type of the function.  One of HTTP (H) or BACKGROUND (B).  Default is BACKGROUND
     * @param {String} module  A path on the local file system containing the Node module to deploy
     * @param {String} function  The function (entry point) to be invoked
     */
    self._app.post('/function/:name', function (req, res) {
      var p = req.query.path;
      var name = req.params.name;

      console.debug('Loading module in path ' + p);
      var mod = null;

      try {
        // Make sure we remove the module from cache first to capture any changes
        self._unrequire(p);
        mod = require(p);
      } catch (err) {
        console.error(err);

        res.status(400).send(
          '\nFailed to require module being deployed.  Make sure your module compiles and you have run `npm install` on it first\n' +
          err.stack);
        return;
      }

      if (!mod[name]) {
        res.status(404).send('\nNo function found in module ' + p +
          ' with name ' + name);
        return;
      }

      var type = req.query.type.toUpperCase();
      var url = null;

      if (type === 'B') {
        type = 'BACKGROUND';
      } else if (type === 'H') {
        type = 'HTTP';
      }

      if (type === 'HTTP') {
        url = 'http://localhost:' + config.port + '/' + name;
      }

      try {
        self._functions[name] = {
          name: name,
          path: p,
          type: type,
          url: url
        };

        jsonfile.writeFileSync(self._functionsFile, self._functions);

        console.debug('Deployed function ' + name + ' at path ' + p);

        res.json(self._functions[name]);
      } catch (err) {
        console.debug(err.stack);
        res.status(400).send(err.message);
      }
    });

    /**
     * Shuts down the emulator
     *
     * @example
     * functions stop
     */
    self._app.delete('/function', function (req, res) {
      self._functions = {};
      jsonfile.writeFileSync(self._functionsFile, self._functions);
      console.debug('Cleared all deployed functions');
      res.status(200).end();
    });

    /**
     * Undeploys a function to the emulator
     * `functions undeploy <function>`
     *
     * @example
     * functions undeploy helloWorld
     *
     * @param {String} function  The function to be removed
     */
    self._app.delete('/function/:name', function (req, res) {
      // undeploy
      delete self._functions[req.params.name];
      jsonfile.writeFileSync(self._functionsFile, self._functions);
      console.debug('Undeployed function ' + req.params.name);
      res.status(200).end();
    });

    /**
     * Prunes any orphaned functions.  These are functions known to the emulator
     * but which no longer exist in their corresponding module
     *
     * @example
     * functions stop
     */
    self._app.patch('/function', function (req, res) {
      var pruned = 0;
      var funcs = self._functions;

      for (var name in funcs) {
        var func;
        var fn = self._functions[name];

        // Ensure the function still exists on the file system
        if (self._pathExists(fn.path)) {
          // Ensure we aren't cached
          self._unrequire(fn.path);

          // Require the target module to load the function for invocation
          func = require(fn.path)[name];
        }

        if (!func) {
          delete self._functions[name];
          pruned++;
        }
      }

      jsonfile.writeFileSync(self._functionsFile, self._functions);

      console.debug('Pruned ' + pruned + ' orphaned functions');
      res.status(200).send(pruned.toString());
    });

    /**
     * Lists all deployed functions
     *
     * @example
     * functions list
     */
    self._app.get('/function', function (req, res) {
      res.json(self._functions);
    });

    /**
     * Gets the details of a single function
     * `functions describe <function>`
     *
     * @example
     * functions describe helloWorld
     *
     * @param {String} function  The function to be described
     */
    self._app.get('/function/:name', function (req, res) {
      var name = req.params.name;
      if (self._functions[name]) {
        res.json(self._functions[name]);
        return;
      }
      res.sendStatus(404);
    });

    /**
     * Calls a function.
     * Main entry point for all function invocations.  The path will be the
     * function name.  In the case of HTTP functions the request/response from
     * the original request will be passed through.  In the case of BACKGROUND
     * functions the POST body will be extracted from this request and sent to
     * the target function as the `data` argument
     *
     * @example
     * functions call helloWorld --data '{"message": "Hello World!"}'
     *
     * @param {String} data (Optional)  The data to be sent to the function, as a JSON object
     * @param {String} function  The function to be described
     */
    self._app.all('/*', function (req, res) {
      var fn = req.path.substring(1, req.path.length);

      console.debug('Executing ' + req.method + ' on function ' + fn);

      var func = self._functions[fn];

      if (func) {
        self._invoke(func, req, res);
      } else {
        res.status(404).send('No function with name ' + fn);
      }
    });
  },

  /**
   * Removes a previously required module from the require cache
   * @param {String} path The file system path to the module
   */
  _unrequire: function (path) {
    delete require.cache[require.resolve(path)];
  },

  _invoke: function (fn, req, res) {
    // Ensure the module is not loaded from cache
    // This has obvious negative performance implications, with the
    // benefit of allowing function code to be changed out of band
    // without needing re-deployment
    self._unrequire(fn.path);

    // Require the target module to load the function for invocation
    var mod = require(fn.path);

    var func = mod[fn.name];
    var type = fn.type;

    if (!func) {
      res.status(500).send('No function found with name ' + fn.name);
      return;
    }

    var cwd = process.cwd();

    try {
      // Set the working directory to the target module path
      // TODO:  This is sub-optimal, but the alternative is to
      // fork a new process with a separate HTTP server and pipe the req/res
      // from the master process.  In the context of an 'emulator", this is
      // probably a reasonable trade-off.  It has the side effect of having
      // unexpected behavior in concurrent function invocation scenarios
      process.chdir(fn.path);

      // Set the environment variables for this execution
      // As per the comment above, this is sub-optimal but probably an
      // acceptable trade-off for an emulator
      process.env['FUNCTION_NAME'] = fn.name;

      var serializeError = function (val) {
        return JSON.parse(JSON.stringify(val, Object.getOwnPropertyNames(val)));
      };

      if (type === 'HTTP') {
        // Pass through HTTP
        try {
          invoker.invoke(func, mod, req, res);
        } catch (err) {
          var error = err;
          if (error instanceof Error) {
            // Error objects serialize to an empty JSON object.. how convenient :/
            error = serializeError(error);
          }
          res.status(500).json(error);
        }

        // Change the working directory back to the original
        process.chdir(cwd);
      } else {
        // BACKGROUND
        var errback = function (err, val) {
          process.chdir(cwd);
          if (err) {
            if (err instanceof Error) {
              // Error objects serialize to an empty JSON object.. how convenient :/
              err = serializeError(err);
            }
            res.status(500).json(err);
          } else {
            res.status(200).json(val);
          }
        };

        try {
          // Function arguments will be of length 1 if we expected a promise
          if (func.length === 1) {
            Promise.resolve()
              .then(function () {
                var result = invoker.invoke(func, mod, req.body);
                if (typeof result === 'undefined') {
                  console.debug(
                    'Function returned undefined, expected Promise or value');
                }
                return result;
              })
              .then(
                function (result) {
                  errback(null, result);
                },
                function (err) {
                  errback(err);
                });
          } else {
            invoker.invoke(func, mod, req.body, errback);
          }
        } catch (e) {
          errback(e);
        }
      }
    } catch (err) {
      console.error(err.stack);
      res.status(500).send(err.stack);
    }
  },

  _errorHandler: function (err, req, res, next) {
    console.error(err.stack);
    res.status(500).send(err.stack);
    next(err);
  },

  _pathExists: function (p) {
    try {
      fs.statSync(p);
      return true;
    } catch (e) {
      if (e.code === 'ENOENT') {
        return false;
      } else {
        throw e;
      }
    }
  },

  main: function () {
    self._init();
    console.debug('Starting emulator server on port ' + config.port +
      '...');
    self._server = self._app.listen(config.port, function () {
      console.debug('Server started');
    });
  }
};

module.exports = self;

self.main();
