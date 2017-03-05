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

const _ = require('lodash');

const Controller = require('../controller');
const EXAMPLES = require('../examples');
const list = require('./list').handler;
const OPTIONS = require('../../options');

const COMMAND = `functions delete ${'<functionName>'.yellow} ${'[options]'.yellow}`;
const DESCRIPTION = `Undeploys a deployed function (does NOT delete the function source code).`;
const USAGE = `Usage:
  ${COMMAND.bold}

Description:
  ${DESCRIPTION}

Positional arguments:
  ${'functionName'.bold}
    The name of the function to undeploy.`;

/**
 * http://yargs.js.org/docs/#methods-commandmodule-providing-a-command-module
 */
exports.command = 'delete <functionName>';
exports.description = DESCRIPTION;
exports.builder = (yargs) => {
  yargs
    .usage(USAGE)
    .options(_.pick(OPTIONS, ['grpcHost', 'grpcPort', 'projectId', 'region', 'service', 'restHost', 'restPort']));

  EXAMPLES['delete'].forEach((e) => yargs.example(e[0], e[1]));
};
exports.handler = (opts) => {
  const controller = new Controller(opts);

  return controller.doIfRunning()
    .then(() => controller.undeploy(opts.functionName))
    .then(() => {
      controller.log(`Function ${opts.functionName} deleted.`.green);
      list(opts);
    })
    .catch((err) => controller.handleError(err));
};
