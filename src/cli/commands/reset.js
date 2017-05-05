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
const EXAMPLES = require('../examples');
const OPTIONS = require('../../options');

const COMMAND = `functions reset ${'<functionName>'.yellow} ${'[options]'.yellow}`;
const DESCRIPTION = `Restarts the specified function by shutting down its worker(s), forcing a "cold start".`;
const USAGE = `Usage:
  ${COMMAND.bold}

Description:
  ${DESCRIPTION}

Positional arguments:
  ${'functionName'.bold}
    The name of the function to reset.`;

/**
 * http://yargs.js.org/docs/#methods-commandmodule-providing-a-command-module
 */
exports.command = 'reset <functionName>';
exports.description = DESCRIPTION;
exports.builder = (yargs) => {
  yargs
    .usage(USAGE)
    .options(_.merge({
      keep: {
        alias: 'k',
        default: false,
        description: `If ${'true'.bold}, keep the function's debugging settings, if any.`,
        type: 'boolean'
      }
    }, _.pick(OPTIONS, ['grpcPort', 'host', 'projectId', 'region', 'restPort', 'service'])))
    .epilogue(`See ${'https://github.com/GoogleCloudPlatform/cloud-functions-emulator/wiki/Debugging-functions'.bold}`);

  EXAMPLES['reset'].forEach((e) => yargs.example(e[0], e[1]));
};
exports.handler = (opts) => {
  const controller = new Controller(opts);

  return controller.doIfRunning()
    .then(() => controller.reset(opts.functionName, opts))
    .then(() => controller.log(`Function ${opts.functionName} reset.`))
    .catch((err) => controller.handleError(err));
};
