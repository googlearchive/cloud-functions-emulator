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

/**
 * The Emulator has two services: "rest" and "grpc".
 *
 * In "rest" mode the CLI uses a RestClient (implemented using the Google APIs
 * Client Library) to communicate with the Emulator:
 *
 *     |-->-- RestClient - HTTP1.1 - JSON -->--|
 * CLI -                                       - Emulator
 *     |--<-- RestClient - HTTP1.1 - JSON --<--|
 *
 * In "grpc" mode the CLI uses a GrpcClient (implemented using the Google Cloud
 * Client Library) to communicate with the Emulator:
 *
 *     |-->-- GrpcClient - HTTP2 - Proto -->--|
 * CLI -                                      - Emulator
 *     |--<-- GrpcClient - HTTP2 - Proto --<--|
 *
 * The Gcloud SDK can be used to talk to the Emulator as well, just do:
 *
 *     gcloud config set api_endpoint_overrides/cloudfunctions http://localhost:8008/
 */

'use strict';

require('colors');

const _ = require('lodash');
const AdmZip = require('adm-zip');
const exec = require('child_process').exec;
const fs = require('fs');
const got = require('got');
const path = require('path');
const spawn = require('child_process').spawn;
const Storage = require('@google-cloud/storage');
const tmp = require('tmp');

const Client = require('../client');
const config = require('../config');
const Model = require('../model');
const defaults = require('../defaults.json');
const logs = require('../emulator/logs');
const pkg = require('../../package.json');
const server = require('../server');

const { CloudFunction } = Model;

const TIMEOUT_POLL_DECREMENT = 500;
const STATE = {
  STOPPED: 0,
  RUNNING: 1
};

class Controller {
  constructor (opts = {}) {
    if (!(this instanceof Controller)) {
      return new Controller(opts);
    }

    this.name = 'Google Cloud Functions Emulator';
    this.STATE = STATE;
    // Prepare the file that will store the Emulator's current status
    this.server = server;

    // Load and apply defaults to the user's Emulator configuration
    this._config = config;
    // Merge the user's configuration with command-line options
    this.config = _.merge({}, defaults, this._config.all, opts);

    // We will pipe stdout from the child process to the emulator log file
    this.config.logFile = logs.assertLogsPath(this.config.logFile);

    const clientConfig = _.merge(this.config, {
      grpcPort: opts.grpcPort || this.server.get('grpcPort') || this.config.grpcPort,
      host: opts.host || (!this.server.get('stopped') && this.server.get('host')) || this.config.host,
      restPort: opts.restPort || this.server.get('restPort') || this.config.restPort
    });

    // Initialize the client that will communicate with the Emulator
    if (this.config.service === 'rest') {
      // The REST client uses the Google APIs Node.js client (googleapis)
      this.client = Client.restClient(clientConfig);
    } else if (this.config.service === 'grpc') {
      // The gRPC client uses the Google Cloud Node.js client (@google-cloud/functions)
      this.client = Client.grpcClient(clientConfig);
    } else {
      throw new Error('"service" must be one of "rest" or "grpc"!');
    }
  }

