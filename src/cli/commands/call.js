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

const fs = require('fs');

const Controller = require('../controller');

/**
 * http://yargs.js.org/docs/#methods-commandmodule-providing-a-command-module
 */
exports.command = 'call <functionName>';
exports.describe = 'Invokes a function. You must specify either the "data" or the "file" option.';
exports.builder = {
  data: {
    default: '{}',
    description: 'Specify inline the JSON data to send to the function.',
    requiresArg: true,
    type: 'string'
  },
  file: {
    alias: 'f',
    description: 'A path to a JSON file to send to the function.',
    normalize: true,
    requiresArg: true,
    type: 'string'
  },
  region: {
    default: 'us-central1',
    description: 'The compute region (e.g. us-central1) to use.',
    requiresArg: true,
    type: 'string'
  }
};

/**
 * Handler for the "call" command.
 *
 * @param {object} opts Configuration options.
 * @param {string} opts.functionName The name of the function to call.
 * @param {string} [opts.data] TODO.
 * @param {string} [opts.file] TODO.
 */
exports.handler = (opts) => {
  if (opts.file) {
    try {
      opts.data = JSON.parse(fs.readFileSync(opts.file, 'utf8'));
    } catch (err) {
      throw new Error('"data" must be a valid JSON string!');
    }
  } else if (opts.data) {
    try {
      opts.data = JSON.parse(opts.data);
    } catch (err) {
      throw new Error('"data" must be a valid JSON string!');
    }
  } else {
    throw new Error('You must specify a "data" or "file" option!');
  }

  const controller = new Controller(opts);

  return controller.doIfRunning()
    .then(() => {
      let promise;

      if (controller.server.get('inspect')) {
        promise = controller.getDebuggingUrl().then((debugUrl) => {
          let debugStr = `Function execution paused. Connect to the debugger on port ${controller.server.get('inspectPort')} (e.g. using the "node2" launch type in VSCode), or open the following URL in Chrome:`;
          if (debugUrl) {
            // If found, include it in the string that gets printed
            debugStr += `\n\n    ${debugUrl}\n`;
          } else {
            debugStr += `\n\nError: Could not find Chrome debugging URL in log file. Look for it yourself in ${controller.server.get('logFile')}.`;
          }
          console.log(debugStr);
        });
      } else if (controller.server.get('debug')) {
        console.log(`Function execution paused. Connect to the debugger on port ${controller.server.get('debugPort')} (e.g. using the "node" launch type in VSCode).\n`);
      }

      return (promise || Promise.resolve()).then(() => controller.call(opts.functionName, opts.data));
    })
    .then(([body, response]) => {
      controller.log(`ExecutionId: ${body.executionId}`);
      if (!controller.server.get('inspect') && !controller.server.get('debug')) {
        controller.log(`Function completed in: ${response.headers['x-response-time'].green}`);
      }
      if (body.result) {
        controller.log('Result:', body.result);
      } else if (body.error) {
        controller.log('Error:', body.error);
      } else {
        throw new Error('Unknown response!');
      }
    })
    .catch((err) => controller.handleError(err));
};
