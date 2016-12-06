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
const utils = require('../utils');

/**
 * http://yargs.js.org/docs/#methods-commandmodule-providing-a-command-module
 */
exports.command = 'status';
exports.describe = 'Reports the current status of the emulator.';
exports.builder = {};

/**
 * Handler for the "status" command.
 *
 * @param {object} opts Configuration options.
 */
exports.handler = (opts) => {
  const controller = new Controller(opts);

  return controller.status()
    .then((status) => {
      utils.writer.write(`${controller.name}`);

      if (status.state === controller.STATE.RUNNING) {
        utils.writer.write(' is ');
        utils.writer.write('RUNNING'.green);
        utils.writer.write(` on port ${status.metadata.port}`);

        if (status.metadata) {
          if (status.metadata.inspect && (status.metadata.inspect === 'true' || status.metadata.inspect === true)) {
            utils.writer.write(', with ' + 'INSPECT'.yellow + ' enabled on port ' + (opts.debugPort || 9229));
          } else if (status.metadata.debug && (status.metadata.debug === 'true' || status.metadata.debug === true)) {
            utils.writer.write(', with ' + 'DEBUG'.yellow + ' enabled on port ' + (opts.debugPort || 5858));
          }
        }

        utils.writer.write('\n');
      } else {
        utils.writer.write(' STOPPED\n'.yellow);
      }
    })
    .catch(utils.handleError);
};
