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

/**
 * The mock callback allows you to override the value returned from a `require()` callback
 * This file will be loaded at emulator start time if config.useMocks is set to true in config.js
 */

/**
 * Called when the require() method is called
 * @param {String} func The name of the current function being invoked
 * @param {String} module The name of the module being required
 */
exports.onRequire = function (func, module) {
  // Return an object or module to override the named module argument
  return undefined;
};
