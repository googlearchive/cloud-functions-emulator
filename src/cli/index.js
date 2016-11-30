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

require('colors');

const cli = require('../config');
const fs = require('fs');
const path = require('path');

// Load the commands
fs
  .readdirSync(path.join(__dirname, './commands'))
  .forEach((commandFile) => {
    cli.command(require(`./commands/${commandFile}`));
  });

cli
  .demand(1)
  .example('$0 deploy ~/myModule helloWorld --trigger-http', 'Deploy helloWorld as an HTTP function from the module located in ~/myModule')
  .example('$0 call helloWorld', 'Invoke the helloWorld function with no data argument')
  .example('$0 call helloWorld --data \'{"foo": "bar"}\'', 'Invoke the helloWorld function with a JSON document argument')
  .example('$0 call helloWorld --file ~/myData/datafile.json', 'Invoke the helloWorld function with a file argument')
  .example('$0 logs read --limit 10', 'Display the most recent 10 lines from the logs')
  .wrap(120);

exports.main = (args) => {
  cli
    .help()
    .version()
    .strict()
    .parse(args)
    .argv;
};
exports.Controller = require('./controller').Controller;
