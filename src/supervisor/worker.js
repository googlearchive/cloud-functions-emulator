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

const _ = require('lodash');
const bodyParser = require('body-parser');
const express = require('express');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const serializerr = require('serializerr');
const url = require('url');

let _originalLoader = null;

function getLocaldir (cloudfunction) {
  cloudfunction || (cloudfunction = {});
  const sourceUploadUrl = cloudfunction.sourceUploadUrl || '';
  const parts = url.parse(sourceUploadUrl);
  const query = querystring.parse(parts.query);
  return query.localdir;
}

const loadHandler = {
  init (handler) {
    const Module = require('module');
    _originalLoader = Module._load;
    Module._load = function (...args) {
      const override = handler.onRequire(process.env['FUNCTION_NAME'], args[0]);
      return (override || _originalLoader.apply(this, args));
    };
  }
};

function main () {
  process.on('message', (message) => {
    const name = message.name;
    const cloudfunction = message.cloudfunction;
    const localdir = getLocaldir(cloudfunction);

    // Unload the code if is already loaded
    delete require.cache[localdir];

    if (message.useMocks) {
      try {
        let override;
        if (typeof message.useMocks === 'string') {
          override = require(path.resolve(message.useMocks));
        } else {
          override = require(path.join(__dirname, '../../mocks'));
        }
        if (override) {
          loadHandler.init(override);
          console.log('Mock handler found. Require calls will be intercepted');
        }
      } catch (e) {
        console.error('Mocks enabled but no mock handler found. Require calls will NOT be intercepted');
        console.error(e);
      }
    }

    // Require the target module to load the function for invocation
    const functionModule = require(localdir);
    const handler = _.get(functionModule, cloudfunction.entryPoint || name);

    if (!handler) {
      throw new Error(`No function found with name ${cloudfunction.entryPoint || name}`);
    }

    const app = express();

    const requestLimit = '1024mb';

    const rawBodySaver = (req, res, buf) => {
      req.rawBody = buf;
    };

    const rawBodySavingOptions = {
      limit: requestLimit,
      verify: rawBodySaver
    };

    // Use extended query string parsing for URL-encoded bodies.
    const urlEncodedOptions = {
      limit: requestLimit,
      verify: rawBodySaver,
      extended: true
    };

    // Parse request body
    app.use(bodyParser.raw(rawBodySavingOptions));
    app.use(bodyParser.json(rawBodySavingOptions));
    app.use(bodyParser.text(rawBodySavingOptions));
    app.use(bodyParser.urlencoded(urlEncodedOptions));

    // Never cache
    app.use((req, res, next) => {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', 0);
      next();
    });

    app.use((req, res) => {
      const start = Date.now();
      console.log(`User function triggered, starting execution`);

      const errback = (err, result) => {
        if (err) {
          console.log(`Function crashed`);
          console.log(err);
          res.status(500).json(serializerr(err));
        } else {
          res.json(result);
          const duration = Date.now() - start;
          console.log(`Execution took ${duration} ms, user function completed successfully`);
        }

        res.end();
      };

      try {
        if (cloudfunction.httpsTrigger) {
          res.on('finish', () => {
            const duration = Date.now() - start;
            console.log(`Execution took ${duration} ms, user function completed successfully`);
          });

          handler(req, res);
        } else {
          if (handler.length >= 2) {
            handler(req.body, errback);
          } else {
            return Promise.resolve()
              .then(() => handler(req.body))
              .then((result) => {
                errback(null, result);
              })
              .catch(errback);
          }
        }
      } catch (err) {
        errback(err);
      }
    });

    app.use((err, req, res, next) => {
      console.error(err);
    });

    const server = app.listen(0, 'localhost', () => {
      process.send({
        port: server.address().port
      });
    });

    // Only start watching for file changes if the funciton is not in debug mode
    if (localdir && !message.debug && message.watch) {
      fs.watch(localdir, {
        recursive: true
      }, (event, filename) => {
        // Ignore node_modules
        if (Array.isArray(message.watchIgnore)) {
          for (let i = 0; i < message.watchIgnore.length; i++) {
            if ((new RegExp(message.watchIgnore[i])).test(filename)) {
              return;
            }
          }
        }

        process.send({
          close: true
        });
        server.close(() => {
          console.log(`Worker for ${name} closed due to file changes.`);
          process.exit();
        });
      });
    }
  });

  process.send({
    ready: true
  });
}

module.exports = main;

if (module === require.main) {
  main();
}
