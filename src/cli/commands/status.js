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
      const config = status.metadata;

      if (status.state === controller.STATE.RUNNING) {
        let time = Math.floor((Date.now() - config.started) / (1000));
        if (time > (60 * 60)) {
          time = `${Math.floor(time / (60 * 60))} hour(s)`;
        } else if (time > 60) {
          time = `${Math.floor(time / 60)} minute(s)`;
        } else {
          time = `${Math.floor(time)} seconds`;
        }

        table.push(['Status'.white, 'RUNNING'.green]);
        table.push(['Uptime'.white, time]);
        table.push(['Process ID'.white, config.pid]);
        table.push(['Rest Service'.white, `http://${config.restHost}:${config.restPort}/`]);
        table.push(['gRPC Service'.white, `http://${config.grpcHost}:${config.grpcPort}/`]);
        if (config.inspect || config.debug) {
          table.push(['Debugger'.white, 'ACTIVE'.green]);
          if (config.inspect) {
            table.push(['Debugger Port'.white, `${config.inspectPort}`.white]);
          } else {
            table.push(['Debugger Port'.white, `${config.debugPort}`.white]);
          }
        } else if (config.debug) {
          table.push(['Debugger'.white, 'INACTIVE'.yellow]);
        }
        table.push(['Log file'.white, config.logFile]);
        table.push(['Project ID'.white, config.projectId]);
        table.push(['Region'.white, config.region]);
        table.push(['Storage Mode'.white, config.storage]);

        if (config.mocks) {
          table.push(['Mocks'.white, 'LOADED'.green]);
        } else {
          table.push(['Mocks'.white, 'NOT LOADED'.yellow]);
        }

        table.push([{ colSpan: 2, content: 'Supervisor'.cyan }]);

        if (config.runSupervisor) {
          table.push(['Status'.white, 'RUNNING'.green]);
          table.push(['Isolation Mode'.white, config.isolation]);
        } else {
          table.push(['Status'.white, 'DETACHED'.yellow]);
        }

        table.push(['Trigger URL'.white, `http://${config.supervisorHost}:${config.supervisorPort}/${config.projectId}/${config.region}/FUNCTION_NAME`]);
      } else {
        let time;
        if (config.stopped) {
          time = Math.floor((Date.now() - config.stopped) / (1000));
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
        if (config.logFile) {
          table.push(['Last log file'.white, config.logFile]);
        }
      }

      controller.log(table.toString());
    })
    .catch((err) => controller.handleError(err));
};
