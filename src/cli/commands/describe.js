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

const COMMAND = `functions describe ${'<functionName>'.yellow} ${'[options]'.yellow}`;
const DESCRIPTION = `Describes the details of a single deployed function.`;
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
    .options(_.pick(OPTIONS, ['grpcHost', 'grpcPort', 'projectId', 'region', 'service', 'restHost', 'restPort']));

  EXAMPLES['describe'].forEach((e) => yargs.example(e[0], e[1]));
};
exports.handler = (opts) => {
  const controller = new Controller(opts);

  return controller.doIfRunning()
    .then(() => controller.describe(opts.functionName))
    .then((cloudfunction) => {
      const table = new Table({
        head: ['Property'.cyan, 'Value'.cyan]
      });

      let trigger, resource, params;
      if (cloudfunction.httpsTrigger) {
        trigger = 'HTTP';
        resource = cloudfunction.httpsTrigger.url;
      } else if (cloudfunction.eventTrigger) {
        trigger = cloudfunction.eventTrigger.eventType;
        resource = cloudfunction.eventTrigger.resource;
        params = cloudfunction.eventTrigger.path;
      } else {
        trigger = 'Unknown';
      }

      table.push(['Name', cloudfunction.shortName.white]);
      if (cloudfunction.entryPoint) {
        table.push(['Entry Point', cloudfunction.entryPoint.white]);
      }
      table.push(['Trigger', trigger.white]);
      if (resource) {
        table.push(['Resource', resource.white]);
      }
      if (params) {
        table.push(['Params', params.white]);
      }
      if (cloudfunction.serviceAccount) {
        table.push(['Local path', cloudfunction.serviceAccount.white]);
      }
      table.push(['Archive', cloudfunction.sourceArchiveUrl.white]);

      controller.log(table.toString());
    })
    .catch((err) => controller.handleError(err));
};
