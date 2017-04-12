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
const EOL = require('os').EOL;

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

  readLogLines (filePath, num, output) {
    try {
      var buf = fs.readFileSync(filePath);
      var chr = null;
      var cursor = buf.length;
      var count = 0;

      for (var i = cursor; i >= 0; --i) {
        chr = buf.toString('utf8', i - 1, i);
        if (chr === EOL) {
          // We hit a newline char
          if (cursor !== i) {
            // Mark this position
            cursor = i;
            if (++count >= num) {
              break;
            }
          }
        }
      }

      // The last line in the squence (the first line in the file)
      // will not terminate with EOL, so ensure we're always include
      // the last line
      if (count < num) {
        cursor = 0;
      }

      output(buf.toString('utf8', cursor, buf.length) + '\n');
    } catch (err) {
      if (err.code === 'ENOENT') {
        output('');
        return;
      }

      throw err;
    }
  }
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
