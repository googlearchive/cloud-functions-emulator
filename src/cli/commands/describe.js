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
const Table = require('cli-table2');

const Controller = require('../controller');
const { CloudFunction } = require('../../model');
const EXAMPLES = require('../examples');
const OPTIONS = require('../../options');

const COMMAND = `functions describe ${'<functionName>'.yellow} ${'[options]'.yellow}`;
const DESCRIPTION = `Prints the details of a single deployed function.`;
const USAGE = `Usage:
  ${COMMAND.bold}

Description:
  ${DESCRIPTION}

Positional arguments:
  ${'functionName'.bold}
    The name of the function to describe.`;

/**
 * http://yargs.js.org/docs/#methods-commandmodule-providing-a-command-module
 */
exports.command = 'describe <functionName>';
exports.description = DESCRIPTION;
exports.builder = (yargs) => {
  yargs
    .usage(USAGE)
    .options(_.pick(OPTIONS, ['host', 'projectId', 'region', 'restPort', 'service']));

  EXAMPLES['describe'].forEach((e) => yargs.example(e[0], e[1]));
};
exports.handler = (opts) => {
  const controller = new Controller(opts);

  return controller.doIfRunning()
    .then(() => controller.describe(opts.functionName))
    .then((cloudfunction) => {
      const table = new Table({
        head: ['Property'.bold, 'Value'.bold]
      });

      let trigger, resource;
      if (cloudfunction.httpsTrigger) {
        trigger = 'HTTP';
        resource = cloudfunction.httpsTrigger.url;
      } else if (cloudfunction.eventTrigger) {
        trigger = cloudfunction.eventTrigger.eventType;
        resource = cloudfunction.eventTrigger.resource;
      } else {
        trigger = 'Unknown';
      }

      table.push(['Name', cloudfunction.shortName]);
      if (cloudfunction.entryPoint) {
        table.push(['Entry Point', cloudfunction.entryPoint]);
      }
      table.push(['Trigger', trigger]);
      if (resource) {
        table.push(['Resource', resource]);
      }
      if (cloudfunction.timeout && cloudfunction.timeout.seconds) {
        table.push(['Timeout', `${cloudfunction.timeout.seconds} seconds`]);
      } else {
        table.push(['Timeout', `60 seconds`]);
      }
      const localdir = CloudFunction.getLocaldir(cloudfunction);
      if (CloudFunction.getLocaldir(cloudfunction)) {
        table.push(['Local path', localdir]);
      }
      table.push(['Archive', cloudfunction.sourceArchiveUrl]);

      controller.log(table.toString());
    })
    .catch((err) => controller.handleError(err));
};
