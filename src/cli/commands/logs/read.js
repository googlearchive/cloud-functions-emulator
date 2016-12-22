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
const EXAMPLES = require('../../examples');

const COMMAND = `functions logs read ${'[options]'.yellow}`;
const DESCRIPTION = 'Show logs produced by functions.';
const USAGE = `Usage:
  ${COMMAND.bold}

Description:
  ${DESCRIPTION}`;

/**
 * http://yargs.js.org/docs/#methods-commandmodule-providing-a-command-module
 */
exports.command = 'read';
exports.description = DESCRIPTION;
exports.builder = (yargs) => {
  yargs
    .usage(USAGE)
    .options({
      limit: {
        alias: 'l',
        default: 20,
        description: 'Number of log entries to be fetched.',
        type: 'number',
        requiresArg: true
      }
    });

  EXAMPLES['logs.read'].forEach((e) => yargs.example(e[0], e[1]));
};
exports.handler = (opts) => {
  const controller = new Controller(opts);

  let limit = 20;
  if (opts && opts.limit) {
    limit = parseInt(opts.limit, 10);
  }
  controller.getLogs(limit);
};
