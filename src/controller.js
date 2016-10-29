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

const TIMEOUT_POLL_INCREMENT = 500;
const request = require('request');
const path = require('path');
const net = require('net');
const spawn = require('child_process').spawn;
const config = require('../config.js');
const logs = require('./logs.js');
const fs = require('fs');
const PID_PATH = path.join(__dirname, 'process.pid');
const EMULATOR_ROOT_URI = 'http://localhost:' + config.port;
const EMULATOR_FUNC_URI = EMULATOR_ROOT_URI + '/function/';

var self = {
  STOPPED: 0,
  RUNNING: 1,
  ALREADY_RUNNING: 2,
  KILLED: 3,

  /**
   * Starts the emulator process
   *
   * @param {String} projectId The Cloud Platform project ID to bind to this emulator instance
   * @param {boolean} debug If true, start the spawned node process with --debug
   * @param {boolean} inspect If true, start the spawned node process with --inspect
   * @param {Function} callback The callback function to be called upon success/failure
   */
  start: function (projectId, debug, inspect, callback) {
    // Project ID is optional, but any function that needs to authenticate to
    // a Google API will require a valid project ID
    // The authentication against the project is handled by the gcloud-node
    // module which leverages the Cloud SDK (gcloud) as the authentication basis.
    if (!projectId) {
      projectId = config.projectId;
    }

    // Check the status of the emulator and only start if we are not already
    // running
    self._checkStatus(config.port, function (err) {
      if (err) {
        // Starting the emulator amounts to spawning a child node process.
        // The child process will be detached so we don't hold an open socket
        // in the console. The detached process runs an HTTP server (ExpressJS).
        // Communication to the detached process is then done via HTTP
        var args = [path.join(__dirname, '/emulator.js'), config.port, projectId];

        // We will pipe stdout from the child process to the emulator log file
        var logFilePath = path.resolve(logs.assertLogsPath(), config.logFileName);

        // TODO:
        // For some bizzare reason boolean values in the environment of the
        // child process return as Strings in JSON documents sent over HTTP with
        // a content-type of application/json, so we need to check for String
        // 'true' as well as boolean.
        if (inspect === true || inspect === 'true') {
          var semver = process.version.split('.');
          var major = parseInt(semver[0].substring(1, semver[0].length));
          if (major >= 6) {
            args.unshift('--inspect');
            console.log('Starting in inspect mode.  Check ' + logFilePath + ' for details on how to connect to the chrome debugger');
          } else {
            console.error('--inspect flag requires Node 6+');
          }
        } else if (debug === true || debug === 'true') {
          if (config.debugPort) {
            args.unshift('--debug=' + config.debugPort);
          } else {
            args.unshift('--debug');
          }
          console.log('Starting in debug mode.  Debugger listening on port ' + ((config.debugPort) ? config.debugPort : 5858));
        }

        // Pass the debug flag to the environment of the child process so we can
        // query it later.  This is used during restart operations where we don't
        // want the user to have to remember all the startup arguments
        // TODO: This will become unwieldy if we add more startup arguments
        var env = process.env;
        env.DEBUG = debug;
        env.INSPECT = inspect;

        // Make sure the child is detached, otherwise it will be bound to the
        // lifecycle of the parent process.  This means we should also ignore
        // the binding of stdout.
        const out = fs.openSync(logFilePath, 'a');
        var child = spawn('node', args, {
          detached: true,
          stdio: ['ignore', out, out],
          env: env
        });

        // Write the pid to the file system in case we need to kill it later
        // This can be done by the user in the 'kill' command
        self._writePID(child.pid);

        // Ensure the parent doesn't wait for the child to exit
        // This should be used in combination with the 'detached' property
        // of the spawn() options.  The node documentation is unclear about
        // the behavior of detached & unref on different platforms.  'detached'
        // on Windows seems to do the same thing as unref() on non-Windows
        // platforms.  Doing both seems like the safest approach.
        // TODO: Test on Windows
        child.unref();

        // Ensure the service has started before we notify the caller.
        self._waitForStart(config.port, config.timeout, function (err) {
          if (err) {
            if (callback) {
              callback(err);
            }
            return;
          }
          if (callback) {
            // Started
            callback(null, self.RUNNING);
          }
        });
      } else {
        if (callback) {
          // Already running
          callback(null, self.ALREADY_RUNNING);
        }
      }
    });
  },

  /**
   * Stops the emulator process
   *
   * @param {Function} callback The callback function to be called upon success/failure
   */
  stop: function (callback) {
    // The service will respond to an HTTP DELETE as a signal to stop
    // NOTE: we could have sent a SIGTERM to the PID and handled appropriately
    // in the child process, but keeping the protocol consistent across all
    // management operations seems cleaner.
    self._action('DELETE', EMULATOR_ROOT_URI,
      function (error, response, body) {
        if (!error && response.statusCode === 200) {
          // The server indicated a willingness to stop, but it's stopping
          // 'gracefully' so we want to wait to make sure it exits cleanly
          self._waitForStop(config.port, config.timeout, function (err) {
            if (err) {
              callback(err);

              // If stop failed the local PID file should NOT be deleted
              // to ensure we can 'kill' the process if needed
              return;
            }

            // We exited cleanly, remove the local PID reference
            self._deletePID();

            if (callback) {
              callback();
            }
          });
        } else {
          if (callback) {
            callback(error);
          }
        }
      });
  },

  /**
   * Kills the emulator process by sending a SIGTERM to the child process
   *
   * @param {Function} callback The callback function to be called upon success/failure
   */
  kill: function (callback) {
    try {
      // Look for an existing PID file
      // Technically this doesn't need to be synchronous, but saves us from some
      // callback hell.
      var stats = fs.statSync(PID_PATH);

      if (stats.isFile()) {
        // Read the PID
        var pid = fs.readFileSync(PID_PATH);

        if (pid) {
          pid = parseInt(pid);

          try {
            process.kill(pid);
          } catch (e) {
            // The kill command will fail with ESRCH if there is no such process
            // We want to ignore this failure because it simply means we don't
            // need to kill.  All other failures are reported to the caller.
            if (e.code !== 'ESRCH') {
              // No such process
              if (callback) {
                callback(e);
              }
              return;
            }
          }

          // We either successfully killed the process, or there was no process
          // matching the PID.  Either way, clean up the PID file.
          self._deletePID();

          if (callback) {
            callback(null, self.KILLED);
          }
          return;
        }
      }
    } catch (e) {
      if (e.code !== 'ENOENT') {
        if (callback) {
          callback(e);
        }
        return;
      }
    }

    // Fall through to this callback if we couldn't find a valid PID file
    // We assume this means there isn't/wasn't a process.  If there is, we
    // Can't kill it anyway
    if (callback) {
      callback(null, self.STOPPED);
    }
  },

  /**
   * Restarts the emulator with the same projectId and debug arguments
   *
   * @param {Function} callback The callback function to be called upon success/failure
   */
  restart: function (callback) {
    // Can't restart if we're not running
    self._doIfRunning(function () {
      // Pull the current environment from the child process
      // This includes the GCP project ID and whether or not to start the
      // process with the --debug flag
      self.getCurrentEnvironment(function (err, env) {
        if (err) {
          callback(err);
          return;
        }

        // Stop the process.  Use the 'stop' method in this module so we're
        // forced to wait for stop to complete.
        self.stop(function (err) {
          if (err) {
            callback(err);
            return;
          }

          // Start the process with the same environment as we had last time
          self.start(
            env.projectId,
            env.debug,
            env.inspect,
            callback);
        });
      });
    }, function () {
      // The process isn't running.  Just return STOPPED to the caller to
      // indicate we couldn't restart.
      if (callback) {
        callback(null, self.STOPPED);
      }
    });
  },

  /**
   * Removes (undeploys) any functions deployed to this emulator
   *
   * @param {Function} callback The callback function to be called upon success/failure
   */
  clear: function (callback) {
    self._action('DELETE', EMULATOR_FUNC_URI,
      function (err) {
        if (err) {
          if (callback) {
            callback(err);
          }
          return;
        }

        if (callback) {
          callback();
        }
      });
  },

  /**
   * Removes (undeploys) any functions that no longer exist in their corresponding module
   *
   * @param {Function} callback The callback function to be called upon success/failure
   */
  prune: function (callback) {
    self._action('PATCH', EMULATOR_FUNC_URI,
      function (err, response, body) {
        if (err) {
          if (callback) {
            callback(err);
          }
          return;
        }

        if (callback) {
          callback(null, body);
        }
      });
  },

  /**
   * Checks the status of the child process' service
   *
   * @param {Function} callback The callback function to be called upon success/failure
   */
  status: function (callback) {
    self._checkStatus(config.port, function (err) {
      if (err) {
        if (callback) {
          callback(null, self.STOPPED);
        }
        return;
      }
      if (callback) {
        self.getCurrentEnvironment(function (err, env) {
          if (err) {
            callback(err);
            return;
          }
          callback(null, self.RUNNING, env, env.INSPECT);
        });
      }
    });
  },

  /**
   * Writes lines from the emulator log file to the given writer in FIFO order.
   * Lines are taken from the end of the file according to the limit argument.
   * That is, when limit is 10 will return the last (most recent) 10 lines from
   * the log (or fewer if there are fewer than 10 lines in the log), in the order
   * they were written to the log.
   *
   * @param {Object} writer The output writer onto which log lines will be written.
                            Should be an object that exposes a single 'write(String)' method
   * @param {integer} limit The maximum number of lines to write
   */
  getLogs: function (writer, limit) {
    if (!limit) {
      limit = 20;
    }

    var logFile = path.join(logs.assertLogsPath(), config.logFileName);

    logs.readLogLines(logFile, limit, function (val) {
      writer.write(val);
    });
  },

  /**
   * Deploys a function to the emulator.
   *
   * @param {String}  modulePath The local file system path (rel or abs) to the
   *                  Node module containing the function to be deployed
   * @param {String}  entryPoint The (case sensitive) name of the function to
   *                  be deployed.  This must be a function that is exported
   *                  from the host module
   * @param {String}  type One of 'H' (HTTP) or 'B' (BACKGROUND).  This
   *                  corresponds to the method used to invoke the function
   *                  (HTTP or direct invocation with a context argument)
   * @param {Function} callback The callback function to be called upon
   *                   success/failure
   */
  deploy: function (modulePath, entryPoint, type, callback) {
    self._action('POST', EMULATOR_FUNC_URI +
    entryPoint +
    '?path=' + path.resolve(modulePath) +
    '&type=' + type,
      function (err, response, body) {
        if (err) {
          if (callback) {
            callback(err);
          }
          return;
        }
        if (callback) {
          callback(null, body);
        }
      });
  },

  /**
   * Removes a previously deployed function from the emulator.
   *
   * @param {Function} callback The callback function to be called upon success/failure
   */
  undeploy: function (name, callback) {
    self._action('DELETE', EMULATOR_FUNC_URI + name,
      function (err) {
        if (err) {
          if (callback) {
            callback(err);
          }
          return;
        }

        if (callback) {
          callback();
        }
      });
  },

  /**
   * Returns a JSON document containing all deployed functions including any
   * metadata that was associated with the function at deploy-time
   *
   * @param {Function} callback The callback function to be called upon success/failure
   */
  list: function (callback) {
    self._action('GET', EMULATOR_FUNC_URI,
      function (err, response, body) {
        if (err) {
          if (callback) {
            callback(err);
          }
          return;
        }
        if (callback) {
          callback(null, JSON.parse(body));
        }
      });
  },

  /**
   * Describes a single function deployed to the emulator.  This includes the
   * function name and associated meta data
   *
   * @param {String} name The (case sensitive) name of the function to be described
   * @param {Function} callback The callback function to be called upon success/failure
   */
  describe: function (name, callback) {
    self._action('GET', EMULATOR_FUNC_URI + name,
      function (err, response, body) {
        if (err) {
          if (callback) {
            callback(err);
          }
          return;
        }
        if (callback) {
          callback(null, body);
        }
      });
  },

  /**
   * Causes the function denoted by the given name to be invoked with the given
   * data payload.  If the function is a BACKGROUND function, this will invoke
   * the function directly with the data argument.  If the function is an HTTP
   * function this will perform an HTTP POST with the data argument as the POST
   * body.
   *
   * @param {String} name The (case sensitive) name of the function to be invoked
   * @param {JSON} data A JSON document representing the function invocation payload
   * @param {Function} callback The callback function to be called upon success/failure
   */
  call: function (name, data, callback) {
    if (!data) {
      data = {};
    }
    self._action('POST', EMULATOR_ROOT_URI + '/' + name, function (err, response, body) {
      if (err) {
        if (callback) {
          if (err.stack) {
            callback(err.stack);
          } else {
            callback(err);
          }
        }
        return;
      }

      if (callback) {
        callback(null, body, response);
      }
    }, data);
  },

  /**
   * Returns the current environment of the child process.  This includes the
   * GCP project used when starting the child process, and whether the process
   * is running in debug mode.
   *
   * @param {Function} callback The callback function to be called upon success/failure
   */
  getCurrentEnvironment: function (callback) {
    self._action('GET', EMULATOR_ROOT_URI + '/?env=true',
      function (err, response, body) {
        if (err) {
          if (callback) {
            callback(err);
          }
          return;
        }
        if (callback) {
          callback(null, JSON.parse(body));
        }
      });
  },

  _waitForStop: function (port, timeout, callback, i) {
    if (!i) {
      i = timeout / TIMEOUT_POLL_INCREMENT;
    }

    self._checkStatus(port, function (err) {
      if (err) {
        callback();
        return;
      }

      i--;

      if (i <= 0) {
        callback('Error: Timeout waiting for emulator stop');
        return;
      }

      setTimeout(function () {
        self._waitForStop(port, timeout, callback, i);
      }, TIMEOUT_POLL_INCREMENT);
    });
  },

  _waitForStart: function (port, timeout, callback, i) {
    if (!i) {
      i = timeout / TIMEOUT_POLL_INCREMENT;
    }

    self._checkStatus(port, function (err) {
      if (!err) {
        callback();
        return;
      }

      i--;

      if (i <= 0) {
        callback('Error: Timeout waiting for emulator start'.red);
        return;
      }

      setTimeout(function () {
        self._waitForStart(port, timeout, callback, i);
      }, TIMEOUT_POLL_INCREMENT);
    });
  },

  _checkStatus: function (port, callback) {
    var client = net.connect(port, 'localhost', function () {
      client.end();
      callback();
    });
    client.on('error', function (ex) {
      callback(ex);
    });
  },

  _action: function (method, uri, callback, data) {
    self._checkStatus(config.port, function (err) {
      if (err) {
        if (callback) {
          callback(err);
        }
        return;
      }

      var options = {
        method: method,
        url: uri
      };

      if (method === 'POST' && data) {
        if (data.toString() === '[object String]' || typeof data === 'string') {
          options.json = JSON.parse(data);
        } else {
          // Assume object
          options.json = data;
        }
      }

      try {
        request(options,
          function (error, response, body) {
            if (!error && response.statusCode === 200) {
              callback(null, response, body);
            } else if (error) {
              callback(error, response, body);
            } else {
              callback(body, response, body);
            }
          });
      } catch (e) {
        callback(new Error(e));
      }
    });
  },

  _doIfRunning: function (running, notRunning) {
    self._checkStatus(config.port, function (err) {
      if (err) {
        if (notRunning) {
          notRunning();
        }
        return;
      }
      if (running) {
        running();
      }
    });
  },

  _writePID: function (pid) {
    // Write the pid to the file system in case we need to kill it
    fs.writeFile(PID_PATH, pid,
      function (err) {
        if (err) {
          // Don't throw, just abort
          console.log(err);
        }
      });
  },

  _deletePID: function () {
    fs.unlink(PID_PATH,
      function (err) {
        if (err) {
          // Don't throw, just abort
          console.log(err);
        }
      });
  }
};

module.exports = self;
