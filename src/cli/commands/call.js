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
const utils = require('../utils');

/**
 * http://yargs.js.org/docs/#methods-commandmodule-providing-a-command-module
 */
exports.command = 'call <functionName>';
exports.describe = 'Invokes a function. You must specify either the "data" or the "file" option.';
exports.builder = {
  data: {
    alias: 'd',
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
  if (!opts.file && !opts.data) {
    opts.data = '{}';
  }

  if (opts.data) {
    try {
      opts.data = JSON.parse(opts.data);
    } catch (err) {
      throw new Error('"data" must be a valid JSON string!');
    }
  } else if (opts.file) {
    opts.data = fs.readFileSync(opts.file, 'utf8');
  } else {
    throw new Error('You must specify a "data" or "file" option!');
  }

  const contoller = new Controller(opts);

  return contoller.doIfRunning()
    .then(() => contoller.call(opts.functionName, opts.data))
    .then((response) => {
      utils.writer.write('Function completed in:  ');
      utils.writer.write((response.headers['x-response-time'] + '\n').green);

      utils.writer.log(response.body);
    })
    .catch(utils.handleError);
};
