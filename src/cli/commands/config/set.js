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

const config = require('../../../config');
const configCommand = require('./');
const Controller = require('../../controller');
const EXAMPLES = require('../../examples');

const COMMAND = `functions config set ${'<key>'.yellow} ${'<value>'.yellow}`;
const DESCRIPTION = `Sets the value for a setting.`;
const USAGE = `Usage:
  ${COMMAND.bold}

Description:
  ${DESCRIPTION}

Positional arguments:
  ${'key'.bold}
    The name of the key to update.

  ${'value'.bold}
    The new value for the key. Must be a valid JSON value.`;

/**
 * http://yargs.js.org/docs/#methods-commandmodule-providing-a-command-module
 */
exports.command = 'set <key> <value>';
exports.description = DESCRIPTION;
exports.builder = (yargs) => {
  yargs
    .usage(USAGE)
    .epilogue(configCommand.helpMessage);

  EXAMPLES['config.set'].forEach((e) => yargs.example(e[0], e[1]));
};
exports.handler = (opts) => {
  const controller = new Controller(opts);

  try {
    config.set(opts.key, JSON.parse(opts.value));
  } catch (err) {
    config.set(opts.key, opts.value);
  }

  controller.log(`${opts.key.bold} set to: ${JSON.stringify(opts.value).green}`);
  controller.log('\nYou must restart the Emulator for changes to take effect...');
};
