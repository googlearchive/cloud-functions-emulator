/**
 * Copyright 2016, Google, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
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

var conf = {

  // The local TCP port on which the emulator will run
  port: 8008,

  // Set to true to see debug logs for the emulator itself
  verbose: true,

  // Your Cloud Platform project ID
  projectId: null,

  // The timeout in milliseconds to wait for the emulator to start
  timeout: 3000,

  // The name of the file into which function logs will be writter
  logFileName: 'cloud-functions-emulator.log',

  // The (relative) path to the logs directory
  logFilePath: 'logs'

};

module.exports = conf;
