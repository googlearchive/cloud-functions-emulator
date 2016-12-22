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

const cli = require('yargs');
const fs = require('fs');
const path = require('path');

const EXAMPLES = require('./examples');
const USAGE = `Usage:
  ${('functions ' + '[options]'.yellow).bold}
  ${('functions ' + '<command>'.yellow + ' ' + '[args]'.yellow + ' ' + '[options]'.yellow).bold}
  ${('functions ' + '<commandGroup>'.yellow + ' ' + '<command>'.yellow + ' ' + '[args]'.yellow + ' ' + '[options]'.yellow).bold}

Description:
  A command-line interface for interacting with a Google Cloud Functions Emulator instance.

  Run ${('functions ' + '<command>'.yellow + ' --help').bold} to print additional help for a command.`;
const EPILOGUE = `------------------------------------------------------------------------------------------------------------------------
More How-To documentation can be found at:
  ${'https://github.com/GoogleCloudPlatform/cloud-functions-emulator'.bold.underline}.

Something not working? Have a feature request? Open an issue at:
  ${'https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues'.bold.underline}.

${'Contributions welcome!'.cyan}`;

exports.main = (args) => {
  // Load the commands
  fs
    .readdirSync(path.join(__dirname, './commands'))
    .forEach((commandFile) => {
      cli.command(require(`./commands/${commandFile}`));
    });

  cli
    .usage(USAGE)
    .demand(1)
    .wrap(120);

  for (let key in EXAMPLES) {
    if (key === 'config' || key === 'logs' || key === 'event-types') {
      continue;
    }
    EXAMPLES[key].forEach((e) => cli.example(e[0], e[1]));
  }

  cli
    .epilogue(EPILOGUE)
    .help()
    .version()
    .strict()
    .parse(args)
    .argv;
};
exports.Controller = require('./controller').Controller;
