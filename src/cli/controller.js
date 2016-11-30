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

const fs = require('fs');
const got = require('got');
const merge = require('lodash.merge');
const net = require('net');
const path = require('path');
const spawn = require('child_process').spawn;

const Configstore = require('configstore');
const defaults = require('../defaults.json');
const logs = require('../emulator/logs');
const pkg = require('../../package.json');

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

    this.STATE = STATE;
    this._config = new Configstore(path.join(pkg.name, '/config'), defaults);
    this.config = merge({}, defaults, this._config.all, opts);
    this.server = new Configstore(path.join(pkg.name, '/.active-server'));
    this.config.functionsPath || (this.config.functionsPath = path.join(pkg.name, '/.functions'));
    this.config.projectId || (this.config.projectId = process.env.GCLOUD_PROJECT);
    // We will pipe stdout from the child process to the emulator log file
    this.config.logFile = logs.assertLogsPath(this.config.logFile);

    this.name = 'Google Cloud Functions Emulator';
  }

  doIfRunning () {
    return this.status()
      .then((status) => {
        if (status.state !== this.STATE.RUNNING) {
          throw new Error(`${this.name} is not running. Run "functions start" to start it.`);
        }
      });
  }

  getEmulatorRootUri () {
    const host = this.server.get('host') || this.config.host;
    const port = this.server.get('port') || this.config.port;

    return `http://${host}:${port}`;
  }

  getEmulatorFuncUri () {
    return `${this.getEmulatorRootUri()}/function/`;
  }

  /**
   * Starts the emulator process.
   */
  start () {
    return Promise.resolve()
      .then(() => {
        const debug = this.config.debug;
        const debugPort = this.config.debugPort;
        const inspect = this.config.inspect;
        const logFile = this.config.logFile;

        // Starting the emulator amounts to spawning a child node process.
        // The child process will be detached so we don't hold an open socket
        // in the console. The detached process runs an HTTP server (ExpressJS).
        // Communication to the detached process is then done via HTTP
        const args = [
          '.',
          '--host',
          this.config.host,
          '--port',
          this.config.port,
          '--projectId',
          this.config.projectId,
          '--timeout',
          this.config.timeout,
          '--verbose',
          this.config.verbose,
          '--useMocks',
          this.config.useMocks,
          '--logFile',
          logFile,
          '--functionsPath',
          this.config.functionsPath
        ];

        // TODO:
        // For some bizzare reason boolean values in the environment of the
        // child process return as Strings in JSON documents sent over HTTP with
        // a content-type of application/json, so we need to check for String
        // 'true' as well as boolean.
        if (inspect === true || inspect === 'true') {
          const semver = process.version.split('.');
          const major = parseInt(semver[0].substring(1, semver[0].length));
          if (major >= 6) {
            args.unshift('--inspect');
            console.log(`Starting in inspect mode. Check ${logFile} for details on how to connect to the chrome debugger.`);
          } else {
            console.error('--inspect flag requires Node 6.3.0+');
          }
        } else if (debug === true || debug === 'true') {
          args.unshift(`--debug=${debugPort}`);
          console.log(`Starting in debug mode. Debugger listening on port ${debugPort}`);
        }

        // Make sure the child is detached, otherwise it will be bound to the
        // lifecycle of the parent process. This means we should also ignore the
        // binding of stdout.
        const out = fs.openSync(logFile, 'a');
        const child = spawn('node', args, {
          cwd: path.join(__dirname, '../..'),
          detached: true,
          stdio: ['ignore', out, out]
        });

        // Update status of settings
        this.server.set({
          debug,
          debugPort,
          functionsPath: this.config.functionsPath,
          host: this.config.host,
          inspect,
          logFile,
          port: this.config.port,
          projectId: this.config.projectId
        });

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
   * Notify the Emulator that it needs to stop and give it a chance to stop
   * gracfully. After a timeout, kill the process.
   */
  stop () {
    return this._action({
      method: 'DELETE',
      url: this.getEmulatorRootUri(),
      timeout: 5000
    })
      .then(() => this._waitForStop())
      .then(() => this.kill(), () => this.kill());
  }

  /**
   * Kills the emulator process by sending a SIGTERM to the child process.
   */
  kill () {
    return Promise.resolve()
      .then(() => {
        process.kill(this.server.get('pid'));
        this.server.clear();
      })
      .catch(() => this.server.clear());
  }

  /**
   * Removes (undeploys) any functions deployed to this emulator.
   */
  clear () {
    return this._action({
      method: 'DELETE',
      url: this.getEmulatorFuncUri()
    });
  }

  /**
   * Removes (undeploys) any functions that no longer exist in their
   * corresponding module.
   */
  prune () {
    return this._action({
      method: 'PATCH',
      url: this.getEmulatorFuncUri()
    });
  }

  /**
   * Checks the status of the child process' service.
   */
  status () {
    return this.testConnection()
      .then(() => {
        return { state: STATE.RUNNING, metadata: this.server.all };
      }, (err) => {
        return { state: STATE.STOPPED, error: err };
      });
  }

  /**
   * Writes lines from the emulator log file to the given writer in FIFO order.
   * Lines are taken from the end of the file according to the limit argument.
   * That is, when limit is 10 will return the last (most recent) 10 lines from
   * the log (or fewer if there are fewer than 10 lines in the log), in the order
   * they were written to the log.
   *
   * @param {object} writer The output writer onto which log lines will be written.
                            Should be an object that exposes a single 'write(String)' method
   * @param {integer} limit The maximum number of lines to write
   */
  getLogs (writer, limit) {
    if (!limit) {
      limit = 20;
    }

    logs.readLogLines(this.config.logFile, limit, (val) => {
      writer.write(val);
    });
  }

  /**
   * Deploys a function to the emulator.
   *
   * @param {string}  modulePath The local file system path (rel or abs) to the
   *                  Node module containing the function to be deployed
   * @param {string}  entryPoint The (case sensitive) name of the function to
   *                  be deployed.  This must be a function that is exported
   *                  from the host module
   * @param {string}  type One of 'H' (HTTP) or 'B' (BACKGROUND).  This
   *                  corresponds to the method used to invoke the function
   *                  (HTTP or direct invocation with a context argument)
   */
  deploy (modulePath, entryPoint, type) {
    return this._action({
      method: 'POST',
      url: `${this.getEmulatorFuncUri()}${entryPoint}?path=${path.resolve(modulePath)}&type=${type}`
    });
  }

  /**
   * Removes a previously deployed function from the emulator.
   *
   * @param {string} name The name of the function to delete.
   */
  undeploy (name) {
    return this._action({
      method: 'DELETE',
      url: `${this.getEmulatorFuncUri()}${name}`
    });
  }

  /**
   * Returns a JSON document containing all deployed functions including any
   * metadata that was associated with the function at deploy time.
   */
  list () {
    return this._action(this.getEmulatorFuncUri());
  }

  /**
   * Describes a single function deployed to the emulator. This includes the
   * function name and associated metadata.
   *
   * @param {string} name The name of the function to describe.
   */
  describe (name) {
    return this._action(`${this.getEmulatorFuncUri()}${name}`);
  }

  /**
   * Causes the function denoted by the given name to be invoked with the given
   * data payload.  If the function is a BACKGROUND function, this will invoke
   * the function directly with the data argument.  If the function is an HTTP
   * function this will perform an HTTP POST with the data argument as the POST
   * body.
   *
   * @param {string} name The (case sensitive) name of the function to be invoked
   * @param {object} data A JSON document representing the function invocation payload
   */
  call (name, data) {
    return this._action({
      data,
      method: 'POST',
      url: `${this.getEmulatorRootUri()}/${name}`,
      raw: true
    });
  }

  _waitForStop (i) {
    if (!i) {
      i = this.config.timeout / TIMEOUT_POLL_INCREMENT;
    }

    return this.testConnection()
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

  _waitForStart (i) {
    if (!i) {
      i = this.config.timeout / TIMEOUT_POLL_INCREMENT;
    }

    return this.testConnection()
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

  testConnection () {
    const host = this.server.get('host') || this.config.host;
    const port = this.server.get('port') || this.config.port;

    return new Promise((resolve, reject) => {
      const client = net.connect(port, host, () => {
        client.end();
        resolve();
      });
      client.on('error', reject);
    });
  }

  _action (opts = {}) {
    if (typeof opts === 'string') {
      opts = {
        url: opts
      };
    }
    opts.method || (opts.method = 'GET');
    opts.json = true;

    if (opts.method === 'POST' && opts.data) {
      if (opts.data.toString() === '[object String]' || typeof opts.data === 'string') {
        opts.body = JSON.parse(opts.data);
      } else {
        // Assume object
        opts.body = opts.data;
      }
    }

    let raw = opts.raw;
    delete opts.raw;

    return got(opts.url, opts).then((response) => raw ? response : response.body);
  }
}

module.exports = Controller;
