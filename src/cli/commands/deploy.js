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
const os = require('os');

const Controller = require('../controller');
const describe = require('./describe').handler;
const EXAMPLES = require('../examples');
const OPTIONS = require('../../options');

const COMMAND = `functions deploy ${'<functionName>'.yellow} ${'[options]'.yellow}`;
const DESCRIPTION = `Deploys a function.`;
const USAGE = `Usage:
  ${COMMAND.bold}

Description:
  ${DESCRIPTION}

Positional arguments:
  ${'functionName'.bold}
    The name of the function to deploy.`;

/**
 * http://yargs.js.org/docs/#methods-commandmodule-providing-a-command-module
 */
exports.command = 'deploy <functionName>';
exports.description = DESCRIPTION;
exports.builder = (yargs) => {
  yargs
    .usage(USAGE)
    .demand(1)
    .options(_.merge({
      'entry-point': {
        description: 'The name of the function exported in the source code that will be executed.',
        requiresArg: true,
        type: 'string'
      },
      'local-path': {
        alias: 'l',
        description: `Path to local directory with source code. Required with --stage-bucket flag. ${'Default:'.bold} ${process.cwd().green} (the current working directory)`,
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
        description: `The emulator supports storing function code on the local filesystem. ${'Default:'.bold} ${os.tmpdir().green}`,
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
    }, _.pick(OPTIONS, ['grpcHost', 'grpcPort', 'projectId', 'region', 'service', 'restHost', 'restPort'])))
    .implies('stage-bucket', 'local-path')
    .implies('source-path', 'source-url');

  EXAMPLES['deploy'].forEach((e) => yargs.example(e[0], e[1]));
};
exports.handler = (opts) => {
  opts.localPath || (opts.localPath = process.cwd());

  if (opts.triggerBucket) {
    opts.triggerProvider = 'cloud.storage';
    opts.triggerEvent = 'object.change';
    opts.triggerResource = opts.triggerBucket;
  } else if (opts.triggerTopic) {
    opts.triggerProvider = 'cloud.pubsub';
    opts.triggerEvent = 'topic.publish';
    opts.triggerResource = opts.triggerTopic;
  }

  const controller = new Controller(opts);

  opts.region || (opts.region = controller.config.region);

  return controller.doIfRunning()
    .then(() => {
      return controller.deploy(opts.functionName, opts);
    })
    .then(() => {
      controller.log(`Function ${opts.functionName} deployed.`.green);
      describe(opts);
    })
    .catch((err) => controller.handleError(err));
};
