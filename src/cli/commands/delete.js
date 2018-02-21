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
    .options(_.pick(OPTIONS, ['host', 'projectId', 'region', 'restPort', 'service']));

  EXAMPLES['delete'].forEach((e) => yargs.example(e[0]));
};
exports.handler = (opts) => {
  const controller = new Controller(opts);

  return controller.doIfRunning()
    .then(() => controller.undeploy(opts.functionName))
    .then(([operation, response]) => {
      // Poll the operation
      return new Promise((resolve, reject) => {
        function poll () {
          controller.write('.');
          controller.client.getOperation(operation.name)
            .then(([operation]) => {
              if (!operation.done) {
                setTimeout(poll, 500);
              } else {
                if (operation.response) {
                  resolve(operation.response);
                } else {
                  reject(operation.error || new Error('Delete failed'));
                }
              }
            });
        }

        controller.write('Deleting function');
        poll();
      })
        .then(() => controller.write('done.\n'))
        .catch((err) => {
          controller.write('failed.\n');
          return Promise.reject(err);
        });
    })
    .then(() => controller.log(`Function ${opts.functionName} deleted.`.green))
    .then(() => list(opts))
    .catch((err) => controller.handleError(err));
};
