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

/**
 * The Emulator has two services: "rest" and "grpc".
 *
 * In "rest" mode the CLI uses a RestClient (implemented using the Google APIs
 * Client Library) to communicate with the Emulator:
 *
 *     |-->-- RestClient - HTTP1.1 - JSON -->--|
 * CLI -                                       - Emulator
 *     |--<-- RestClient - HTTP1.1 - JSON --<--|
 *
 * In "grpc" mode the CLI uses a GrpcClient (implemented using the Google Cloud
 * Client Library) to communicate with the Emulator:
 *
 *     |-->-- GrpcClient - HTTP2 - Proto -->--|
 * CLI -                                      - Emulator
 *     |--<-- GrpcClient - HTTP2 - Proto --<--|
 *
 * The Gcloud SDK can be used to talk to the Emulator as well, just do:
 *
 *     gcloud config set api_endpoint_overrides/cloudfunctions http://localhost:8008/
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
  .example('cd /path/to/module/dir; $0 deploy helloWorld --trigger-http', 'Deploy helloWorld as an HTTP function from the module located in /path/to/module/dir.')
  .example('$0 deploy helloWorld --local-path=/path/to/module/dir --trigger-http', 'Deploy helloWorld as an HTTP function from the module located in /path/to/module/dir.')
  .example('$0 call helloWorld', 'Invoke the helloWorld function with no data argument')
  .example(`$0 call helloWorld --data='{"foo": "bar"}'`, 'Invoke the helloWorld function with a JSON document argument')
  .example('$0 call helloWorld --file=~/myData/datafile.json', 'Invoke the helloWorld function with a file argument')
  .example('$0 logs read --limit=10', 'Display the most recent 10 lines from the logs')
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
