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

const Controller = require('../controller');
const list = require('./list').handler;
const OPTIONS = require('../../options');

const COMMAND = `functions prune ${'[options]'.yellow}`;
const DESCRIPTION = 'Removes any functions known to the emulator but which no longer exist in their corresponding module.';
const USAGE = `Usage:
  ${COMMAND.bold}

Description:
  ${DESCRIPTION}`;

/**
 * http://yargs.js.org/docs/#methods-commandmodule-providing-a-command-module
 */
exports.command = 'prune';
exports.description = DESCRIPTION;
exports.builder = (yargs) => {
  yargs
    .usage(USAGE)
    .options(_.pick(OPTIONS, ['host', 'projectId', 'region', 'restPort', 'service']));
};
exports.handler = (opts) => {
  const controller = new Controller(opts);

  return controller.doIfRunning()
    .then(() => controller.prune())
    .then((count) => controller.log(`${controller.name} ${('PRUNED ' + count + ' function(s)').green}`))
    .then(() => list(opts))
    .catch((err) => controller.handleError(err));
};
