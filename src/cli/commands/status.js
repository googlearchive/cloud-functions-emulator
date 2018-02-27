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

const Table = require('cli-table2');

const Controller = require('../controller');

const COMMAND = `functions status ${'[options]'.yellow}`;
const DESCRIPTION = `Reports the current status of the Emulator.`;
const USAGE = `Usage:
  ${COMMAND.bold}

Description:
  ${DESCRIPTION}`;

/**
 * http://yargs.js.org/docs/#methods-commandmodule-providing-a-command-module
 */
exports.command = 'status';
exports.description = DESCRIPTION;
exports.builder = (yargs) => {
  yargs.usage(USAGE);
};
exports.handler = (opts) => {
  const controller = new Controller(opts);

  return controller.status()
    .then((status) => {
      const table = new Table({
        head: [{ colSpan: 2, content: controller.name.bold }]
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

        table.push(['Status', 'RUNNING'.green]);
        table.push(['Uptime', time]);
        table.push(['Process ID', config.pid]);
        const workerPids = Object.keys(config.workers || {});
        if (workerPids.length) {
          table.push(['Worker PIDs', workerPids.join(', ')]);
        }
        table.push(['REST Service', `http://${config.host}:${config.restPort}/`]);
        table.push(['HTTP Triggers', `http://${config.host}:${config.supervisorPort}/${config.projectId}/${config.region}/:function`]);
        table.push(['Log file', config.logFile]);
        table.push(['Emulator Version', config.version]);
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

        table.push(['Status', 'STOPPED'.yellow]);
        if (time) {
          table.push(['Last up', `${time.yellow} ${'ago'}`]);
        }
        if (config.logFile) {
          table.push(['Last log file', config.logFile]);
        }
        if (config.lastKnownPid) {
          table.push(['Last Known Process ID', config.lastKnownPid]);
        }
        if (config.version) {
          table.push(['Emulator Version', config.version]);
        }
      }

      controller.log(table.toString());
      controller.log(`\nIf the Emulator becomes unresponsive, kill it will ${'functions kill'.bold} and then ensure that no other Emulator Node.js processes are running before restarting the Emulator.`);
    })
    .catch((err) => controller.handleError(err));
};
