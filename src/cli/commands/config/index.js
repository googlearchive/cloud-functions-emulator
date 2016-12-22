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

const description = `Available configuration options:

  ${'EMULATOR'.underline}
      ${'grpcHost'.bold}
          The host the gRPC service should listen on. ${'Default:'.bold} ${'"localhost"'.green}

      ${'grpcPort'.bold}
          The port the gRPC service should listen on. ${'Default:'.bold} ${'8009'.green}

      ${'restHost'.bold}
          The host the REST service should listen on. ${'Default:'.bold} ${'"localhost"'.green}

      ${'restPort'.bold}
          The port the REST service should listen on. ${'Default:'.bold} ${'8008'.green}

  ${'SUPERVISOR'.underline}
      ${'debug'.bold}
          When true, enables the Node.js Debugger for function invocations. ${'Default:'.bold} ${'false'.green}

      ${'debugPort'.bold}
          The port for the Node.js Debugger. ${'Default:'.bold} ${'5858'.green}

      ${'inspect'.bold}
          When true, enables the Node.js Inspector for function invocations. ${'Default:'.bold} ${'false'.green}

      ${'inspectPort'.bold}
          The port for the Node.js Inspector. ${'Default:'.bold} ${'9229'.green}
`;

/**
 * http://yargs.js.org/docs/#methods-commandmodule-providing-a-command-module
 */
exports.command = 'config <command>';
exports.describe = 'Manages emulator configuration.';
exports.builder = (yargs) => {
  return yargs
    .demand(1)
    .command(require('./list'))
    .command(require('./set'))
    .epilogue(description);
};

/**
 * Handler for the "config" command.
 */
exports.handler = () => {};