  /**
   * Creates an archive of a local module.
   *
   * @param {string} name The name of the function being archived.
   * @param {object} opts Configuration options.
   * @returns {Promise}
   */
  _createArchive (name, opts) {
    let sourceArchiveUrl;

    opts.localPath = path.resolve(opts.localPath);

    let pathForCmd = opts.localPath;

    if (process.platform === 'win32') {
      // See https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/34
      pathForCmd = opts.localPath.replace(/\\/g, '/');
    }

    if (!fs.existsSync(opts.localPath)) {
      throw new Error('Provided directory does not exist.');
    }

    return new Promise((resolve, reject) => {
      // Parse the user's code to find the names of the exported functions
      exec(`node -e "console.log(JSON.stringify(Object.keys(require('${pathForCmd}') || {}))); setTimeout(function() { process.exit(0); }, 100);"`, (err, stdout, stderr) => {
        if (err) {
          this.error(`${'ERROR'.red}: Function load error: Code could not be loaded.`);
          this.error(`${'ERROR'.red}: Does the file exists? Is there a syntax error in your code?`);
          this.error(`${'ERROR'.red}: Detailed stack trace: ${stderr || err.stack}`);
          reject(new Error('Failed to deploy function.'));
        } else {
          resolve(stdout.toString().trim());
        }
      });
    })
      .then((exportedKeys) => {
        // TODO: Move this check to the Emulator during unpacking
        // TODO: Make "index.js" dynamic
        if (!exportedKeys.includes(opts.entryPoint) && !exportedKeys.includes(name)) {
          throw new Error(`Node.js module defined by file index.js is expected to export function named ${opts.entryPoint || name}`);
        }

        const tmpName = tmp.tmpNameSync({
          prefix: `${opts.region}-${name}-`,
          postfix: '.zip'
        });

        const zip = new AdmZip();

        const files = fs.readdirSync(opts.localPath);
        files.forEach((entry) => {
          if (entry === 'node_modules') {
            return false;
          }
          const entryPath = path.join(opts.localPath, entry);
          const stats = fs.statSync(entryPath);

          if (stats.isDirectory()) {
            zip.addLocalFolder(entryPath);
          } else if (stats.isFile()) {
            zip.addLocalFile(entryPath);
          }
        });

        // Copy the function code to a temp directory on the local file system
        let logStr = `file://${tmpName}`;
        if (opts.stageBucket) {
          logStr += ' [Content-Type=application/zip]';
        }
        this.log(`Copying ${logStr}...`);
        if (!this.config.tail) {
          process.stdout.write('Waiting for operation to finish...');
        }

        zip.writeZip(tmpName);

        return new Promise((resolve, reject) => {
          if (opts.stageBucket) {
            // Upload the function code to a Google Cloud Storage bucket
            const storage = Storage({ projectId: this.config.projectId });

            const file = storage.bucket(opts.stageBucket).file(path.parse(tmpName).base);
            // The GCS Uri where the .zip will be saved
            sourceArchiveUrl = `gs://${file.bucket.name}/${file.name}`;

            // Stream the file up to Cloud Storage
            const options = {
              metadata: {
                contentType: 'application/zip'
              }
            };
            fs.createReadStream(tmpName)
              .pipe(file.createWriteStream(options))
              .on('error', reject)
              .on('finish', () => {
                this.log('done.');
                try {
                  fs.unlinkSync(tmpName);
                } catch (err) {
                  // Ignore error
                }
                resolve(sourceArchiveUrl);
              });
          } else {
            // Technically, this needs to be a GCS Uri, but the emulator will know
            // how to interpret a path on the local file system
            sourceArchiveUrl = `file://${tmpName}`;
            this.log('done.');
            resolve(sourceArchiveUrl);
          }
        });
      });
  }

  /**
   * Waits for the Emulator to start, erroring after a timeout.
   *
   * @param {number} i The remaining time to wait.
   * @returns {Promise}
   */
  _waitForStart (i) {
    if (i === undefined) {
      i = this.config.timeout;
    }

    return this.client.testConnection()
      .catch(() => {
        i -= TIMEOUT_POLL_DECREMENT;

        if (i <= 0) {
          throw new Error('Timeout waiting for emulator start'.red);
        }

        if (this.config.service === 'grpc') {
          this.client._setup();
        }

        return new Promise((resolve, reject) => {
          this._timeout = setTimeout(() => {
            this._waitForStart(i).then(resolve, reject);
          }, TIMEOUT_POLL_DECREMENT);
        });
      });
  }

  /**
   * Waits for the Emulator to stop, erroring after a timeout.
   *
   * @param {number} i The remaining time to wait.
   * @returns {Promise}
   */
  _waitForStop (i) {
    if (i === undefined) {
      i = this.config.timeout;
    }

    return this.client.testConnection()
      .then(() => {
        i -= TIMEOUT_POLL_DECREMENT;

        if (i <= 0) {
          throw new Error('Timeout waiting for emulator stop');
        }

        if (this.config.service === 'grpc') {
          this.client._setup();
        }

        return new Promise((resolve, reject) => {
          setTimeout(() => {
            this._waitForStop(i).then(resolve, reject);
          }, TIMEOUT_POLL_DECREMENT);
        });
      }, () => {});
  }

