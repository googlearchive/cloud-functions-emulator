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

const fs = require('fs');
const Table = require('cli-table2');

const Controller = require('../controller');

function pathExists (p) {
  try {
    fs.statSync(p);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * http://yargs.js.org/docs/#methods-commandmodule-providing-a-command-module
 */
exports.command = 'list';
exports.describe = 'Lists deployed functions.';
exports.builder = {
  region: {
    default: 'us-central1',
    description: 'The compute region (e.g. us-central1) to use.',
    requiresArg: true,
    type: 'string'
  }
};

/**
 * Handler for the "list" command.
 *
 * @param {object} opts Configuration options.
 */
exports.handler = (opts) => {
  const controller = new Controller(opts);

  return controller.doIfRunning()
    .then(() => controller.list())
    .then((cloudfunctions) => {
      const table = new Table({
        head: ['Name'.cyan, 'Trigger'.cyan, 'Resource'.cyan],
        colWidths: [16, 64, 88] // 120 total
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
        if (pathExists(cloudfunction.sourceArchiveUrl.replace('file://', ''))) {
          table.push([
            cloudfunction.shortName.white,
            trigger.white,
            resource.white
          ]);
        } else {
          table.push([
            cloudfunction.shortName.red,
            trigger.red,
            resource.red
          ]);
        }
      });

      if (cloudfunctions.length === 0) {
        table.push([{
          colSpan: 3,
          content: 'No functions deployed ¯\\_(ツ)_/¯.  Run "functions deploy" to deploy a function.'.white
        }]);
      }

      controller.log(table.toString());
    })
    .catch((err) => controller.handleError(err));
};
