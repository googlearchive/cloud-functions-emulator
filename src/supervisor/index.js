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

require('colors');

const _ = require('lodash');
const bodyParser = require('body-parser');
const express = require('express');
const fork = require('child_process').fork;
const http = require('http');
const path = require('path');
const uuid = require('uuid');

const errors = require('../utils/errors');
const Model = require('../model');
const OPTIONS = require('../options');
const worker = require('./worker');

const { CloudFunction } = Model;

class Supervisor {
  constructor (functions, opts) {
    this.functions = functions;
    this.config = _.cloneDeep(opts);

    this.server = express();
    this.server.use(bodyParser.json());
    this.server.use(bodyParser.raw());
    this.server.use(bodyParser.text());
    this.server.use(bodyParser.urlencoded({
      extended: true
    }));

    // Never cache
    this.server.use((req, res, next) => {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', 0);
      next();
    });

    this.server.all('/:project/:location/:name', (req, res, next) => this.handleRequest(req, res).catch(next));

    this.server.all('*', (req, res, next) => {
      res.status(404).end();
    });

    // Define error handlers last
    this.server.use((err, req, res, next) => {
      // Check for a serialized error and deserialize it if necessary
      if (!(err instanceof Error) && err.name && err.stack && err.message) {
        const _err = err;
        err = new Error(_err.message);
        err.stack = _err.stack;
      }

      // TODO: Extract most of this error handling/formatting into a utility
      if (err instanceof Error) {
        res.status(500).send(err.stack).end();
      } else if (typeof err === 'object') {
        if (err.code) {
          if (err.code === errors.status.FAILED_PRECONDITION) {
            res.status(400).json({
              error: {
                code: 400,
                status: 'FAILED_PRECONDITION',
                message: err.message || http.STATUS_CODES['400'],
                errors: [err.message || http.STATUS_CODES['400']]
              }
            }).end();
          } else if (err.code === errors.status.NOT_FOUND) {
            res.status(404).json({
              error: {
                code: 404,
                status: 'NOT_FOUND',
                message: err.message || http.STATUS_CODES['404'],
                errors: [err.message || http.STATUS_CODES['404']]
              }
            }).end();
          } else {
            res.status(500).json({
              error: {
                code: 500,
                status: 'INTERNAL',
                message: err.message || http.STATUS_CODES['500'],
                errors: [err.message || http.STATUS_CODES['500']]
              }
            }).end();
          }
        } else {
          res.status(500).end();
        }
      } else if (err) {
        res.status(500).end();
      } else {
        res.status(404).end();
      }
    });
  }

  handleRequest (req, res) {
    return Promise.resolve()
      .then(() => this.functions.getFunction(CloudFunction.formatName(req.params.project, req.params.location, req.params.name)))
      .then((cloudfunction) => {
        const context = {
          method: req.method,
          headers: req.headers,
          url: req.url,
          originalUrl: req.originalUrl
        };
        return this.invoke(cloudfunction, req.body || {}, context);
      })
      .then((response) => {
        const result = response.result;
        if (result.statusCode) {
          res.status(result.statusCode);
        }
        if (result.headers) {
          for (let key in result.headers) {
            res.set(key, result.headers[key]);
          }
        }
        if (result.body) {
          res.send(result.body);
        }
        res.end();
      });
  }

  /**
   * Invokes a function.
   */
  invoke (cloudfunction, data, context = {}, opts = {}) {
    if (this.config.isolation === 'inprocess') {
      return this.invokeInline(cloudfunction, data, context, opts);
    } else if (this.config.isolation === 'childprocess') {
      return this.invokeSecure(cloudfunction, data, context, opts);
    } else {
      throw new Error(`Isolation model "${this.config.isolation}" not supported!`);
    }
  }