  /**
   * Calls a function.
   *
   * @param {string} name The name of the function to call.
   * @param {object} data The data to send to the function.
   * @param {object} opts Optional event fields to send to the function.
   */
  call (name, data, opts) {
    return this.client.callFunction(name, data, opts);
  }

  /**
   * Undeploys all functions.
   *
   * @returns {Promise}
   */
  clear () {
    return this.list()
      .then((cloudfunctions) => Promise.all(cloudfunctions.map((cloudfunction) => this.undeploy(cloudfunction.shortName))));
  }

  clearLogs () {
    logs.clearLogs(this.config.logFile);
  }

  _create (name, opts) {
    return new Promise((resolve, reject) => {
      const cloudfunction = new CloudFunction(CloudFunction.formatName(this.config.projectId, this.config.region, name));

      if (opts.timeout) {
        cloudfunction.timeout = opts.timeout;
      }

      if (opts.entryPoint) {
        cloudfunction.entryPoint = opts.entryPoint;
      }

      if (opts.sourcePath) {
        throw new Error('"source-path" is not supported yet!');
      } else if (opts.localPath) {
        cloudfunction.serviceAccount = path.resolve(opts.localPath);
        return this._createArchive(name, opts)
          .then((sourceArchiveUrl) => {
            cloudfunction.setSourceArchiveUrl(sourceArchiveUrl);
            return cloudfunction;
          })
          .then(resolve, reject);
      }

      throw new Error('One of "local-path" or "source-path" must be set!');
    })
      .then((cloudfunction) => {
        if (opts.triggerHttp) {
          cloudfunction.httpsTrigger = {};
        } else if (opts.triggerProvider) {
          if (opts.triggerProvider === 'cloud.pubsub') {
            opts.triggerEvent || (opts.triggerEvent = 'topic.publish');
          } else if (opts.triggerProvider === 'cloud.storage') {
            opts.triggerEvent || (opts.triggerEvent = 'object.change');
          } else if (opts.triggerProvider === 'google.firebase.database') {
            if (!opts.triggerEvent) {
              throw new Error('Provider google.firebase.database requires trigger event ref.create, ref.update' +
              'ref.delete or ref.write.');
            }
          } else if (opts.triggerProvider === 'google.firebase.auth') {
            if (!opts.triggerEvent) {
              throw new Error('Provider google.firebase.auth requires trigger event user.create or user.delete.');
            }
          } else if (opts.triggerProvider === 'google.firebase.analytics') {
            opts.triggerEvent || (opts.triggerEvent = 'event.log');
          }
          cloudfunction.eventTrigger = {
            eventType: `providers/${opts.triggerProvider}/eventTypes/${opts.triggerEvent}`
          };
          if (opts.triggerResource) {
            cloudfunction.eventTrigger.resource = opts.triggerResource;
          }
        } else {
          throw new Error('You must specify a trigger provider!');
        }

        return this.client.createFunction(cloudfunction);
      });
  }

  /**
   * Enables debugging via --debug or --inspect for the specified function.
   *
   * @param {string} name The name of the function for which to enable debugging.
   * @param {object} opts Configuration options.
   */
  debug (type, name, opts) {
    return this.client.getFunction(name)
      .then(([cloudfunction]) => {
        if (opts.pause) {
          this.log(`You paused execution. Connect to the debugger on port ${opts.port} to resume execution and begin debugging.`);
        }

        return got.post(`http://${this.config.host}:${this.config.supervisorPort}/api/debug`, {
          body: {
            type: type,
            name: cloudfunction.name,
            port: opts.port,
            pause: opts.pause
          },
          json: true
        });
      });
  }

  /**
   * Deploys a function.
   *
   * @param {string} name Intended name of the new function.
   * @param {object} opts Configuration options.
   */
  deploy (name, opts) {
    return this.client.getFunction(name)
      .then(
        () => this.undeploy(name).then(() => this._create(name, opts)),
        (err) => {
          if (err.code === 404 || err.code === 5) {
            return this._create(name, opts);
          }
          return Promise.reject(err);
        }
      );
  }

  /**
   * Gets a function.
   *
   * @param {string} name The name of the function to get.
   */
  describe (name) {
    return this.client.getFunction(name).then(([cloudfunction]) => cloudfunction);
  }

