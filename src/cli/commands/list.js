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
const fs = require('fs');
const Table = require('cli-table2');

const Controller = require('../controller');
const { CloudFunction } = require('../../model');
const OPTIONS = require('../../options');

const COMMAND = `functions list ${'[options]'.yellow}`;
const DESCRIPTION = `Lists deployed functions.`;
const USAGE = `Usage:
  ${COMMAND.bold}

Description:
  ${DESCRIPTION}`;

function pathExists (p) {
  try {
    fs.statSync(p);
    return true;
  } catch (e) {
    return false;
  }
}

const CloudFunctionStatus = {
  '0': 'STATUS_UNSPECIFIED',
  '1': 'READY'.green,
  '2': 'FAILED'.red,
  '3': 'DEPLOYING',
  '4': 'DELETING',
  'STATUS_UNSPECIFIED': 'STATUS_UNSPECIFIED',
  'READY': 'READY'.green,
  'FAILED': 'FAILED'.red,
  'DEPLOYING': 'DEPLOYING',
  'DELETING': 'DELETING'
};

/**
 * http://yargs.js.org/docs/#methods-commandmodule-providing-a-command-module
 */
exports.command = 'list';
exports.description = DESCRIPTION;
exports.builder = (yargs) => {
  yargs
    .usage(USAGE)
    .options(_.pick(OPTIONS, ['host', 'projectId', 'region', 'restPort', 'service']));
};
exports.handler = (opts) => {
  const controller = new Controller(opts);

  return controller.doIfRunning()
    .then(() => controller.list())
    .then((cloudfunctions) => {
      if (cloudfunctions.length === 0) {
        controller.log(`No functions deployed ¯\\_(ツ)_/¯. Run ${'functions deploy --help'.bold} for how to deploy a function.`);
      } else {
        const table = new Table({
          head: ['Status'.bold, 'Name'.bold, 'Trigger'.bold, 'Resource'.bold]
        });

        cloudfunctions.forEach((cloudfunction) => {
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

          if (!resource) {
            resource = 'None';
          }
          if (pathExists(CloudFunction.getLocaldir(cloudfunction))) {
            table.push([
              CloudFunctionStatus[cloudfunction.status] || CloudFunctionStatus['0'],
              cloudfunction.shortName,
              trigger,
              resource
            ]);
          } else {
            table.push([
              (CloudFunctionStatus[cloudfunction.status] || CloudFunctionStatus['0']).red,
              cloudfunction.shortName.red,
              trigger.red,
              resource.red
            ]);
          }
        });

        controller.log(table.toString());
      }
    })
    .catch((err) => controller.handleError(err));
};
