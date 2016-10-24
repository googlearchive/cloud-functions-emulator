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

module.exports = {
  hello: function (data, callback) {
    callback(null, 'Hello World');
  },
  helloData: function (data, callback) {
    callback(null, data['foo']);
  },
  helloJSON: function (data, callback) {
    callback(null, {
      message: 'Hello World'
    });
  },
  helloThrow: function (data, callback) {
    throw new Error('uncaught exception!');
  }
};