  /**
   * Assert that the Emulator is running.
   *
   * @returns {Promise}
   */
  doIfRunning () {
    return this.status()
      .then((status) => {
        if (status.state !== this.STATE.RUNNING) {
          throw new Error(`${this.name} is not running. Run ${'functions start --help'.bold} for how to start it.`);
        }
      });
  }

  /**
   * Writes to console.error.
   */
  error (...args) {
    console.error(...args);
  }

  // TODO: Use this in the "inspect" CLI command
  getDebuggingUrl () {
    return new Promise((resolve) => {
      setTimeout(() => {
        fs.readFile(this.server.get('logFile'), { encoding: 'utf8' }, (err, content = '') => {
          let matches;

          // Ignore any error
          if (!err) {
            // Attempt to find the Chrome debugging URL in the last 300 characters that were logged
            matches = content.substring(content.length - (this.config.versbose ? 600 : 300)).match(/(chrome-devtools:\/\/devtools\S+)\s/);
          }

          resolve(matches ? matches[1] : undefined);
        });
      }, 500);
    });
  }

  /**
   * Writes lines from the Emulator log file in FIFO order.
   * Lines are taken from the end of the file according to the limit argument.
   * That is, when limit is 10 will return the last (most recent) 10 lines from
   * the log (or fewer if there are fewer than 10 lines in the log), in the order
   * they were written to the log.
   *
   * @param {integer} limit The maximum number of lines to write
   */
  getLogs (limit) {
    if (!limit) {
      limit = 20;
    }

    logs.readLogLines(this.config.logFile, limit, (val) => {
      this.write(val);
    });
  }

  handleError (err) {
    if (err && err.response && err.response.body) {
      if (err.response.body.error) {
        err = err.response.body.error;
      } else {
        err = err.response.body;
      }
    }
    if (Array.isArray(err.errors)) {
      err.errors.forEach((_err) => this.error(`${'ERROR'.red}: ${_err}`));
    } else if (Array.isArray(err.details)) {
      this.error(`${'ERROR'.red}: ${err.stack || err.message}`);
      if (this.config.verbose) {
        this.error(`${'ERROR'.red}: ${JSON.stringify(err, null, 2)}`);
      }
    } else {
      this.error(`${'ERROR'.red}: ${err.stack || err.message}`);
    }
  }

  /**
   * Kills the Emulator process.
   *
   * @returns {Promise}
   */
  kill () {
    return Promise.resolve()
      .then(() => {
        const pid = this.server.get('pid');
        try {
          // Attempt to forcefully end the Emulator process
          process.kill(pid, 'SIGKILL');
        } catch (err) {
          // Ignore any error
        }
        // Remove the PID of the Emulator process
        this.server.delete('pid');
        // Save the current timestamp
        this.server.set('stopped', Date.now());
        if (pid) {
          // Save last known PID
          this.server.set('lastKnownPid', pid);
        }
      });
  }

  /**
   * Lists functions.
   *
   * @returns {Promise}
   */
  list () {
    return this.client.listFunctions().then(([cloudfunctions]) => cloudfunctions);
  }

  /**
   * Writes to console.log.
   */
  log (...args) {
    if (!this.config.tail) {
      console.log(...args);
    }
  }

  /**
   * Undeploys any functions that no longer exist at their specified path.
   *
   * @returns {Promise}
   */
  prune () {
    let tasks;

    return this.list()
      .then((cloudfunctions) => {
        tasks = cloudfunctions.map((cloudfunction) => {
          try {
            fs.statSync(cloudfunction.serviceAccount);
            // Don't return anything
          } catch (err) {
            return this.undeploy(cloudfunction.shortName);
          }
        }).filter((task) => task);

        return Promise.all(tasks);
      })
      .then(() => tasks.length);
  }

  /**
   * Resets a function's worker process.
   *
   * @param {string} name The name of the function to reset.
   * @returns {Promise}
   */
  reset (name, opts) {
    return this.client.getFunction(name)
      .then(([cloudfunction]) => {
        return got.post(`http://${this.config.host}:${this.config.supervisorPort}/api/reset`, {
          body: {
            name: cloudfunction.name,
            keep: opts.keep
          },
          json: true
        });
      });
  }

