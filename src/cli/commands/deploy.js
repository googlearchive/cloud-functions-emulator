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
    'trigger-event': {
      choices: ['topic.publish', 'object.change', 'user.create', 'user.delete', 'data.write'],
      description: 'Specifies which action should trigger the function. If omitted, a default EVENT_TYPE for --trigger-provider will be used. For a list of acceptable values, call functions event_types list. EVENT_TYPE must be one of: topic.publish, object.change, user.create, user.delete, data.write.',
      requiresArg: true,
      type: 'string'
    },
    'trigger-http': {
      description: `Every HTTP POST request to the function's endpoint (web_trigger.url parameter of the deploy output) will trigger function execution. Result of the function execution will be returned in response body.`,
      requiresArg: false
    },
    'trigger-params': {
      description: `Specifies \nadditional\n parameters. For example --trigger-params path specifies which sub-path within --trigger-resource is being observed. Paths may contain named wildcards by surrounding components with curly brackets, e.g. literal/{wildcard}/anotherLiteral. In this case, the value of all wildcards is included in the event as "params". Not all --trigger-providers support a --trigger-param path. For a list of services which support --trigger-param path, call functions event_types list.`,
      requiresArg: false
    },
    'trigger-provider': {
      choices: ['cloud.pubsub', 'cloud.storage', 'firebase.auth', 'firebase.database'],
      description: 'Trigger this function in response to an event in another service. For a list of acceptable values, call gcloud functions event-types list. PROVIDER must be one of: cloud.pubsub, cloud.storage, firebase.auth, firebase.database.',
      requiresArg: true,
      type: 'string'
    },
    'trigger-resource': {
      description: 'Specifies which resource from --trigger-provider is being observed. E.g. if --trigger-provider is cloud.storage, --trigger-resource must be a bucket name. For a list of expected resources, call functions event_types list.',
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
