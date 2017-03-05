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

const Controller = require('../controller');
const EXAMPLES = require('../examples');
const list = require('./list').handler;
const OPTIONS = require('../../options');

const COMMAND = `functions start ${'[options]'.yellow}`;
const DESCRIPTION = `Starts the Emulator.`;
const USAGE = `Usage:
  ${COMMAND.bold}

Description:
  ${DESCRIPTION}

  While you can pass command-line options to the Emulator with this command, you should save settings to the Emulator's
  config file if you want settings preserved across restarts. Run ${'functions config --help'.bold} for help on managing
  saved configuration settings.`;

exports.options = [
  'debug',
  'debugPort',
  'grpcHost',
  'grpcPort',
  'inspect',
  'inspectPort',
  'logFile',
  'projectId',
  'region',
  'restHost',
  'restPort',
  'service',
  'storage',
  'supervisorHost',
  'supervisorPort',
  'timeout',
  'useMocks',
  'verbose'
];

/**
 * http://yargs.js.org/docs/#methods-commandmodule-providing-a-command-module
 */
exports.command = 'start';
exports.describe = 'Starts the emulator.';
exports.builder = (yargs) => {
  yargs
    .usage(USAGE)
    .options(_.pick(OPTIONS, exports.options));

  exports.options.forEach((key) => {
    if (OPTIONS[key].type === 'boolean') {
      yargs.default(key, undefined);
    }
  });

  EXAMPLES['start'].forEach((e) => yargs.example(e[0], e[1]));
};
exports.handler = (opts) => {
  const controller = new Controller(opts);

  return controller.status()
    .then((status) => {
      if (status.state === controller.STATE.RUNNING) {
        controller.write(controller.name);
        controller.write(' RUNNING\n'.green);
        return;
      }

      controller.log(`Starting ${controller.name}...`);
      return controller.start()
        .then(() => {
          let promise;

          const config = controller.server.all;

          controller.write(controller.name);
          controller.write(' STARTED\n'.green);
          controller.log(`HTTP functions receiving requests at http://${config.supervisorHost}:${config.supervisorPort}/${config.projectId}/${config.region}/FUNCTION_NAME\n`);

          if (config.inspect) {
            console.log(`Inspect mode is enabled for the Supervisor. Check the logs for the workers' debugger ports.\n`);
          } else if (config.debug) {
            console.log(`Debug mode is enabled for the Supervisor. Check the logs for the workers' debugger ports.\n`);
          }

          return promise;
        });
    })
    .then(() => list(opts))
    .catch((err) => controller.handleError(err));
};