  /**
   * Starts the Emulator.
   *
   * @returns {Promise}
   */
  start (opts = {}) {
    const CWD = path.join(__dirname, '../..');

    let child;

    if (opts.tail === undefined) {
      opts.tail = this.config.tail;
    }
    if (opts.stdio === undefined) {
      opts.stdio = opts.tail ? 'inherit' : 'ignore';
    }
    if (opts.detached === undefined) {
      opts.detached = !opts.tail;
    }
    if (opts.cwd === undefined) {
      opts.cwd = CWD;
    }

    return Promise.resolve()
      .then(() => {
        // Starting the Emulator amounts to spawning a child node process.
        // The child process will be detached so we don't hold an open socket
        // in the console. The detached process runs an HTTP server (ExpressJS).
        // Communication to the detached process is then done via HTTP
        const args = [
          CWD,
          `--bindHost=${this.config.bindHost}`,
          `--grpcPort=${this.config.grpcPort}`,
          `--host=${this.config.host}`,
          `--timeout=${this.config.timeout}`,
          `--verbose=${this.config.verbose}`,
          `--useMocks=${this.config.useMocks}`,
          `--logFile=${this.config.logFile}`,
          `--restPort=${this.config.restPort}`,
          `--supervisorPort=${this.config.supervisorPort}`,
          `--tail=${this.config.tail}`,
          `--maxIdle=${this.config.maxIdle}`,
          `--idlePruneInterval=${this.config.idlePruneInterval}`,
          `--watch=${this.config.watch}`,
          `--watchIgnore=${this.config.watchIgnore}`
        ];

        // Make sure the child is detached, otherwise it will be bound to the
        // lifecycle of the parent process. This means we should also ignore the
        // binding of stdout.

        child = spawn('node', args, opts);

        // Update status of settings
        this.server.set({
          grpcPort: this.config.grpcPort,
          host: this.config.host,
          logFile: this.config.logFile,
          projectId: this.config.projectId,
          region: this.config.region,
          restPort: this.config.restPort,
          started: Date.now(),
          storage: this.config.storage,
          supervisorPort: this.config.supervisorPort,
          tail: opts.tail,
          useMocks: this.config.useMocks,
          verbose: this.config.verbose,
          version: pkg.version
        });

        return new Promise((resolve, reject) => {
          let done = false;

          child
            .on('exit', (code) => {
              if (!done) {
                done = true;
                clearTimeout(this._timeout);
                reject(new Error('Emulator crashed! Check the log file...'));
              }
            })
            .on('error', (err) => {
              if (!done) {
                done = true;
                console.error('Emulator crashed! Check the log file...');
                clearTimeout(this._timeout);
                reject(err);
              }
            });

          this._waitForStart()
            .then(() => {
              this.server.delete('stopped');
              // Write the pid to the file system in case we need to kill it later
              // This can be done by the user in the 'kill' command
              this.server.set('pid', child.pid);
              if (!done) {
                done = true;
                clearTimeout(this._timeout);
                resolve();
              }
            })
            .catch((err) => {
              if (!done) {
                done = true;
                clearTimeout(this._timeout);
                reject(err);
              }
            });
        });
      })
      .then(() => child);
  }

  /**
   * Returns the current status of the Emulator.
   *
   * @returns {Promise}
   */
  status () {
    return this.client.testConnection()
      .then(() => {
        return { state: STATE.RUNNING, metadata: this.server.all };
      }, (err) => {
        return { state: STATE.STOPPED, metadata: this.server.all, error: err };
      });
  }

  /**
   * Stops the Emulator.
   *
   * @returns {Promise}
   */
  stop () {
    return Promise.resolve()
      .then(() => {
        try {
          // Notify the Emulator process that it needs to stop
          process.kill(this.server.get('pid'), 'SIGTERM');
        } catch (err) {
          // Ignore any error
        }

        // Give the Emulator some time to shutdown gracefully
        return this._waitForStop();
      })
      .then(() => this.kill(), () => this.kill());
  }

  /**
   * Undeploys a function.
   *
   * @param {string} name The name of the function to delete.
   * @returns {Promise}
   */
  undeploy (name) {
    return this.client.deleteFunction(name);
  }

  /**
   * Writes to stdout.
   */
  write (...args) {
    console._stdout.write(...args);
  }
}

module.exports = Controller;
