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

const cli = require('yargs');

cli
  .options({
    grpcHost: {
      description: 'The host the gRPC Service should run on.',
      global: true,
      requiresArg: true,
      type: 'string'
    },
    grpcPort: {
      description: 'The port the gRPC Service should run on.',
      global: true,
      requiresArg: true,
      type: 'number'
    },
    restHost: {
      description: 'The host the REST Service should run on.',
      global: true,
      requiresArg: true,
      type: 'string'
    },
    restPort: {
      description: 'The port the REST Service should run on.',
      global: true,
      requiresArg: true,
      type: 'number'
    }
  });

module.exports = cli;

