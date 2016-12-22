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

exports.call = [
  ['functions call helloWorld', 'Invokes the helloWorld function with no data.'],
  [`functions call helloWorld --data='{"foo":"bar"}'`, 'Invokes the helloWorld function, passing it inline JSON.'],
  ['functions call helloWorld --file=/path/to/datafile.json', 'Invokes the helloWorld function, passing it a path to a JSON file.'],
  ['functions call helloWorld --service=grpc', 'Invokes the helloWorld function, using gRPC to make the request.']
];

exports.clear = [];

exports['config.list'] = [
  ['functions config list', 'Prints the current settings.'],
  ['functions config list --json', 'Prints the current settings as JSON.']
];

exports['config.set'] = [
  ['functions config set projectId my-project', `Sets ${'projectId'.bold} to ${'my-project'.bold}.`]
];

exports.delete = [];

exports.deploy = [
  ['cd /path/to/module/dir; functions deploy helloWorld --trigger-http', 'Deploy helloWorld as an HTTP function from the module located in /path/to/module/dir.'],
  ['functions deploy helloWorld --local-path=/path/to/other/module/dir --trigger-http', 'Deploy helloWorld as an HTTP function from the module located in /path/to/other/module/dir.']
];

exports.describe = [];

exports['event-types.list'] = [];

exports.kill = [];

exports.list = [];

exports.prune = [];

exports.restart = [];

exports.start = [];

exports.status = [];

exports.stop = [];

exports['logs.read'] = [
  ['functions logs read --limit=10', 'Display the most recent 10 lines from the logs']
];

exports.config = exports['config.list'].concat(exports['config.set']);
exports['event-types'] = exports['event-types.list'];
exports.logs = exports['logs.read'];
