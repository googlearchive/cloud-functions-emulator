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

const Controller = require('../controller');
const EXAMPLES = require('../examples');
const OPTIONS = require('../../options');
const startCommand = require('./start');
const stop = require('./stop').handler;

const COMMAND = `functions restart ${'[options]'.yellow}`;
const DESCRIPTION = `Short for ${('functions stop; functions start ' + '[options]'.yellow).bold}.`;
const USAGE = `Usage:
  ${COMMAND.bold}

Description:
  ${DESCRIPTION}

  If any command-line options were passed to the Emulator when it was first started, then those same options need to be
  passed again in order for their values to be preserved when the Emulator restarts. Otherwise the Emulator will use the
  config file settings. Modify settings in the config file to perserve your changes across restarts. Run
  ${'functions config --help'.bold} for help on managing saved configuration settings.`;

/**
 * http://yargs.js.org/docs/#methods-commandmodule-providing-a-command-module
 */
exports.command = 'restart';
exports.description = DESCRIPTION;
exports.builder = (yargs) => {
  yargs
    .usage(USAGE)
    .options(_.pick(OPTIONS, startCommand.options));

  startCommand.options.forEach((key) => {
    if (OPTIONS[key].type === 'boolean') {
      yargs.default(key, undefined);
    }
  });

  EXAMPLES['restart'].forEach((e) => yargs.example(e[0], e[1]));
};
exports.handler = (opts) => {
  const controller = new Controller(opts);

  return controller.status()
    .then((status) => {
      if (status.state === controller.STATE.RUNNING) {
        return stop(opts).then(() => startCommand.handler(opts));
      } else {
        return startCommand.handler(opts);
      }
    })
    .catch((err) => controller.handleError(err));
};
