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
const fork = require('child_process').fork;
const http = require('http');
const httpProxy = require('http-proxy');
const net = require('net');
const path = require('path');
const url = require('url');

const errors = require('../utils/errors');
const Model = require('../model');

const MAX_IDLE = 5 * 60 * 1000;
const IDLE_PRUNE_INTERVAL = 60 * 1000;
const NAME_REG_EXP = /^\/([-\w]+)\/([-\w]+)\/([A-Za-z][-A-Za-z0-9]*)/;

const { CloudFunction } = Model;

/**
 * The Supervisor service manages the function worker pool.
 *
 * @class Supervisor
 * @param {object} functions
 * @param {object} opts
 */
class Supervisor {
  constructor (functions, opts) {
    this._functions = functions;
    this.config = _.cloneDeep(opts);

    if (this.config.useMocks === 'true') {
      this.config.useMocks = true;
    } else if (this.config.useMocks === 'false') {
      this.config.useMocks = false;
    }

    // Setup the proxy server
    this._proxy = httpProxy.createProxyServer({
      ignorePath: true
    });
    this._proxy.on('proxyReq', (proxyReq, req, res, options) => {
      proxyReq.url = req.workerUrl;
    });
    this._server = http.createServer((req, res) => this.handleRequest(req, res));

    this._workerPool = new Map();

    // Check for and close idle workers
    setInterval(() => this._prune(), IDLE_PRUNE_INTERVAL);
  }

  /**
   * Gets or creates a worker.
   *
   * @method Superviser#_acquire
   * @private
   * @param {string} key
   * @param {object} cloudfunction
   * @returns Promise
   */
  _acquire (key, cloudfunction) {
    return Promise.resolve()
      .then(() => {
        if (!this._workerPool.has(key)) {
          return this._create(key, cloudfunction);
        }
      })
      .then(() => {
        const worker = this._workerPool.get(key);
        worker.lastAccessed = Date.now();
        return worker;
      });
  }

