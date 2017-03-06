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

const execSync = require('child_process').execSync;

const EXAMPLES = require('../../examples');

const COMMAND = `functions event-types list ${'[options]'.yellow}`;
const DESCRIPTION = `Describes the allowed values and meanings of ${'--trigger-'.bold} flags.`;
const USAGE = `Usage:
  ${COMMAND.bold}

Description:
  ${DESCRIPTION}

  When using gcloud functions deploy Event Providers are specified as
  --trigger-provider and Event Types are specified as --trigger-event. The table
  includes the type of resource expected in --trigger-resource and which
  parameters --trigger-params takes and whether they are optional, required, or
  not-allowed. For EVENT_TYPE and RESOURCE_TYPE look at the column at right side
  to see if flag can be omitted.`;

/**
 * http://yargs.js.org/docs/#methods-commandmodule-providing-a-command-module
 */
exports.command = 'list';
exports.description = DESCRIPTION;
exports.builder = (yargs) => {
  yargs
    .usage(USAGE);

  EXAMPLES['event-types.list'].forEach((e) => yargs.example(e[0], e[1]));
};
exports.handler = (opts) => {
  console.log(execSync('gcloud beta functions event-types list').toString());
};
