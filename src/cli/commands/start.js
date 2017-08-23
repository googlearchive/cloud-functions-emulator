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
  'bindHost',
  'grpcPort',
  'host',
  'idlePruneInterval',
  'logFile',
  'maxIdle',
  'restPort',
  'storage',
  'supervisorPort',
  'tail',
  'timeout',
  'useMocks',
  'verbose',
  'watch',
  'watchIgnore'
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
        controller.log(`${controller.name} ${'RUNNING'.green}`);
        return;
      }

      controller.log(`Starting ${controller.name}...`);
      return controller.start()
        .then((child) => {
          controller.log(`${controller.name} ${'STARTED'.green}`);

          const cleanup = () => {
            try {
              child.kill();
              process.exit();
            } catch (err) {
              // Ignore error
            }
          };

          if (opts.tail) {
            // Exit on Ctrl + C
            process.on('SIGINT', cleanup);
            process.on('SIGTERM', cleanup);
          } else {
            // Ensure the parent doesn't wait for the child to exit
            // This should be used in combination with the 'detached' property
            // of the spawn() options.  The node documentation is unclear about
            // the behavior of detached & unref on different platforms.  'detached'
            // on Windows seems to do the same thing as unref() on non-Windows
            // platforms.  Doing both seems like the safest approach.
            // TODO: Test on Windows
            child.unref();
          }
        });
    })
    .then(() => list(opts))
    .catch((err) => controller.handleError(err));
};
