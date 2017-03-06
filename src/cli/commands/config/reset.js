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
const defaults = require('../../../defaults');

const COMMAND = `functions config reset`;
const DESCRIPTION = `Resets configuration to default values, with the exception of ${'projectId'.bold}, which is left alone.`;
const USAGE = `Usage:
  ${COMMAND.bold}

Description:
  ${DESCRIPTION}`;

/**
 * http://yargs.js.org/docs/#methods-commandmodule-providing-a-command-module
 */
exports.command = 'reset';
exports.description = DESCRIPTION;
exports.builder = (yargs) => {
  yargs
    .usage(USAGE)
    .epilogue(configCommand.helpMessage);
};
exports.handler = (opts) => {
  const controller = new Controller(opts);

  for (let key in config.all) {
    if (key !== 'projectId') {
      config.delete(key);
      if (key in defaults) {
        config.set(key, defaults[key]);
      }
    }
  }

  controller.log(`Configuration reset to defaults.`);
  controller.log('\nYou must restart the Emulator for changes to take effect...');
};
