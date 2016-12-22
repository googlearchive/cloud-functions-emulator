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

const INSPECT_REG_EXP = /^--inspect=(\d+)$/;

exports.getInspect = (args = process.execArgv) => {
  let inspect = false;
  let port = 9229;

  args.forEach((arg) => {
    if (arg.includes('--inspect')) {
      inspect = true;
      const matches = arg.match(INSPECT_REG_EXP) || [];
      const _port = matches[1];
      if (_port && !isNaN(parseInt(_port, 10))) {
        port = _port;
      }
    }
  });

  return { enabled: inspect, port };
};

exports.getDebug = (args = process.execArgv) => {
  let debug = false;
  let port = process.debugPort;

  args.forEach((arg) => {
    if (arg.includes('--debug')) {
      debug = true;
    }
  });

  return { enabled: debug, port };
};
