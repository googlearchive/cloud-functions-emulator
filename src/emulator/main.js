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
const cli = require('yargs');
const Configstore = require('configstore');
const fs = require('fs');
const path = require('path');
const winston = require('winston');
const logger = winston;

const defaults = require('../defaults.json');
const Emulator = require('./emulator');
const logs = require('./logs');
const OPTIONS = require('../options');
const pkg = require('../../package.json');
const server = new Configstore(path.join(pkg.name, '/.active-server'));

const COMMAND = `./bin/emulator ${'[options]'.yellow}`;
const DESCRIPTION = `The Google Cloud Functions Emulator service. The service implements both the REST version of the Google
  Cloud Functions API.

  You can use the CLI to manage the service, or deploy the service manually.`;
const USAGE = `Usage:
  In the cloud-functions-emulator directory:

    ${('npm start -- ' + '[options]'.yellow).bold}

  or

    ${COMMAND.bold}

  From anywhere:

    ${('/path/to/cloud-functions-emulator/bin/emulator ' + '[options]'.yellow).bold}

  If you're using the CLI (npm install -g @google-cloud/functions-emulator):

    ${('functions start ' + '[options]'.yellow).bold}

Description:
  ${DESCRIPTION}`;

function main (args) {
  let opts = cli
    .usage(USAGE)
    .options(_.merge(_.pick(OPTIONS, require('../cli/commands/start').options), {
      config: {
        alias: 'c',
        description: 'Path to a config .json file.',
        type: 'string'
      }
    }))
    .example('bin/emulator --verbose', 'Start the Emulator in verbose mode.')
    .wrap(120)
    .help()
    .version()
    .strict()
    .argv;

  if (opts.config) {
    _.merge(opts, require(path.resolve(opts.config)));
  }
  opts = _.merge(defaults, opts);

  const logLevel = opts.verbose ? 'debug' : 'info';
  opts.logFile = opts.logFile ? logs.assertLogsPath(opts.logFile) : opts.logFile;
  winston.configure({
    transports: [
      new (winston.transports.File)({
        json: false,
        filename: opts.logFile,
        maxsize: 10485760,
        level: logLevel,
        handleExceptions: true,
        humanReadableUnhandledException: true
      }),
      new (winston.transports.Console)({
        json: false,
        level: logLevel,
        colorize: true
      })
    ]
  });

  // Add a global error handler to catch all unexpected exceptions in the process
  // Note that this will not include any unexpected system errors (syscall failures)
  process.on('uncaughtException', function (err) {
    console.error(err.stack);
    fs.appendFileSync(opts.logFile, `\n${err.stack}`);

    // HACK: An uncaught exception may leave the process in an incomplete state
    // however exiting the process prematurely may result in the above log call
    // to not complete. Thus we're just going to wait for an arbitrary amount
    // of time for the log entry to complete.
    // Possible future solution here: https://github.com/winstonjs/winston/issues/228
    setTimeout(function () {
      process.exit(1);
    }, 2000);
  });

  logger.debug('main', opts);

  const emulator = new Emulator(opts);

  emulator.start();

  // The CLI uses SIGTERM to tell the Emulator that it needs to shut down.
  process.on('SIGTERM', () => emulator.stop());

  process.on('exit', () => {
    const pid = server.get('pid');
    try {
      server.delete('pid');
      server.set('stopped', Date.now());
      if (pid) {
        server.set('lastKnownPid', pid);
      }
    } catch (err) {

    }
  });
}

module.exports = main;
