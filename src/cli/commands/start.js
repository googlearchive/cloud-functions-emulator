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
const list = require('./list').handler;
const utils = require('../utils');

/**
 * http://yargs.js.org/docs/#methods-commandmodule-providing-a-command-module
 */
exports.command = 'start';
exports.describe = 'Starts the emulator.';
exports.builder = {
  debug: {
    alias: 'd',
    description: 'Start the emulator in debug mode.',
    type: 'boolean',
    requiresArg: false
  },
  debugPort: {
    alias: 'D',
    description: 'Override to change the default debug port.',
    requiresArg: true,
    type: 'number'
  },
  inspect: {
    alias: 'i',
    description: 'Experimental! (Node 6.3.0+ only). This will pass the --inspect flag to Node.',
    type: 'boolean',
    requiresArg: false
  },
  logFile: {
    alias: 'L',
    description: 'The path to the logs file to which function logs will be written.',
    requiresArg: true,
    type: 'string'
  },
  projectId: {
    alias: 'P',
    description: 'Your Google Cloud Platform project ID.',
    requiresArg: true,
    type: 'string'
  },
  timeout: {
    alias: 't',
    description: 'The timeout in milliseconds to wait for the emulator to start.',
    requiresArg: true,
    type: 'number'
  },
  useMocks: {
    alias: 'm',
    description: 'If true, mocks.js will be loaded at startup.',
    requiresArg: false,
    type: 'boolean'
  },
  verbose: {
    alias: 'v',
    description: 'Set to true to see debug logs for the emulator itself.',
    requiresArg: false,
    type: 'boolean'
  }
};

/**
 * Handler for the "start" command.
 *
 * @param {object} opts Configuration options.
 * @param {boolean} [opts.debug] Configuration options.
 * @param {boolean} [opts.inspect] Configuration options.
 * @param {boolean} opts.port The port the server should listen on.
 */
exports.handler = (opts) => {
  const controller = new Controller(opts);

  return controller.status()
    .then((status) => {
      if (status.state === controller.STATE.RUNNING) {
        utils.writer.write(controller.name);
        utils.writer.write(' RUNNING\n'.cyan);
        return;
      }

      utils.writer.log(`Starting ${controller.name}...`);
      return controller.start()
        .then(() => {
          utils.writer.write(controller.name);
          utils.writer.write(' STARTED\n'.green);
        });
    })
    .then(() => list(opts))
    .catch((err) => {
      utils.writer.error(err);
    });
};
