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

const Table = require('cli-table2');

const Controller = require('../controller');

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
      const table = new Table({
        head: [{ colSpan: 2, content: controller.name.cyan }],
        colWidths: [16]
      });

      if (status.state === controller.STATE.RUNNING) {
        let time = Math.floor((Date.now() - status.metadata.started) / (1000));
        if (time > (60 * 60)) {
          time = `${Math.floor(time / (60 * 60))} hour(s)`;
        } else if (time > 60) {
          time = `${Math.floor(time / 60)} minute(s)`;
        } else {
          time = `${Math.floor(time)} seconds`;
        }

        table.push(['Status'.white, 'RUNNING'.green]);
        table.push(['Uptime'.white, time]);
        table.push(['Host'.white, `http://${status.metadata.host}:${status.metadata.port}/`]);
        table.push(['Log file'.white, status.metadata.logFile]);
        table.push(['Service mode'.white, status.metadata.serviceMode]);

        if (status.metadata.inspect && (status.metadata.inspect === 'true' || status.metadata.inspect === true)) {
          table.push(['Debug port (--inspect)'.white, status.metadata.debugPort]);
        } else if (status.metadata.debug && (status.metadata.debug === 'true' || status.metadata.debug === true)) {
          table.push(['Debug port (--debug)'.white, status.metadata.debugPort]);
        }
      } else {
        let time;
        if (status.metadata.stopped) {
          time = Math.floor((Date.now() - status.metadata.stopped) / (1000));
          if (time > (60 * 60)) {
            time = `${Math.floor(time / (60 * 60))} hour(s)`;
          } else if (time > 60) {
            time = `${Math.floor(time / 60)} minute(s)`;
          } else {
            time = `${Math.floor(time)} second(s)`;
          }
        }

        table.push(['Status'.white, 'STOPPED'.yellow]);
        if (time) {
          table.push(['Last up'.white, `${time.yellow} ago`]);
        }
        if (status.metadata.logFile) {
          table.push(['Last log file'.white, status.metadata.logFile]);
        }
      }

      controller.log(table.toString());
    })
    .catch((err) => controller.handleError(err));
};
