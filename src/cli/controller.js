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

const _ = require('lodash');
const archiver = require('archiver');
const Configstore = require('configstore');
const fs = require('fs');
const path = require('path');
const spawn = require('child_process').spawn;
const Storage = require('@google-cloud/storage');
const tmp = require('tmp');

const Client = require('../client');
const Model = require('../model');
const defaults = require('../defaults.json');
const logs = require('../emulator/logs');
const pkg = require('../../package.json');

const { CloudFunction } = Model;

const TIMEOUT_POLL_INCREMENT = 500;
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
    this.server = new Configstore(path.join(pkg.name, '/.active-server'));

    // Load and apply defaults to the user's Emulator configuration
    this._config = new Configstore(path.join(pkg.name, '/config'), defaults);
    // Merge the user's configuration with command-line options
    this.config = _.merge({}, defaults, this._config.all, opts);

    // Ensure we've got a project ID
    this.config.projectId || (this.config.projectId = process.env.GCLOUD_PROJECT);
    if (!this.config.projectId) {
      throw new Error('Please provide a project ID: "functions config set projectId YOUR_PROJECT_ID" or "functions start --projectId YOUR_PROJECT_ID" or "export GCLOUD_PROJECT=YOUR_PROJECT_ID"');
    }

    // We will pipe stdout from the child process to the emulator log file
    this.config.logFile = logs.assertLogsPath(this.config.logFile);

    const clientConfig = _.merge(this.config, {
      grpcHost: this.server.get('grpcHost') || this.config.grpcHost,
      grpcPort: this.server.get('grpcPort') || this.config.grpcPort,
      restHost: this.server.get('restHost') || this.config.restHost,
      restPort: this.server.get('restPort') || this.config.restPort
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
    return new Promise((resolve, reject) => {
      let sourceArchiveUrl;

      opts.localPath = path.resolve(opts.localPath);
      const tmpName = tmp.tmpNameSync({
        prefix: `${opts.region}-${name}-`,
        postfix: '.zip'
      });
      const archive = archiver.create('zip');
      let output;

      if (opts.stageBucket) {
        // Upload the function code to a Google Cloud Storage bucket
        const storage = Storage({ projectId: this.config.projectId });
        const file = storage.bucket(opts.stageBucket).file(path.parse(tmpName).base);
        // The GCS Uri where the .zip will be saved
        sourceArchiveUrl = `gs://${file.bucket.name}/${file.name}`;
        // Stream the file up to Cloud Storage
        output = file.createWriteStream({
          metadata: {
            contentType: 'application/zip'
          }
        });
      } else if (opts.stageDirectory) {
        // Technically, this needs to be a GCS Uri, but the emulator will know
        // how to interpret a path on the local file system
        sourceArchiveUrl = `file://${tmpName}`;
        // Copy the function code to a temp directory on the local file system
        output = fs.createWriteStream(tmpName);
      } else {
        throw new Error('One of "stage-directory" or "stage-bucket" must be set!');
      }

      archive.pipe(output);

      // Find a way to ignore node_modules, and make it configurable
      archive.directory(opts.localPath, false).finalize();

      output
        .on('error', reject);

      archive
        .on('error', reject)
        .on('finish', () => {
          resolve(sourceArchiveUrl);
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
    if (!i) {
      i = this.config.timeout / TIMEOUT_POLL_INCREMENT;
    }

    return this.client.testConnection()
      .catch(() => {
        i--;

        if (i <= 0) {
          throw new Error('Timeout waiting for emulator start'.red);
        }

        return new Promise((resolve, reject) => {
          setTimeout(() => {
            this._waitForStart(i).then(resolve, reject);
          }, TIMEOUT_POLL_INCREMENT);
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
    if (!i) {
      i = this.config.timeout / TIMEOUT_POLL_INCREMENT;
    }

    return this.client.testConnection()
      .then(() => {
        i--;

        if (i <= 0) {
          throw new Error('Timeout waiting for emulator stop');
        }

        return new Promise((resolve, reject) => {
          setTimeout(() => {
            this._waitForStop(i).then(resolve, reject);
          }, TIMEOUT_POLL_INCREMENT);
        });
      }, () => {});
  }

  /**
   * Calls a function.
   *
   * @param {string} name The name of the function to call.
   * @param {object} data The data to send to the function.
   */
  call (name, data) {
    return this.client.callFunction(name, data);
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

  /**
   * Deploys a function.
   *
   * @param {string} name Intended name of the new function.
   * @param {object} opts Configuration options.
   */
  deploy (name, opts) {
    return new Promise((resolve, reject) => {
      const cloudfunction = new CloudFunction(CloudFunction.formatName(this.config.projectId, this.config.region, name));

      if (opts.timeout) {
        cloudfunction.setTimeout(opts.timeout);
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
          } else if (opts.triggerProvider === 'firebase.database') {
            opts.triggerEvent || (opts.triggerEvent = 'data.write');
          } else if (opts.triggerProvider === 'firebase.auth') {
            if (!opts.triggerEvent) {
              throw new Error('Provider firebase.auth requires trigger event user.create or user.delete!');
            }
          }
          cloudfunction.eventTrigger = {
            eventType: `providers/${opts.triggerProvider}/eventTypes/${opts.triggerEvent}`
          };
          if (opts.triggerResource) {
            cloudfunction.eventTrigger.resource = opts.triggerResource;
          }
          if (opts.triggerParams) {
            cloudfunction.eventTrigger.resource = opts.triggerParams;
          }
        } else {
          throw new Error('You must specify a trigger provider!');
        }

        return this.client.createFunction(cloudfunction);
      });
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
          throw new Error(`${this.name} is not running. Run "functions start" to start it.`);
        }
      });
  }

  /**
   * Writes to console.error.
   */
  error (...args) {
    console.error(...args);
  }

  getDebuggingUrl () {
    return new Promise((resolve) => {
      setTimeout(() => {
        fs.readFile(this.server.get('logFile'), { encoding: 'utf8' }, (err, content = '') => {
          let matches;

          // Ignore any error
          if (!err) {
            // Attempt to find the Chrome debugging URL in the last 300 characters that were logged
            matches = content.substring(content.length - 300).match(/(chrome-devtools:\/\/devtools\S+)\s/);
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
    if (Array.isArray(err.errors)) {
      err.errors.forEach((_err) => this.error(`${'ERROR'.red}: ${_err}`));
    } else if (Array.isArray(err.details)) {
      this.error(`${'ERROR'.red}: ${err.message}`);
      this.error(`${'ERROR'.red}: ${JSON.stringify(err, null, 2)}`);
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
        try {
          // Attempt to forcefully end the Emulator process
          process.kill(this.server.get('pid'), 'SIGKILL');
        } catch (err) {
          // Ignore any error
        }
        // Remove the PID of the Emulator process
        this.server.delete('pid');
        // Save the current timestamp
        this.server.set('stopped', Date.now());
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
    console.log(...args);
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
            fs.statSync(cloudfunction.path);
            // Don't return anything
          } catch (err) {
            return this.undeploy(cloudfunction.name);
          }
        }).filter((task) => task);

        return Promise.all(tasks);
      })
      .then(() => tasks.length);
  }

  /**
   * Starts the Emulator.
   *
   * @returns {Promise}
   */
  start () {
    return Promise.resolve()
      .then(() => {
        // Starting the Emulator amounts to spawning a child node process.
        // The child process will be detached so we don't hold an open socket
        // in the console. The detached process runs an HTTP server (ExpressJS).
        // Communication to the detached process is then done via HTTP
        const args = [
          '.',
          `--grpcHost=${this.config.grpcHost}`,
          `--grpcPort=${this.config.grpcPort}`,
          `--projectId=${this.config.projectId}`,
          `--timeout=${this.config.timeout}`,
          `--verbose=${this.config.verbose}`,
          `--useMocks=${this.config.useMocks}`,
          `--logFile=${this.config.logFile}`,
          `--restHost=${this.config.restHost}`,
          `--restPort=${this.config.restPort}`,
          `--runSupervisor=${this.config.runSupervisor}`,
          `--supervisorHost=${this.config.supervisorHost}`,
          `--supervisorPort=${this.config.supervisorPort}`
        ];

        // Only start the Emulator itself in debug or inspect mode if the
        // isolation model is "inprocess"
        if (this.config.isolation === 'inprocess') {
          if (this.config.inspect) {
            args.unshift(`--inspect=${this.config.inspectPort}`);
          } else if (this.config.debug) {
            args.unshift(`--debug=${this.config.debugPort}`);
          }
        } else {
          if (this.config.inspect) {
            args.push(`--inspect=${this.config.inspect}`);
            args.push(`--inspectPort=${this.config.inspectPort}`);
          } else if (this.config.debug) {
            args.push(`--debug=${this.config.debug}`);
            args.push(`--debugPort=${this.config.debugPort}`);
          }
        }

        // Make sure the child is detached, otherwise it will be bound to the
        // lifecycle of the parent process. This means we should also ignore the
        // binding of stdout.
        const out = fs.openSync(this.config.logFile, 'a');
        const child = spawn('node', args, {
          cwd: path.join(__dirname, '../..'),
          detached: true,
          stdio: ['ignore', out, out]
        });

        // Update status of settings
        this.server.set({
          debug: this.config.debug,
          debugPort: this.config.debugPort,
          grpcHost: this.config.grpcHost,
          grpcPort: this.config.grpcPort,
          inspect: this.config.inspect,
          inspectPort: this.config.inspectPort,
          isolation: this.config.isolation,
          logFile: this.config.logFile,
          projectId: this.config.projectId,
          region: this.config.region,
          restHost: this.config.restHost,
          restPort: this.config.restPort,
          runSupervisor: this.config.runSupervisor,
          started: Date.now(),
          storage: this.config.storage,
          supervisorHost: this.config.supervisorHost,
          supervisorPort: this.config.supervisorPort,
          useMocks: this.config.useMocks,
          verbose: this.config.verbose
        });
        this.server.delete('stopped');

        // Write the pid to the file system in case we need to kill it later
        // This can be done by the user in the 'kill' command
        this.server.set('pid', child.pid);

        // Ensure the parent doesn't wait for the child to exit
        // This should be used in combination with the 'detached' property
        // of the spawn() options.  The node documentation is unclear about
        // the behavior of detached & unref on different platforms.  'detached'
        // on Windows seems to do the same thing as unref() on non-Windows
        // platforms.  Doing both seems like the safest approach.
        // TODO: Test on Windows
        child.unref();

        // Ensure the service has started before we notify the caller.
        return this._waitForStart();
      });
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
