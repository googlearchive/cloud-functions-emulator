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

const fs = require('fs');
const path = require('path');
const readline = require('readline');

function readLogLines (filePath, linesToRead, output) {
  try {
    const parts = path.parse(filePath);
    const files = fs
      .readdirSync(parts.dir)
      .filter((file) => file && file.includes(parts.name));
    files.sort();

    // Here, we naively select the newest log file, even if the user wants to
    // display more lines than are available in the newest log file.
    const rl = readline.createInterface({
      input: fs.createReadStream(path.join(parts.dir, files[files.length - 1])),
      terminal: false
    });
    const lines = [];
    rl
      .on('line', (line) => {
        lines.push(line);
      })
      .on('close', () => {
        lines
          .slice(lines.length - linesToRead)
          .forEach((line) => output(`${line}\n`));
      });
  } catch (err) {
    if (err.code === 'ENOENT') {
      output('');
      return;
    }

    throw err;
  }
}

module.exports = {
  assertLogsPath (logFile) {
    if (!path.isAbsolute(logFile)) {
      logFile = path.join(__dirname, '../..', logFile);
    }

    const parts = path.parse(logFile);

    if (!_pathExists(parts.dir)) {
      fs.mkdirSync(parts.dir);
    }
    return logFile;
  },

  clearLogs (filePath) {
    try {
      fs.truncateSync(filePath);
    } catch (err) {
      throw err;
    }
  },

  readLogLines: readLogLines
};

function _pathExists (p) {
  try {
    fs.statSync(p);
    return true;
  } catch (e) {
    if (e.code === 'ENOENT') {
      return false;
    } else {
      throw e;
    }
  }
}
