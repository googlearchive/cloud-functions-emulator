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
    .options(_.merge({
      'entry-point': {
        alias: 'e',
        description: `${'Optional'.bold}. The name of the function exported in the source code that should be deployed.`,
        requiresArg: true,
        type: 'string'
      },
      'local-path': {
        alias: 'l',
        description: `Path to local directory with source code. ${'Default:'.bold} ${process.cwd().green} (the current working directory)`,
        requiresArg: true,
        type: 'string'
      },
      'stage-bucket': {
        alias: 's',
        description: `${'Optional'.bold}. Name of Google Cloud Storage bucket in which source code will be stored.`,
        requiresArg: true,
        type: 'string'
      },
      timeout: {
        alias: 't',
        description: `${'Optional'.bold}. The function execution timeout, e.g. 30s for 30 seconds. Defaults to 60 seconds.`,
        requiresArg: true,
        type: 'string'
      },
      // 'trigger-event': {
      //   choices: ['topic.publish', 'object.change', 'user.create', 'user.delete', 'data.write'],
      //   description: 'Specifies which action should trigger the function. If omitted, a default EVENT_TYPE for --trigger-provider will be used. For a list of acceptable values, call functions event_types list. EVENT_TYPE must be one of: topic.publish, object.change, user.create, user.delete, data.write.',
      //   requiresArg: true,
      //   type: 'string'
      // },
      'trigger-bucket': {
        alias: 'B',
        description: `Google Cloud Storage bucket name. Every change in files in this bucket will trigger function execution.`,
        requiresArg: true,
        type: 'string'
      },
      'trigger-http': {
        alias: 'H',
        description: `Every HTTP request to the function's endpoint will trigger function execution. Result of the function execution will be returned in response body.`,
        requiresArg: false
      },
      'trigger-topic': {
        alias: 'T',
        description: `Name of Pub/Sub topic. Every message published in this topic will trigger function execution with message contents passed as input data.`,
        requiresArg: true,
        type: 'string'
      // },
      // 'trigger-provider': {
      //   choices: ['cloud.pubsub', 'cloud.storage', 'firebase.auth', 'firebase.database'],
      //   description: 'Trigger this function in response to an event in another service. For a list of acceptable values, call gcloud functions event-types list. PROVIDER must be one of: cloud.pubsub, cloud.storage, firebase.auth, firebase.database.',
      //   requiresArg: true,
      //   type: 'string'
      // },
      // 'trigger-resource': {
      //   description: 'Specifies which resource from --trigger-provider is being observed. E.g. if --trigger-provider is cloud.storage, --trigger-resource must be a bucket name. For a list of expected resources, call functions event_types list.',
      //   requiresArg: true,
      //   type: 'string'
      }
    }, _.pick(OPTIONS, ['projectId', 'region'])))
    .epilogue(`See ${'https://github.com/GoogleCloudPlatform/cloud-functions-emulator/wiki/Deploying-functions'.bold}`);

  EXAMPLES['deploy'].forEach((e) => yargs.example(e[0]));
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

  // Only deploy if the Emulator is running
  return controller.doIfRunning()
    // Deploy the function
    .then(() => controller.deploy(opts.functionName, opts))
    // Log the status
    .then(() => controller.log(`Function ${opts.functionName} deployed.`.green))
    // Print the function details
    .then(() => describe(opts))
    .catch((err) => controller.handleError(err));
};
