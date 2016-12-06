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
const describe = require('./describe').handler;

/**
 * http://yargs.js.org/docs/#methods-commandmodule-providing-a-command-module
 */
exports.command = 'deploy <functionName>';
exports.describe = 'Deploys a function with the given module path and function name (entry point).';
exports.builder = (yargs) => {
  return yargs.options({
    'entry-point': {
      description: 'The name of the function (as defined in source code) that will be executed.',
      requiresArg: true,
      type: 'string'
    },
    'local-path': {
      alias: 'l',
      default: process.cwd(),
      description: 'Path to local directory with source code. Required with --stage-bucket flag. Defaults to the current working directory.',
      requiresArg: true,
      type: 'string'
    },
    region: {
      default: 'us-central1',
      description: 'The compute region (e.g. us-central1) to use.',
      requiresArg: true,
      type: 'string'
    },
    'source-path': {
      description: 'NOT SUPPORTED. Path to directory with source code in Cloud Source Repositories, when you specify this parameter --source-url flag is required.',
      requiresArg: true,
      type: 'string'
    },
    'stage-bucket': {
      description: 'Name of Google Cloud Storage bucket in which source code will be stored. This or "stage-directory" are required if a function is deployed from a local directory.',
      requiresArg: true,
      type: 'string'
    },
    'stage-directory': {
      default: '/tmp',
      description: 'The emulator supports storing function code on the local filesystem.',
      requiresArg: true,
      type: 'string'
    },
    timeout: {
      description: 'The function execution timeout, e.g. 30s for 30 seconds. Defaults to 60 seconds.',
      requiresArg: true,
      type: 'string'
    },
    'trigger-bucket': {
      description: 'NOT SUPPORTED. Google Cloud Storage bucket name. Every change in files in this bucket will trigger function execution.',
      requiresArg: true,
      type: 'string'
    },
    'trigger-http': {
      description: 'Every HTTP POST request to the function\'s endpoint (web_trigger.url parameter of the deploy output) will trigger function execution. Result of the function execution will be returned in response body.',
      requiresArg: false
    },
    'trigger-topic': {
      description: 'NOT SUPPORTED. Name of Pub/Sub topic. Every message published in this topic will trigger function execution with message contents passed as input data.',
      requiresArg: true,
      type: 'string'
    }
  })
  .implies('stage-bucket', 'local-path')
  .implies('source-path', 'source-url');
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
    .then(() => controller.deploy(opts.functionName, opts))
    .then(() => {
      controller.log(`Function ${opts.functionName} deployed.`.green);
      describe(opts);
    })
    .catch((err) => controller.handleError(err));
};
