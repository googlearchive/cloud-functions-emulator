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

const Controller = require('../controller');
const list = require('./list').handler;
const utils = require('../utils');

/**
 * http://yargs.js.org/docs/#methods-commandmodule-providing-a-command-module
 */
exports.command = 'delete <functionName>';
exports.describe = 'Undeploys a previously deployed function (does NOT delete the function source code).';
exports.builder = {};

/**
 * Handler for the "delete" command.
 *
 * @param {object} opts Configuration options.
 * @param {string} opts.functionName The name of the function to delete.
 */
exports.handler = (opts) => {
  const controller = new Controller(opts);

  return controller.doIfRunning()
    .then(() => controller.undeploy(opts.functionName))
    .then(() => {
      utils.writer.log(`Function ${opts.functionName} deleted.`.green);
      list(opts);
    })
    .catch(utils.handleError);
};
