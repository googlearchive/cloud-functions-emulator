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
    .options(_.merge(_.pick(OPTIONS, ['grpcPort', 'host', 'projectId', 'region', 'restPort', 'service']), {
      'local-path': {
        alias: 'l',
        description: `Path to local directory with source code. ${'Default:'.bold} ${process.cwd().green} (the current working directory)`,
        requiresArg: true,
        type: 'string'
      },
      'trigger-bucket': {
        alias: 'B',
        description: `Google Cloud Storage bucket name. Every change in files in this bucket will trigger function execution. Short for --trigger-provider=cloud.storage --trigger-event=object.change --trigger-resource=<bucket>.`,
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
        description: `Name of Pub/Sub topic. Every message published in this topic will trigger function execution with message contents passed as input data. Short for --trigger-provider=cloud.pubsub --trigger-event=topic.publish --trigger-resource=<topic>.`,
        requiresArg: true,
        type: 'string'
      },
      'entry-point': {
        alias: 'e',
        description: `${'Optional'.bold}. The name of the function exported in the source code that should be deployed.`,
        requiresArg: true,
        type: 'string'
      },
      timeout: {
        alias: 't',
        default: '60s',
        description: `${'Optional'.bold}. The function execution timeout, e.g. 30s for 30 seconds. Defaults to 60 seconds.`,
        requiresArg: true,
        type: 'string'
      },
      'trigger-event': {
        choices: ['topic.publish', 'object.change', 'user.create', 'user.delete', 'ref.write', 'ref.create', 'ref.update', 'ref.delete', 'event.log', undefined],
        description: 'Specifies which action should trigger the function. If omitted, a default EVENT_TYPE for --trigger-provider will be used if it is available. For a list of acceptable values, call functions event_types list. EVENT_TYPE must be one of: topic.publish, object.change, user.create, user.delete, ref.write, ref.create, ref.update, ref.delete, event.log.',
        requiresArg: true,
        type: 'string',
        required: false
      },
      'trigger-provider': {
        choices: ['cloud.pubsub', 'cloud.storage', 'google.firebase.auth', 'google.firebase.database', 'google.firebase.analytics', undefined],
        description: 'Trigger this function in response to an event in another service. For a list of acceptable values, call gcloud functions event-types list. PROVIDER must be one of: cloud.pubsub, cloud.storage, google.firebase.auth, google.firebase.database, google.firebase.analytics',
        requiresArg: true,
        type: 'string',
        required: false
      },
      'trigger-resource': {
        description: 'Specifies which resource from --trigger-provider is being observed. E.g. if --trigger-provider is cloud.storage, --trigger-resource must be a bucket name. For a list of expected resources, call functions event_types list.',
        requiresArg: true,
        type: 'string',
        required: false
      },
      'stage-bucket': {
        alias: 's',
        description: `${'Optional'.bold}. Name of Google Cloud Storage bucket in which source code will be stored.`,
        requiresArg: true,
        type: 'string'
      }
    }))
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
  opts.timeout = calculateTimeout(opts.timeout);

  // Only deploy if the Emulator is running
  return controller.doIfRunning()
    // Deploy the function
    .then(() => controller.deploy(opts.functionName, opts))
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
                  reject(operation.error || new Error('Deployment failed'));
                }
              }
            });
        }

        controller.write('Deploying function');
        poll();
      })
      .then(() => controller.write('done.\n'))
      .catch((err) => {
        controller.write('failed.\n');
        return Promise.reject(err);
      });
    })
    // Log the status
    .then(() => controller.log(`Function ${opts.functionName} deployed.`.green))
    // Print the function details
    .then(() => describe(opts))
    .catch((err) => controller.handleError(err));
};

function calculateTimeout (timeout) {
  // The default is 60 seconds
  const DEFAULT = { seconds: 60 * 1000 };
  const MAX = { seconds: 9 * 60 * 1000 };

  if (!timeout) {
    return DEFAULT;
  }

  if (typeof timeout === 'string') {
    let matches = timeout.match(/^(\d+)s$/);
    if (matches && matches[1] && typeof matches[1] === 'string') {
      const timeout = parseFloat(matches[1]);
      if (!isNaN(timeout)) {
        if (timeout > MAX.seconds) {
          console.error(`Maximum allowed timeout is 9 minutes.`);
          return MAX;
        }
        return { seconds: timeout };
      }
    }

    matches = timeout.match(/^(\d+)ms$/);
    if (matches && matches[1] && typeof matches[1] === 'string') {
      const timeout = parseFloat(matches[1]) / 1000;
      if (!isNaN(timeout)) {
        if (timeout > MAX.seconds) {
          console.error(`Maximum allowed timeout is 9 minutes.`);
          return MAX;
        }
        return { seconds: timeout };
      }
    }
  }

  console.error(`Function configured with invalid timeout: ${timeout}. Reverting to default of 60 seconds.`);
  return DEFAULT;
}
