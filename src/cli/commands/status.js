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
const Table = require('cli-table2');

const Controller = require('../controller');
const EXAMPLES = require('../examples');
const OPTIONS = require('../../options');

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
  yargs
    .usage(USAGE)
    .options(_.pick(OPTIONS, ['grpcHost', 'grpcPort', 'projectId', 'region', 'service', 'restHost', 'restPort']));

  EXAMPLES['status'].forEach((e) => yargs.example(e[0], e[1]));
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
        table.push(['REST Service', `http://${config.restHost}:${config.restPort}/`]);
        table.push(['gRPC Service', `http://${config.grpcHost}:${config.grpcPort}/`]);
        if (config.inspect || config.debug) {
          table.push(['Debugger', 'ACTIVE'.green]);
          if (config.inspect) {
            table.push(['Debugger Port', `${config.inspectPort}`]);
          } else {
            table.push(['Debugger Port', `${config.debugPort}`]);
          }
        } else if (config.debug) {
          table.push(['Debugger', 'INACTIVE'.yellow]);
        }
        table.push(['Log file', config.logFile]);
        table.push(['Project ID', config.projectId]);
        table.push(['Region', config.region]);
        table.push(['Storage Mode', config.storage]);

        if (config.mocks) {
          table.push(['Mocks', 'LOADED'.green]);
        } else {
          table.push(['Mocks', 'NOT LOADED'.yellow]);
        }

        table.push([{ colSpan: 2, content: 'Supervisor'.bold }]);
        table.push(['Trigger URL', `http://${config.supervisorHost}:${config.supervisorPort}/${config.projectId}/${config.region}/FUNCTION_NAME`]);
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
      }

      controller.log(table.toString());
    })
    .catch((err) => controller.handleError(err));
};
