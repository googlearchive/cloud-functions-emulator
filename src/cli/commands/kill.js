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

const Controller = require('../controller');

const COMMAND = `functions kill`;
const DESCRIPTION = `Force kills the Emulator process.`;
const USAGE = `Usage:
  ${COMMAND.bold}

Description:
  ${DESCRIPTION}`;

/**
 * http://yargs.js.org/docs/#methods-commandmodule-providing-a-command-module
 */
exports.command = 'kill';
exports.description = DESCRIPTION;
exports.builder = (yargs) => {
  yargs.usage(USAGE);
};
exports.handler = (opts) => {
  const controller = new Controller(opts);

  return controller.kill()
    .then(() => controller.log(`${controller.name} ${'KILLED'.red}`))
    .catch((err) => controller.handleError(err));
};
