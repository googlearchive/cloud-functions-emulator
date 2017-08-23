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

const defaults = require('./defaults.json');
const config = require('./config');

module.exports = {
  /**
   * Global settings
   */
  projectId: {
    alias: ['project', 'p'],
    description: `Your Google Cloud Platform project ID. ${'Default:'.bold} ${config.get('projectId').green}`,
    requiresArg: true,
    type: 'string'
  },
  region: {
    alias: 'r',
    description: `The compute region to use. ${'Default:'.bold} ${defaults.region.toString().green}`,
    requiresArg: true,
    type: 'string'
  },
  storage: {
    description: `The only choice right now is ${'configstore'.green}. ${'Default:'.bold} ${defaults.storage.toString().green}`,
    requiresArg: true,
    type: 'string'
  },

  /**
   * CLI settings
   */
  service: {
    description: `Which wire protocol to use when communicating with the Emulator. Choices are ${'rest'.green} or ${'grpc'.green}. ${'Default:'.bold} ${defaults.service.toString().green}`,
    requiresArg: true,
    type: 'string'
  },
  timeout: {
    description: `How long (in milliseconds) the CLI should wait for the Emulator to start or stop before giving up. ${'Default:'.bold} ${defaults.timeout.toString().green}`,
    requiresArg: true,
    type: 'number'
  },

  /**
   * Emulator settings
   */
  bindHost: {
    description: `The address to bind the listener to. ${'Default:'.bold} ${defaults.bindHost.toString().green}`,
    requiresArg: true,
    type: 'string'
  },
  grpcPort: {
    description: `The port of the Cloud Functions Emulator gRPC API. ${'Default:'.bold} ${defaults.grpcPort.toString().green}`,
    requiresArg: true,
    type: 'number'
  },
  host: {
    description: `The host of the Cloud Functions Emulator. ${'Default:'.bold} ${defaults.host.toString().green}`,
    requiresArg: true,
    type: 'string'
  },
  idlePruneInterval: {
    description: `How often (in milliseconds) to check workers for idleness, for possible pruning. ${'Default:'.bold} ${defaults.idlePruneInterval.toString().green}`,
    requiresArg: true,
    type: 'number'
  },
  logFile: {
    description: `The path to the logs file to which function logs will be written. ${'Default:'.bold} ${defaults.logFile.toString().green}`,
    requiresArg: true,
    type: 'string'
  },
  maxIdle: {
    description: `Maximum time (in milliseconds) a worker function can sit idle before it will be closed. ${'Default:'.bold} ${defaults.maxIdle.toString().green}`,
    requiresArg: true,
    type: 'number'
  },
  restPort: {
    description: `The port of the Cloud Functions Emulator REST API. ${'Default:'.bold} ${defaults.restPort.toString().green}`,
    requiresArg: true,
    type: 'number'
  },
  supervisorPort: {
    description: `The port of the Supervisor, which hosts HTTP functions. ${'Default:'.bold} ${defaults.supervisorPort.toString().green}`,
    requiresArg: true,
    type: 'number'
  },
  tail: {
    description: `When ${'true'.bold}, the Emulator will capture the terminal and logs will be streamed to the console in addition to being streamed to the log file. ${'Default:'.bold} ${defaults.tail.toString().green}`,
    requiresArg: false,
    type: 'boolean'
  },
  useMocks: {
    description: `When ${'true'.bold}, ${'mocks.js'.green} will be loaded at startup. ${'Default:'.bold} ${defaults.useMocks.toString().green}`,
    requiresArg: false,
    type: ['boolean', 'string']
  },
  verbose: {
    description: `When ${'true'.bold}, shows debug logs from the Emulator itself in the log file. ${'Default:'.bold} ${defaults.verbose.toString().green}`,
    requiresArg: false,
    type: 'boolean'
  },
  watch: {
    description: `When ${'true'.bold}, automatically reloads deployed functions on file changes. ${'Default:'.bold} ${defaults.watch.toString().green}`,
    requiresArg: false,
    type: 'boolean'
  },
  watchIgnore: {
    description: `List of patterns that the file watcher should ignore. ${'Default:'.bold} ${defaults.watchIgnore.toString().green}`,
    requiresArg: true,
    type: 'array'
  }
};
