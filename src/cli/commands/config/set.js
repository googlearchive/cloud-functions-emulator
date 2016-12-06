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

const Controller = require('../../controller');

/**
 * http://yargs.js.org/docs/#methods-commandmodule-providing-a-command-module
 */
exports.command = 'set <key> <value>';
exports.describe = 'Set the value for a specific configuration property.';
exports.builder = {};

/**
 * Handler for the "config set" command.
 */
exports.handler = (opts) => {
  const controller = new Controller(opts);
  const config = controller._config;

  try {
    config.set(opts.key, JSON.parse(opts.value));
  } catch (err) {
    config.set(opts.key, opts.value);
  }

  controller.log(`${opts.key.cyan} set to: ${JSON.stringify(opts.value).green}`);
  controller.log('\nYou must restart the emulator for changes to take effect...');
};
