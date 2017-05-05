/**
 * Copyright 2017, Google, Inc.
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
const httpProxy = require('http-proxy');
const logger = require('winston');
const path = require('path');
const url = require('url');

const Errors = require('../utils/errors');
const Model = require('../model');
const server = require('../server');

const DEFAULT_MAX_IDLE = 5 * 60 * 1000;
const DEFAULT_IDLE_PRUNE_INTERVAL = 60 * 1000;
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
  constructor (functions, opts = {}) {
    this._functions = functions;
    this.config = _.cloneDeep(opts);

    // Default values
    if (this.config.useMocks === 'true') {
      this.config.useMocks = true;
    } else if (this.config.useMocks === 'false') {
      this.config.useMocks = false;
    }
    this.config.idlePruneInterval || (this.config.idlePruneInterval = DEFAULT_IDLE_PRUNE_INTERVAL);
    this.config.maxIdle || (this.config.maxIdle = DEFAULT_MAX_IDLE);

    // Setup the express app
    this.app = express();

    // Setup the Supervisor API
    const apiRouter = express.Router();
    apiRouter.use(bodyParser.json());
    apiRouter.use(bodyParser.raw());
    apiRouter.use(bodyParser.text());
    apiRouter.use(bodyParser.urlencoded({
      extended: true
    }));
    apiRouter.post('/clear', (req, res, next) => this.clearHandler(req, res).catch(next));
    apiRouter.post('/debug', (req, res, next) => this.debugHandler(req, res).catch(next));
    apiRouter.post('/delete', (req, res, next) => this.deleteHandler(req, res).catch(next));
    apiRouter.post('/deploy', (req, res, next) => this.deployHandler(req, res).catch(next));
    apiRouter.post('/reset', (req, res, next) => this.resetHandler(req, res).catch(next));
    apiRouter.use((req, res) => res.status(404).end());
    apiRouter.use((err, req, res, next) => Errors.sendRestError(err, res));
    this.app.use('/api', apiRouter);

    // Setup handling of function invocations
    this.app.use((req, res, next) => this.callHandler(req, res, next));
    this.app.use((err, req, res, next) => Errors.sendRestError(err, res));

    // Setup the proxy server
    this._proxy = httpProxy.createProxyServer({
      // We will manually set the path when we pass the request to the worker
      ignorePath: true
    });
    this._proxy
      .on('error', (err, req, res) => {
        // The function failed to respond to the request or crashed
        this.closeWorker(req.functionName);
        logger.info(`Execution took ${Date.now() - req.functionStart} ms, finished with status: 'crash'`);

        res
          .status(500)
          .json({
            error: {
              code: 500,
              status: 'INTERNAL',
              message: 'function crashed',
              errors: [err.message]
            }
          })
          .end();
      })
      .on('proxyReq', (proxyReq, req, res, options) => {
        // This allows us to rewrite the url from:
        //   /:project/:location/:function/*
        // to just
        //   /*
        proxyReq.url = req.workerUrl;
      })
      .on('proxyRes', (proxyRes, req, res) => {
        clearTimeout(req.functionTimeout);
      });

    // This map tracks the running function workers
    this._workerPool = new Map();

    // Periodically check for and close idle workers
    this.pruneIntervalId = setInterval(() => this.prune(), this.config.idlePruneInterval);
  }

  static get DEFAULT_MAX_IDLE () {
    return DEFAULT_MAX_IDLE;
  }

  static get DEFAULT_IDLE_PRUNE_INTERVAL () {
    return DEFAULT_IDLE_PRUNE_INTERVAL;
  }

  calculateTimeout (duration) {
    // The default is 60 seconds
    const DEFAULT = 60 * 1000;
    const MAX = 9 * 60 * 1000;

    try {
      if (!duration || !duration.seconds) {
        return DEFAULT;
      }

      const seconds = parseFloat(duration.seconds);

      if (isNaN(seconds)) {
        return DEFAULT;
      }

      const milliseconds = seconds * 1000;
      if (milliseconds > MAX) {
        return MAX;
      }
      return milliseconds;
    } catch (err) {
      return DEFAULT;
    }
  }

  /**
   * Handles an incoming function invocation request.
   *
   * @method Superviser#callHandler
   * @param {object} req
   * @param {object} res
   * @returns Promise
   */
  callHandler (req, res, next) {
    logger.debug('Supervisor#callHandler', req.url);
    const parts = url.parse(req.url);
    const matches = parts.pathname.match(NAME_REG_EXP);

    if (!matches) {
      next(new Errors.NotFoundError(`${parts.pathname} is not a recognized path.`));
      return;
    }

    const [, project, location, name] = matches;
    const formattedName = CloudFunction.formatName(project, location, name);
    const key = `/${project}/${location}/${name}`;

    req.functionName = formattedName;
    req.functionStart = Date.now();

    return this.getOrCreateWorker(formattedName)
      .then((worker) => {
        req.functionTimeout = setTimeout(() => {
          this.closeWorker(req.functionName);
          logger.info(`Execution took ${Date.now() - req.functionStart} ms, finished with status: 'timeout'`);

          res
            .status(500)
            .json({
              error: {
                code: 500,
                status: 'INTERNAL',
                message: 'function execution attempt timed out'
              }
            })
            .end();
        }, worker.functionTimeout);

        this._proxy.web(req, res, {
          target: `http://localhost:${worker.port}${req.url.replace(key, '') || '/'}`
        });
      })
      .catch(next);
  }

  /**
   * Shuts down all workers.
   *
   * @method Supervisor#clear
   * @returns Promise
   */
  clear () {
    const tasks = [];
    for (let [name] of this._workerPool) {
      tasks.push(this.closeWorker(name));
    }
    return Promise.all(tasks);
  }

  /**
   * Request handler for /api/clear. Shuts down all workers.
   *
   * @method Supervisor#clearHandler
   * @param {object} req
   * @param {object} res
   * @returns Promise
   */
  clearHandler (req, res) {
    return this.clear().then(() => res.end());
  }

  /**
   * Shuts down a worker.
   *
   * @method Superviser#closeWorker
   * @param {string} name
   * @returns Promise
   */
  closeWorker (name) {
    if (!this._workerPool.has(name)) {
      return Promise.resolve({ status: 'NOT_FOUND', code: null, signal: null, worker: null });
    }

    return new Promise((resolve) => {
      let timeout;
      const worker = this._workerPool.get(name);
      this._workerPool.delete(name);
      logger.debug(`Stopping worker ${name}...`);
      const pid = worker.process.pid;

      worker.process.kill();
      worker.process.on('exit', (code, signal) => {
        logger.debug(`${name} worker closed.`);
        clearTimeout(timeout);
        const savedWorkers = server.get('workers');
        delete savedWorkers[pid];
        server.set('workers', savedWorkers);
        resolve({ status: 'CLOSED', code, signal, worker });
      });

      // Give the worker 5 seconds to shutdown before killing it forcibly
      timeout = setTimeout(() => {
        try {
          process.kill(pid, 'SIGKILL');
        } catch (err) {

        }
        resolve({ status: 'KILLED', code: null, signal: null, worker });
      }, 5 * 1000);
    });
  }

  /**
   * Creates a new worker.
   *
   * @method Superviser#createWorker
   * @param {object} cloudfunction
   * @param {object} opts
   * @returns Promise
   */
  createWorker (cloudfunction, opts) {
    logger.debug('createWorker', cloudfunction.name, opts);
    opts || (opts = {});
    return new Promise((resolve, reject) => {
      const worker = {};
      let error, stderr;
      let resolved = false;
      let rejected = false;

      const timeout = setInterval(() => {
        if (rejected) {
          clearInterval(timeout);
          reject(error);
        } else if (resolved) {
          clearInterval(timeout);
          resolve(worker);
        }
      }, 200);

      worker.functionTimeout = this.calculateTimeout(cloudfunction.timeout);

      const execArgv = [];
      if (opts.inspect) {
        execArgv.push(`--inspect=${opts.port}`);
        worker.inspect = true;
        if (!this.debugPortIsAvailable(opts.port)) {
          error = new Errors.ConflictError(`Debug/Inspect port ${opts.port} already in use. Are you already debugging another function on this port? Specify a different port or reset the function that's using your desired port.`);
          rejected = true;
          return;
        }
        worker.inspectPort = opts.port;
        if (opts.pause) {
          execArgv.push('--debug-brk');
          worker.paused = true;
        }
      } else if (opts.debug) {
        execArgv.push(`--debug=${opts.port}`);
        worker.debug = true;
        if (!this.debugPortIsAvailable(opts.port)) {
          error = new Errors.ConflictError(`Debug/Inspect port ${opts.port} already in use. Are you already debugging another function on this port? Specify a different port or reset the function that's using your desired port.`);
          rejected = true;
          return;
        }
        worker.debugPort = opts.port;
        if (opts.pause) {
          execArgv.push('--debug-brk');
          worker.paused = true;
        }
      }

      const parts = CloudFunction.parseName(cloudfunction.name);

      // Spawn a child process in which to execute the user's function
      // TODO: Warn when the Supervisor process ends but a child process is
      // still running
      // TODO: Forcefully exit worker process after maximum timeout
      const workerProcess = worker.process = fork(path.join(__dirname, 'worker.js'), [], {
        // Execute the process in the context of the user's code
        cwd: cloudfunction.serviceAccount,
        // Emulate the environment variables of the production service
        env: _.merge({}, process.env, {
          FUNCTION_NAME: cloudfunction.shortName,
          GCLOUD_PROJECT: parts.project,
          GCP_PROJECT: parts.project
        }),
        // Optionally prepare to debug the child process
        execArgv,
        // Allow stdin, stdout, and stderr to be piped to the parent so we can
        // capture the user's logs
        silent: true
      });

      const savedWorkers = server.get('workers') || {};
      savedWorkers[workerProcess.pid] = 'STARTED';
      server.set('workers', savedWorkers);

      workerProcess
        // Handle when the worker process closes
        .on('exit', (code, signal) => {
          let msg = `${cloudfunction.name} worker closed.`;
          logger.debug(msg);
          const workerPids = server.get('workers') || {};
          delete workerPids[workerProcess.pid];
          server.set('workers', workerPids);

          if (code === 12) {
            msg = `Debug/Inspect port ${worker.debugPort || worker.inspectPort} already in use. Are you already debugging another function on this port? Specify a different port or reset the function that's using your desired port.`;
            error = new Errors.ConflictError(msg);
            rejected = true;
            logger.error(msg);
          } else if (code) {
            msg = `Function worker crashed with exit code: ${code}`;
            logger.error(msg);
            if (stderr) {
              msg += `\n${stderr.trim()}`;
            }
            error = new Errors.InternalError(msg);
            rejected = true;
          } else if (signal) {
            msg = `Function worker killed by signal: ${signal}`;
            if (stderr) {
              logger.error(msg);
              msg += `\n${stderr.trim()}`;
            } else {
              logger.debug(msg);
            }
            error = new Errors.InternalError(msg);
            rejected = true;
          }
        })
        .on('error', (err) => {
          logger.error(`ERROR: ${cloudfunction.name}`);
          logger.error(err);
        });

      // Anything the user logs will be logged at the Debug level
      workerProcess.stdout.on('data', (chunk) => {
        let str = chunk.toString('utf8');
        if (str.charAt(str.length - 1) === '\n') {
          str = str.substring(0, str.length - 1);
        }
        logger.info(str);
      });

      // Any errors logged by the user will be logged at the Error level
      workerProcess.stderr.on('data', (chunk) => {
        let str = chunk.toString('utf8');
        if (str.charAt(str.length - 1) === '\n') {
          str = str.substring(0, str.length - 1);
        }
        stderr += str;
        logger.error(str);
      });

      workerProcess.on('message', (message) => {
        if (message.port) {
          // The worker now has a ported and is receiving connections
          worker.port = message.port;
          if (opts.inspect) {
            logger.info(`Debugger (via --inspect) for ${cloudfunction.name} listening on port ${opts.port}.`);
          } else if (opts.debug) {
            logger.info(`Debugger (via --debug) for ${cloudfunction.name} listening on port ${opts.port}.`);
          }
          if (!rejected) {
            this._workerPool.set(cloudfunction.name, worker);
            resolved = true;
          }
        } else if (message.close) {
          this.closeWorker(cloudfunction.name);
        } else if (message.ready) {
          workerProcess.send({
            name: cloudfunction.shortName,
            cloudfunction,
            useMocks: this.config.useMocks,
            debug: worker.debug || worker.inspect
          });
        }
      });
    });
  }

  /**
   * Starts or restarts a worker in debug mode.
   *
   * @method Supervisor#debugHandler
   * @param {object} req
   * @param {object} res
   * @returns Promise
   */
  debugHandler (req, res) {
    req.body[req.body.type] = true;
    return this.closeWorker(req.body.name)
      .then(() => this.getOrCreateWorker(req.body.name, req.body))
      .then(() => res.end());
  }

  debugPortIsAvailable (port) {
    for (let [, worker] of this._workerPool) {
      if (worker.debugPort === port || worker.inspectPort === port) {
        return false;
      }
    }
    return true;
  }

  /**
   * Shuts down the worker for the given function.
   *
   * @method Supervisor#deleteHandler
   * @param {object} req
   * @param {object} res
   * @returns Promise
   */
  deleteHandler (req, res) {
    return this.closeWorker(req.body.name)
      .then(() => res.end());
  }

  /**
   * Request handler for /api/deploy. Spins up a new worker for the given
   * function. Shuts down any previous worker for the function.
   *
   * @method Supervisor#deployHandler
   * @param {object} req
   * @param {object} res
   * @returns Promise
   */
  deployHandler (req, res) {
    return this.closeWorker(req.body.name)
      .then(() => this.getOrCreateWorker(req.body.name))
      .then(() => res.end());
  }

  /**
   * Gets or creates a worker for the given function.
   *
   * @method Superviser#getOrCreateWorker
   * @param {string} name
   * @param {object} opts
   * @returns Promise
   */
  getOrCreateWorker (name, opts) {
    return this._functions.getFunction(name)
      .then((cloudfunction) => {
        if (!this.hasWorker(name)) {
          return this.createWorker(cloudfunction, opts);
        }
        return this.getWorker(name);
      })
      .then((worker) => {
        worker.lastAccessed = Date.now();
        return worker;
      });
  }

  getWorker (name) {
    return this._workerPool.get(name);
  }

  hasWorker (name) {
    return this._workerPool.has(name);
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
   * Shuts down workers that have been idle longer than the length of time
   * specified by Supervisor#config.maxIdle.
   *
   * @method Supervisor#prune
   * @returns Promise
   */
  prune () {
    const tasks = [];

    for (let [name, worker] of this._workerPool) {
      // Find workers that been idle longer than MAX_IDLE
      if ((Date.now() - worker.lastAccessed) >= this.config.maxIdle) {
        // Shutdown and remove idle workers from the pool
        tasks.push(this.closeWorker(name));
      }
    }

    return Promise.all(tasks);
  }

  /**
   * Request handler for /api/reset. Spins up a new worker for the given
   * function. Shuts down any previous worker for the function. Keeps previous
   * worker debug settings for the refreshed worker if the keep option was set.
   *
   * @method Supervisor#resetHandler
   * @param {object} req
   * @param {object} res
   * @returns Promise
   */
  resetHandler (req, res) {
    return this.closeWorker(req.body.name)
      .then(({ worker }) => {
        let opts;

        if (worker && req.body.keep) {
          opts = {
            name: req.body.name,
            debug: worker.debug,
            inspect: worker.inspect,
            port: worker.inspectPort || worker.debugPort,
            pause: worker.paused
          };
        }

        // Restart the worker, keeping some of its settings the same
        return this.getOrCreateWorker(req.body.name, opts);
      })
      .then(() => res.end());
  }

  /**
   * Starts the Supervisor service, causing the proxy server to start listening
   * on the configured port.
   *
   * @method Supervisor#start
   */
  start () {
    logger.debug(`Starting supervisor at ${this.config.bindHost}:${this.config.port}...`);
    this._server = this.app.listen(this.config.port, this.config.bindHost);
    this._server
      .on('listening', () => {
        logger.debug(`Supervisor listening at ${this._server.address().address}:${this._server.address().port}.`);
      })
      .on('error', (err) => {
        logger.error('SUPERVISOR error', err);
      })
      .on('clientError', (err, socket) => {
        logger.error('SUPERVISOR clientError', err, socket);
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
    logger.debug('Stopping supervisor...');

    clearInterval(this.pruneIntervalId);

    this.clear();

    this._server.close(() => {
      logger.debug('Supervisor stopped.');
    });

    // Synchronously kill workers in case there isn't time to do the async work
    // in this.clear();
    const workerPids = Object.keys(server.get('workers') || {});
    workerPids.forEach((pid) => {
      logger.debug(`Killing process: ${pid}`);
      try {
        process.kill(pid, 'SIGKILL');
      } catch (err) {
        // Ignore error
      }
      delete workerPids[pid];
    });
    server.delete('workers');

    return this;
  }
}

module.exports = Supervisor;
