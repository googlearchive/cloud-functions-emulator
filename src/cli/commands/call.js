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
const fs = require('fs');

const Controller = require('../controller');
const EXAMPLES = require('../examples');
const OPTIONS = require('../../options');

const COMMAND = `functions call ${'<functionName>'.yellow} ${'[options]'.yellow}`;
const DESCRIPTION = `Invokes a function. You must specify either the ${'data'.bold} or the ${'file'.bold} option.`;
const USAGE = `Usage:
  ${COMMAND.bold}

Description:
  ${DESCRIPTION}

Positional arguments:
  ${'functionName'.bold}
    The name of the function to invoke.`;

/**
 * http://yargs.js.org/docs/#methods-commandmodule-providing-a-command-module
 */
exports.command = 'call <functionName>';
exports.desecription = DESCRIPTION;
exports.builder = (yargs) => {
  yargs
    .usage(USAGE)
    .demand(1)
    .options(_.merge({
      data: {
        description: `Specify inline the JSON data to send to the function. ${'Default:'.bold} ${'{}'.green}`,
        requiresArg: true,
        type: 'string'
      },
      file: {
        alias: 'f',
        description: 'A path to a JSON file to send to the function.',
        normalize: true,
        requiresArg: true,
        type: 'string'
      }
    }, _.pick(OPTIONS, ['grpcHost', 'grpcPort', 'projectId', 'region', 'service', 'restHost', 'restPort'])));

  EXAMPLES['call'].forEach((e) => yargs.example(e[0], e[1]));
};
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
    opts.data = {};
  }

  const controller = new Controller(opts);

  return controller.doIfRunning()
    .then(() => {
      if (controller.server.get('inspect')) {
        controller.getDebuggingUrl().then((debugUrl) => {
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

      return controller.call(opts.functionName, opts.data);
    })
    .then(([body, response]) => {
      controller.log(`ExecutionId: ${body.executionId}`);
      if (!controller.server.get('inspect') && !controller.server.get('debug')) {
        controller.log(`Function completed in: ${response.headers['x-response-time'].green}`);
      }
      if (body.result) {
        if (body.result.body && body.result.statusCode && body.result.headers) {
          try {
            body.result.body = JSON.parse(body.result.body);
          } catch (err) {

          }
          if (body.result.statusCode >= 200 && body.result.statusCode < 400) {
            controller.log('Result:', body.result.body);
          } else {
            controller.log(`Error: ${body.result.statusCode}`, body.result.body);
          }
        } else {
          controller.log('Result:', body.result);
        }
      } else if (body.error) {
        if (body.error.stack) {
          controller.log('Error:', body.error.stack);
        } else {
          controller.log('Error:', body.error);
        }
      }
    })
    .catch((err) => controller.handleError(err));
};
