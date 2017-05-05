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

const COMMAND = `functions inspect ${'<functionName>'.yellow} ${'[options]'.yellow}`;
const DESCRIPTION = `Enables debugging for the specified function using Node's ${'--inspect'.bold} flag.`;
const USAGE = `Usage:
  ${COMMAND.bold}

Description:
  ${DESCRIPTION}

Positional arguments:
  ${'functionName'.bold}
    The name of the function for which to enable debugging via ${'--inspect'.bold}.`;

/**
 * http://yargs.js.org/docs/#methods-commandmodule-providing-a-command-module
 */
exports.command = 'inspect <functionName>';
exports.description = DESCRIPTION;
exports.builder = (yargs) => {
  yargs
    .usage(USAGE)
    .options(_.merge({
      pause: {
        default: false,
        description: `Whether to start the function using ${'--debug-brk'.bold}, pausing execution until you connect to the debugger and resume execution manually. This allows you to debug your function setup code.`,
        type: 'boolean'
      },
      port: {
        default: 9229,
        description: `The port for the Node.js ${'--inspect'.bold} debugger.`,
        requiresArg: true,
        type: 'number'
      }
    }, _.pick(OPTIONS, ['grpcPort', 'host', 'projectId', 'region', 'restPort', 'service'])))
    .epilogue(`See ${'https://github.com/GoogleCloudPlatform/cloud-functions-emulator/wiki/Debugging-functions'.bold}`);

  EXAMPLES['inspect'].forEach((e) => yargs.example(e[0], e[1]));
};
exports.handler = (opts) => {
  const controller = new Controller(opts);

  return controller.doIfRunning()
    .then(() => controller.debug('inspect', opts.functionName, opts))
    .then(() => controller.log(`Debugger for ${opts.functionName} listening on port ${opts.port}.`))
    .catch((err) => controller.handleError(err));
};
