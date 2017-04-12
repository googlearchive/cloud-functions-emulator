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

const _ = require(`lodash`);
const spawnSync = require(`child_process`).spawnSync;
const path = require(`path`);

const env = _.cloneDeep(process.env);

env.XDG_CONFIG_HOME = path.join(__dirname, `../`);

exports.run = (cmd, cwd) => {
  const output = spawnSync(cmd, {
    cwd,
    env,
    shell: true,
    timeout: 60000
  });

  return output.stdout.toString().trim() + output.stderr.toString().trim();
};

class Try {
  constructor (test) {
    this._maxTries = 10;
    this._maxDelay = 20000;
    this._timeout = 60000;
    this._iteration = 1;
    this._multiplier = 1.3;
    this._delay = 500;
    this._test = test;
  }

  execute () {
    if (this._iteration >= this._maxTries) {
      this.reject(this._error || new Error('Reached maximum number of tries'));
      return;
    } else if ((Date.now() - this._start) >= this._timeout) {
      this.reject(this._error || new Error('Test timed out'));
      return;
    }

    try {
      this._test();
      this.resolve();
    } catch (err) {
      this._error = err;
      this._iteration++;
      this._delay = Math.min(this._delay * this._multiplier, this._maxDelay);
      setTimeout(() => this.execute(), this._delay);
    }
  }

  timeout (timeout) {
    this._timeout = timeout;
  }

  tries (maxTries) {
    this._maxTries = maxTries;
  }

  start () {
    this._start = Date.now();
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
      this.execute();
    });
    return this.promise;
  }
}

exports.tryTest = (test) => {
  return new Try(test);
};