  /**
   * Executes a function in this process.
   *
   * @param {object} cloudfunction The cloudfunction to invoke.
   * @param {object} data The data to pass to the function.
   * @param {object} context Request context.
   * @param {object} opts Configuration options.
   * @returns {Promise}
   */
  invokeInline (cloudfunction, data, context = {}, opts = {}) {
    return new Promise((resolve, reject) => {
      worker(cloudfunction, data, context, opts, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Executes a function in a child process.
   *
   * @param {object} cloudfunction The cloudfunction to invoke.
   * @param {object} data The data to pass to the function.
   * @param {object} context Request context.
   * @param {object} opts Configuration options.
   * @returns {Promise}
   */
  invokeSecure (cloudfunction, data, context = {}, opts = {}) {
    return new Promise((resolve, reject) => {
      context.originalUrl = `/${this.config.projectId}/${this.config.region}/${cloudfunction.shortName}`;
      context.headers = {};

      // Prepare an execution event
      const event = {
        // A unique identifier for this execution
        eventId: uuid.v4(),
        // The current ISO 8601 timestamp
        timestamp: (new Date()).toISOString(),
        // TODO: The event type
        eventType: 'TODO',
        // TODO: The resource that triggered the event
        resource: 'TODO',
        // The event payload
        data
      };

      // This is the information the worker needs to execute the function
      const args = [
        // The short name of the function
        cloudfunction.shortName,
        // The remaining function metadata
        JSON.stringify(cloudfunction),
        // The request context
        JSON.stringify(context),
        // The request data
        JSON.stringify(event)
      ];

      let execArgv = [];

      if (this.config.inspect) {
        execArgv = [`--inspect=${this.config.inspectPort}`, '--debug-brk'];
      } else if (this.config.debug) {
        execArgv = [`--debug=${this.config.debugPort}`, '--debug-brk'];
      }

      // Spawn a child process in which to execute the user's function
      // TODO: Warn when the Supervisor process ends but a child process is
      // still running
      const worker = fork(path.join(__dirname, 'worker.js'), args, {
        // Execute the process in the context of the user's code
        cwd: cloudfunction.localPath,
        // Emulate the environment variables of the production service
        env: _.merge({}, process.env, {
          FUNCTION_NAME: cloudfunction.shortName,
          GCLOUD_PROJECT: this.config.projectId
        }),
        // Optionally prepare to debug the child process
        execArgv,
        // Allow stdin, stdout, and stderr to be piped to the parent so we can
        // capture the user's logs
        silent: true
      });

      // Anything the user logs will be logged at the Debug level
      worker.stdout.on('data', (chunk) => {
        console.log(chunk.toString('utf8'));
      });

      // Any errors logged by the user will be logged at the Error level
      worker.stderr.on('data', (chunk) => {
        console.error(chunk.toString('utf8'));
      });

      // Variables to hold the final result or error of the execution
      let result, error;

      // Listen for success and error messages from the worker
      worker.on('message', (message) => {
        if (message.result) {
          result = message.result;
        } else if (message.error) {
          error = message.error;
        }
      });

      // Finally, wait for the child process to shutdown
      worker.on('close', (code) => {
        if (code) {
          resolve({ executionId: event.eventId, error });
        } else {
          resolve({ executionId: event.eventId, result });
        }
      });
    });
  }

  start () {
    console.debug(`Starting supervisor at ${this.config.host}:${this.config.port}...`);
    this._server = this.server.listen(this.config.port, this.config.host, () => {
      console.debug(`Supervisor listening at ${this._server.address().address}:${this._server.address().port}.`);
    });
  }

  stop () {
    console.debug(`Stopping supervisor...`);
    this._server.close(() => {
      console.debug('Supervisor stopped.');
    });
  }
}

exports.Supervisor = Supervisor;
exports.supervisor = (...args) => new Supervisor(...args);

const COMMAND = `./bin/supervisor ${'[options]'.yellow}`;
const DESCRIPTION = `The Google Cloud Functions Emulator Supervisor service. The service is responsible for invoking functions.

  You can let run Emulator run the Supervisor process, or you can start the Supervisor service separately.`;
const USAGE = `Usage:
  In the cloud-functions-emulator directory run the following:

    ${COMMAND.bold}

  Or from any directory run the following:

    ${('/path/to/cloud-functions-emulator/bin/supervisor ' + '[options]'.yellow).bold}

Description:
  ${DESCRIPTION}`;

exports.main = (args) => {
  const cli = require('yargs');

  const opts = cli
    .usage(USAGE)
    .options(_.merge(_.pick(OPTIONS, ['debug', 'debugPort', 'inspect', 'inspectPort', 'isolation', 'logFile', 'projectId', 'region', 'storage', 'useMocks']), {
      host: _.cloneDeep(OPTIONS.supervisorHost),
      port: _.cloneDeep(OPTIONS.supervisorPort)
    }))
    .wrap(120)
    .help()
    .version()
    .strict()
    .argv;

  const supervisor = new Supervisor(opts);

  supervisor.start();
};
