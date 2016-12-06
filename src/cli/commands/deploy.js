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
const utils = require('../utils');

/**
 * http://yargs.js.org/docs/#methods-commandmodule-providing-a-command-module
 */
exports.command = 'deploy <functionName> <modulePath>';
exports.describe = 'Deploys a function with the given module path and function name (entry point).';
exports.builder = {
  'trigger-http': {
    alias: 't',
    description: 'Deploys the function as an HTTP function.',
    requiresArg: false
  }
};

/**
 * Handler for the "deploy" command.
 *
 * @param {object} opts Configuration options.
 * @param {string} opts.functionName The name of the function to deploy.
 * @param {string} opts.modulePath TODO.
 * @param {boolean} [opts.trigger-http] TODO.
 */
exports.handler = (opts) => {
  const controller = new Controller(opts);

  return controller.doIfRunning()
    .then(() => {
      const type = (opts['trigger-http'] === true) ? 'H' : 'B';
      return controller.deploy(opts.modulePath, opts.functionName, type);
    })
    .then((body) => {
      utils.writer.log(`Function ${opts.functionName} deployed.`.green);
      utils.printDescribe(body);
    })
    .catch(utils.handleError);
};