  /**
   * Creates a new worker.
   *
   * @method Superviser#_create
   * @private
   * @param {string} key
   * @param {object} cloudfunction
   * @returns Promise
   */
  _create (key, cloudfunction) {
    return Promise.resolve()
      .then(() => {
        if (this.config.inspect) {
          return this._getPort(this.config.inspectPort)
            .then((port) => {
              console.log(`Debugger (via --inspect) for ${key} listening on port ${port}.`);
              return [`--inspect=${port}`];
            });
        } else if (this.config.debug) {
          return this._getPort(this.config.debugPort)
            .then((port) => {
              console.log(`Debugger (via --debug) for ${key} listening on port ${port}.`);
              return [`--debug=${port}`];
            });
        }
        return [];
      })
      .then((execArgv) => {
        // Spawn a child process in which to execute the user's function
        // TODO: Warn when the Supervisor process ends but a child process is
        // still running
        // TODO: Forcefully exit worker process after maximum timeout
        const worker = fork(path.join(__dirname, 'worker.js'), [], {
          // Execute the process in the context of the user's code
          cwd: cloudfunction.localPath,
          // Emulate the environment variables of the production service
          env: _.merge({}, process.env, {
            FUNCTION_NAME: cloudfunction.shortName,
            GCLOUD_PROJECT: this.config.projectId,
            GCP_PROJECT: this.config.projectId
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

        // Finally, wait for the child process to shutdown
        worker.on('close', (code) => {
          console.log(`${key} worker closed.`);
        });

        this._workerPool.set(key, worker);

        return new Promise((resolve) => {
          worker.on('message', (port) => {
            worker.port = port;
            resolve();
          });

          worker.send({
            name: cloudfunction.shortName,
            cloudfunction,
            useMocks: this.config.useMocks
          });
        });
      });
  }

  /**
   * Get an open port.
   *
   * @method Supervisor#_getPort
   * @private
   * @returns Promise
   */
  _getPort (start) {
    return new Promise((resolve) => {
      let portrange = start;

      function getPort (cb) {
        const port = portrange;
        portrange += 1;

        const server = net.createServer();
        server.listen(port, () => {
          server.once('close', () => cb(port));
          server.close();
        });
        server.on('error', () => getPort(cb));
      }

      getPort(resolve);
    });
  }

  /**
   * Closes idle workers.
   *
   * @method Supervisor#prune
   * @private
   */
  _prune () {
    for (let [key, worker] of this._workerPool) {
      // Find workers that been idle longer than MAX_IDLE
      if ((Date.now() - worker.lastAccessed) >= MAX_IDLE) {
        // Shutdown and remove idle workers from the pool
        worker.kill();
        this._workerPool.delete(key);
      }
    }
  }

  /**
   * Sends a formatted error response.
   *
   * @method Supervisor#_sendError
   * @private
   * @param {*} err
   * @param {object} res
   */
  _sendError (err, res) {
    // Check for a serialized error and deserialize it if necessary
    if (!(err instanceof Error) && err.name && err.stack && err.message) {
      const _err = err;
      err = new Error(_err.message);
      err.stack = _err.stack;
    }

    res.statusCode = 500;

    // TODO: Extract most of this error handling/formatting into a utility
    if (err instanceof Error) {
      res.write(err.stack);
    } else if (typeof err === 'object') {
      if (err.code) {
        if (err.code === errors.status.FAILED_PRECONDITION) {
          res.statusCode = 400;
          res.write(JSON.stringify({
            error: {
              code: 400,
              status: 'FAILED_PRECONDITION',
              message: err.message || http.STATUS_CODES['400'],
              errors: [err.message || http.STATUS_CODES['400']]
            }
          }));
        } else if (err.code === errors.status.NOT_FOUND) {
          res.statusCode = 404;
          res.write(JSON.stringify({
            error: {
              code: 404,
              status: 'NOT_FOUND',
              message: err.message || http.STATUS_CODES['404'],
              errors: [err.message || http.STATUS_CODES['404']]
            }
          }));
        } else {
          res.write(JSON.stringify({
            error: {
              code: 500,
              status: 'INTERNAL',
              message: err.message || http.STATUS_CODES['500'],
              errors: [err.message || http.STATUS_CODES['500']]
            }
          }));
        }
      }
    }

    res.end();
  }

  /**
   * Shut down all workers.
   *
   * @method Supervisor#clear
   */
  clear () {
    for (let [key, worker] of this._workerPool) {
      console.debug(`Stopping worker ${key}...`);
      worker.kill('SIGKILL');
      this._workerPool.delete(key);
    }
  }

  /**
   * Shut down any worker for the given Cloud Function.
   *
   * @method Supervisor#delete
   * @param {string} name
   */
  delete (name) {
    const parts = CloudFunction.parseName(name);
    const key = `/${parts.project}/${parts.location}/${parts.name}`;

    for (let [_key, worker] of this._workerPool) {
      if (_key === key) {
        console.debug(`Stopping worker ${key}...`);
        worker.kill('SIGKILL');
      }
    }
    this._workerPool.delete(key);
  }

  /**
   * Handles an incoming request.
   *
   * @method Superviser#handleRequest
   * @param {object} req
   * @param {object} res
   */
  handleRequest (req, res) {
    const parts = url.parse(req.url);
    const matches = parts.pathname.match(NAME_REG_EXP);

    if (!matches) {
      res.statusCode = 404;
      res.end();
      return;
    }

    const [, project, location, name] = matches;
    const formattedName = CloudFunction.formatName(project, location, name);
    const key = `/${project}/${location}/${name}`;

    this._functions.getFunction(formattedName)
      .then((cloudfunction) => this._acquire(key, cloudfunction))
      .then((worker) => {
        this._proxy.web(req, res, {
          target: `http://localhost:${worker.port}${req.url.replace(key, '') || '/'}`
        });
      })
      .catch((err) => {
        console.error(err);
        this._sendError(err, res);
      });
  }

  /**
   * Adds an event listener to the proxy server.
   *
   * @method Supervisor#on
   * @param {string} event
   * @param {function} handler
   */
  on (...args) {
    this._server.on(...args);
    return this;
  }

  /**
   * Starts the Supervisor service, causing the proxy server to start listening
   * on the configured port.
   *
   * @method Supervisor#start
   */
  start () {
    console.debug(`Starting supervisor at ${this.config.host}:${this.config.port}...`);
    this._server.listen(this.config.port, this.config.host, () => {
      console.debug(`Supervisor listening at ${this._server.address().address}:${this._server.address().port}.`);
    });

    process.on('exit', () => {
      this.stop();
    });

    return this;
  }

  /**
   * Stops the Supervisor service, causing the workers and proxy server to
   * shut down.
   *
   * @method Supervisor#stop
   */
  stop () {
    console.debug(`Stopping supervisor...`);

    this.clear();

    this._server.close(() => {
      console.debug('Supervisor stopped.');
    });

    return this;
  }
}

exports.Supervisor = Supervisor;
exports.supervisor = (...args) => new Supervisor(...args);
