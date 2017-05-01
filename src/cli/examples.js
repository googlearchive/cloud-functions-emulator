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

exports.call = [
  ['functions call helloWorld', 'Invokes the helloWorld function with no data.'],
  [`functions call helloWorld --data='{"foo":"bar"}'`, 'LINUX/MAC: Invokes the helloWorld function, passing it inline JSON.'],
  [`functions call helloWorld --data={\"foo\":\"bar\"}`, 'WINDOWS: Invokes the helloWorld function, passing it inline JSON.'], // eslint-disable-line
  ['functions call helloWorld --file=/path/to/datafile.json', 'Invokes the helloWorld function, passing it a path to a JSON file.'],
  ['functions call helloWorld --service=grpc', 'Invokes the helloWorld function, using gRPC to make the request.']
];

exports.clear = [];

exports['config.defaults'] = [
  ['functions config defaults', 'Prints the default settings.'],
  ['functions config defaults --json', 'Prints the default settings as JSON.']
];

exports['config.list'] = [
  ['functions config list', 'Prints the current settings.'],
  ['functions config list --json', 'Prints the current settings as JSON.']
];

exports['config.set'] = [
  ['functions config set projectId my-project', `Sets ${'projectId'.bold} to ${'my-project'.bold}.`]
];

exports.debug = [];

exports.delete = [
  ['functions delete helloWorld']
];

exports.deploy = [
  ['cd /path/to/src; functions deploy helloWorld --trigger-http'],
  ['functions deploy helloWorld --local-path=/path/to/src --trigger-http'],
  ['functions deploy testHelloWorld -l=/path/to/src --entry-point=helloWorld --trigger-http'],
  ['cd /path/to/src; functions deploy helloGCS --trigger-bucket=my-bucket'],
  ['functions deploy helloPubSub -l=/path/to/src --trigger-topic=my-topic']
];

exports.describe = [
  ['functions describe helloWorld']
];

exports['event-types.list'] = [];

exports.inspect = [];

exports.reset = [
  ['functions reset helloWorld', `Reset the helloWorld function's worker process.`],
  ['functions reset helloWorld --keep', `Reset the helloWorld function's worker process, but keep its debugging settings, if any.`]
];

exports.restart = [];

exports.start = [];

exports.status = [];

exports.stop = [];

exports['logs.read'] = [
  ['functions logs read --limit=10', 'Display the most recent 10 lines from the logs']
];

exports['logs.clear'] = [];

exports.config = exports['config.list'].concat(exports['config.set']);
exports['event-types'] = exports['event-types.list'];
exports.logs = exports['logs.read'];
