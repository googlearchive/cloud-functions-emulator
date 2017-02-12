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

const execSync = require('child_process').execSync;

let cloudSDKProjectId = '';

function trim (str) {
  if (str && typeof str.toString === 'function') {
    return str.toString().trim();
  }
  return str;
}

module.exports = (projectId, printWarning = true) => {
  if (projectId) {
    return projectId;
  }
  if (process.env.GCLOUD_PROJECT) {
    return process.env.GCLOUD_PROJECT;
  }
  if (cloudSDKProjectId) {
    return cloudSDKProjectId;
  }
  try {
    if (printWarning) {
      console.log(`Inferring project ID from Cloud SDK config. Speed up CLI commands by setting a project ID: ${'functions config set projectId YOUR_PROJECT_ID'.bold} or ${'export GCLOUD_PROJECT=YOUR_PROJECT_ID'.bold}`);
    }
    cloudSDKProjectId = projectId = trim(execSync(`gcloud info --format='value(config.project)'`));
  } catch (err) {
    // Print some error message?
  }

  if (projectId) {
    return projectId;
  }

  let isConfigCommand = false;

  process.argv.forEach((arg, i) => {
    const nextArg = process.argv[i + 1];
    if (arg === 'config' && (nextArg === 'set' || nextArg === 'get' || nextArg === 'list')) {
      isConfigCommand = true;
      return false;
    }
  });

  if (!isConfigCommand) {
    throw new Error('Please provide a project ID: "functions config set projectId YOUR_PROJECT_ID" or "functions start --projectId YOUR_PROJECT_ID" or "export GCLOUD_PROJECT=YOUR_PROJECT_ID"');
  }
};
