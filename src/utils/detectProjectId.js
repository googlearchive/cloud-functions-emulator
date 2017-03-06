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

const execSync = require('child_process').execSync;

function trim (str) {
  if (str && typeof str.toString === 'function') {
    return str.toString().trim();
  }
  return str;
}

module.exports = (projectId) => {
  if (projectId) {
    return projectId;
  }
  if (process.env.GCLOUD_PROJECT) {
    return process.env.GCLOUD_PROJECT;
  }
  if (process.env.GOOGLE_CLOUD_PROJECT) {
    return process.env.GOOGLE_CLOUD_PROJECT;
  }
  try {
    projectId = trim(execSync(`gcloud info --format='value(config.project)'`));
  } catch (err) {
    // Print some error message?
  }

  return projectId;
};
