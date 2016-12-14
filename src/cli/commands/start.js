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

const options = exports.options = {
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
  inspectPort: {
    alias: 'I',
    description: 'Override to change the default inspect port.',
    requiresArg: true,
    type: 'number'
  },
  logFile: {
    alias: 'L',
    description: 'The path to the logs file to which function logs will be written.',
    requiresArg: true,
    type: 'string'
  },
  service: {
    alias: 's',
    description: 'Which wire protocol to use when communicating with the Emulator. Choices are "rest" or "grpc".',
    requiresArg: true,
    type: 'string'
  },
  projectId: {
    alias: 'P',
    description: 'Your Google Cloud Platform project ID.',
    requiresArg: true,
    type: 'string'
  },
  runSupervisor: {
    description: 'Whether to run the Supervisor as part of the Emulator.',
    requiresArg: false,
    type: 'boolean'
  },
  supervisorHost: {
    description: 'The host the Supervisor should run on.',
    requiresArg: true,
    type: 'string'
  },
  supervisorPort: {
    description: 'The port the Supervisor should run on.',
    requiresArg: true,
    type: 'number'
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
 * http://yargs.js.org/docs/#methods-commandmodule-providing-a-command-module
 */
exports.command = 'start';
exports.describe = 'Starts the emulator.';
exports.builder = (yargs) => {
  yargs.options(options);

  for (let key in options) {
    if (options[key].type === 'boolean') {
      yargs.default(key, undefined);
    }
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
        controller.write(controller.name);
        controller.write(' RUNNING\n'.cyan);
        return;
      }

      controller.log(`Starting ${controller.name}...`);
      return controller.start()
        .then(() => {
          let promise;

          controller.write(controller.name);
          controller.write(' STARTED\n\n'.green);

          // Only start the Emulator itself in debug or inspect mode if the
          // isolation model is "inprocess"
          if (controller.server.get('isolation') === 'inprocess') {
            if (controller.server.get('inspect')) {
              promise = controller.getDebuggingUrl().then((debugUrl) => {
                let debugStr = `Started in inspect mode. Connect to the debugger on port ${controller.server.get('inspectPort')} (e.g. using the "node2" launch type in VSCode), or open the following URL in Chrome:`;
                if (debugUrl) {
                  // If found, include it in the string that gets printed
                  debugStr += `\n\n    ${debugUrl}\n`;
                } else {
                  debugStr += `\n\nError: Could not find Chrome debugging URL in log file. Look for it yourself in ${controller.server.get('logFile')}.`;
                }
                console.log(debugStr);
              });
            } else if (controller.server.get('debug')) {
              console.log(`Connect to the debugger on port ${controller.server.get('debugPort')} (e.g. using the "node" launch type in VSCode).`);
            }
          } else {
            if (controller.server.get('inspect')) {
              console.log(`Inspect mode is enabled for the Supervisor. During function execution the debugger will listen on port ${controller.server.get('inspectPort')} and the Chrome debugging URL will be printed to the console.`);
            } else if (controller.server.get('debug')) {
              console.log(`Debug mode is enabled for the Supervisor. During function execution the debugger will listen on port ${controller.server.get('debugPort')}.`);
            }
          }

          return promise;
        });
    })
    .then(() => list(opts))
    .catch((err) => controller.handleError(err));
};
