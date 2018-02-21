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

const config = require('../../../config');
const EXAMPLES = require('../../examples');
const OPTIONS = require('../../../options');

const EPILOGUE = `Available configuration options:

  ${'CLI'.underline} - Global settings.
    ${'projectId'.bold}
      ${OPTIONS.projectId.description}

    ${'region'.bold}
      ${OPTIONS.region.description}

    ${'storage'.bold}
      ${OPTIONS.storage.description}

  ${'CLI'.underline} - Manages the Emulator.
    ${'timeout'.bold}
      ${OPTIONS.timeout.description}

  ${'EMULATOR'.underline} - Emulates the Cloud Functions API.
    ${'bindHost'.bold}
      ${OPTIONS.bindHost.description}

    ${'host'.bold}
      ${OPTIONS.host.description}

    ${'idlePruneInterval'.bold}
      ${OPTIONS.idlePruneInterval.description}

    ${'logFile'.bold}
      ${OPTIONS.logFile.description}

    ${'maxIdle'.bold}
      ${OPTIONS.maxIdle.description}

    ${'restPort'.bold}
      ${OPTIONS.restPort.description}

    ${'supervisorPort'.bold}
      ${OPTIONS.supervisorPort.description}

    ${'tail'.bold}
      ${OPTIONS.tail.description}

    ${'useMocks'.bold}
      ${OPTIONS.useMocks.description}

    ${'verbose'.bold}
      ${OPTIONS.verbose.description}

    ${'watch'.bold}
      ${OPTIONS.watch.description}

    ${'watchIgnore'.bold}
      ${OPTIONS.watchIgnore.description}

    See ${'https://github.com/GoogleCloudPlatform/cloud-functions-emulator/wiki/Configuring-the-Emulator'.bold}
`;
const COMMAND = `functions config ${'<command>'.yellow} ${'[options]'.yellow}`;
const DESCRIPTION = `Manages the settings stored in ${config.path.bold}.`;
const USAGE = `Usage:
  ${COMMAND.bold}

Description:
  ${DESCRIPTION} Run ${('functions config ' + '<command>'.yellow + ' --help').bold} to print additional help for a command.

Positional arguments:
  ${'command'.bold}
    The ${'config'.bold} command to execute.`;

/**
 * http://yargs.js.org/docs/#methods-commandmodule-providing-a-command-module
 */
exports.command = 'config <command>';
exports.description = DESCRIPTION;
exports.builder = (yargs) => {
  yargs
    .usage(USAGE)
    .command(require('./list'))
    .command(require('./set'))
    .command(require('./reset'))
    .command(require('./defaults'))
    .epilogue(EPILOGUE);

  EXAMPLES['config'].forEach((e) => yargs.example(e[0], e[1]));
};
exports.helpMessage = `Run ${'functions config --help'.bold} for a description of the available configuration options.`;
exports.handler = () => {};
