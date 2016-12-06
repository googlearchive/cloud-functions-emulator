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

const Controller = require('../../controller');
const utils = require('../../utils');

/**
 * http://yargs.js.org/docs/#methods-commandmodule-providing-a-command-module
 */
exports.command = 'list';
exports.describe = 'Print all options in the config.json file.';
exports.builder = {
  json: {
    alias: 'j',
    description: 'Print the config as JSON.',
    requiresArg: false,
    type: 'boolean'
  }
};

/**
 * Handler for the "list" command.
 */
exports.handler = (opts) => {
  const controller = new Controller(opts);
  const config = controller._config.all;
  const path = controller._config.path;

  if (opts.json) {
    utils.writer.log(JSON.stringify(config, null, 2));
  } else {
    utils.writer.log('Config file: ' + path.green);

    const table = new Table({
      head: ['Key'.cyan, 'Value'.cyan],
      colWidths: [16, 64]
    });

    let value;

    for (let key in config) {
      value = config[key];

      table.push([
        key.white,
        `${value}`.white
      ]);
    }

    utils.writer.log(table.toString());
  }
};
