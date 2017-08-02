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
exports.description = DESCRIPTION;
exports.builder = (yargs) => {
  yargs
    .usage(USAGE)
    .options(_.merge({
      data: {
        description: `Specify inline the JSON data to send to the function. ${'Default:'.bold} ${'{}'.green}`,
        requiresArg: true,
        type: 'string'
      },
      file: {
        alias: 'f',
        description: `${'Emulator-specific:'.bold} Alternative to the ${'--data'.bold} flag. A path to a JSON file to send to the function.`,
        normalize: true,
        requiresArg: true,
        type: 'string'
      }
    }, _.pick(OPTIONS, ['grpcPort', 'host', 'projectId', 'region', 'restPort', 'service'])))
    .epilogue(`See ${'https://github.com/GoogleCloudPlatform/cloud-functions-emulator/wiki/Calling-functions'.bold}`);

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
    .then(() => controller.call(opts.functionName, opts.data))
    .then(([body, response]) => {
      controller.log(`ExecutionId: ${body.executionId}`);
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
