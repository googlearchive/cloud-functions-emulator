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

module.exports = {

  /**
   * Invokes a deployed function.  This exists purely to provide a default
   * breakpoint for debug mode.  Node's debugging story is a little lumpy
   * simply due to the fact that there are many IDE environments without
   * dedicated debugging capabilities.  Thus setting breakpoints in code in a
   * way that survives process restarts can be cumbersome.  This is guaranteed
   * to fire when the server is running in debug mode.
   *
   * @param {Function} fn The function to be invoked
   * @param {Object} arg1  The first argument to the function.  In the case of HTTP
   *                       functions this is an HTTP request.  In the case of
   *                       BACKGROUND functions this is the 'event' object
   * @param {Object} arg2  The second argument to the function.  In the case of
   *                       HTTP functions this is an HTTP response.  In the
   *                       case of BACKGROUND functions this is the (optional) 'callback' arg
   */
  invoke: function (fn, mod, arg1, arg2) {
    // Return the outcome to accommodate the return of a Promise
    return fn.call(mod, arg1, arg2);
  }
};
