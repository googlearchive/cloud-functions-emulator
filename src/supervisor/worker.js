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

// Debugging information: TODO
'use strict';

const bodyParser = require('body-parser');
const express = require('express');
const path = require('path');
const serializerr = require('serializerr');
const request = require('supertest');

const Debug = require('../utils/debug');

const inspect = Debug.getInspect();
const debug = Debug.getDebug();

let _originalLoader = null;

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

function main (name, cloudfunction, context, event, callback) {
  let start;

  if (!callback) {
    callback = (err, result) => {
      const duration = Date.now() - start;
      console.log(`Execution took ${duration} ms, user function completed successfully`);
      if (err) {
        process.send({
          error: err
        });
        setImmediate(() => {
          process.exit(1);
        });
      } else {
        process.send({ result });
        setImmediate(() => {
          process.exit(0);
        });
      }
    };
  }

  // Unload the code if is already loaded
  delete require.cache[cloudfunction.serviceAccount];

  if (context.useMocks) {
    try {
      let override;
      if (typeof context.useMocks === 'string') {
        override = require(path.resolve(context.useMocks));
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
  const functionModule = require(cloudfunction.serviceAccount);
  const handler = functionModule[cloudfunction.entryPoint || name];

  if (!handler) {
    throw new Error(`No function found with name ${cloudfunction.entryPoint || name}`);
  }

  const errback = (err, result) => {
    if (err) {
      callback(serializerr(err));
    } else {
      callback(null, result);
    }
  };

  if (cloudfunction.httpsTrigger) {
    if (context.req && context.res) {
      try {
        console.log(`User function triggered, starting execution`);
        start = Date.now();
        // The following line invokes the function
        handler(context.req, context.res);
      } catch (err) {
        errback(err);
      }
      return;
    } else {
      const app = express();
      app.use(bodyParser.json());
      app.use(bodyParser.raw());
      app.use(bodyParser.text());
      app.use(bodyParser.urlencoded({
        extended: true
      }));
      app.all('*', handler);

      try {
        console.log(`User function triggered, starting execution`);
        start = Date.now();
        let agent = request(app)[(context.method || 'POST').toLowerCase()](context.originalUrl)
          .set(context.headers)
          .query(context.query)
          .send(event.data);

        if (inspect.enabled || debug.enabled) {
          debugger; // eslint-disable-line
        }
        // The following line invokes the function
        agent.end((err, response) => {
          if (err) {
            errback(err);
            return;
          }
          errback(null, {
            body: response.text,
            statusCode: response.statusCode,
            headers: response.headers
          });
        });
      } catch (err) {
        errback(err);
      }
      return;
    }
  } else {
    if (handler.length >= 2) {
      // Pass in the event and the errback
      try {
        if (inspect.enabled || debug.enabled) {
          debugger; // eslint-disable-line
        }
        console.log(`User function triggered, starting execution`);
        start = Date.now();
        // The following line invokes the function
        handler(event, errback);
      } catch (err) {
        errback(err);
      }
      return;
    } else {
      // Just pass in the event, and wrap in a promise
      return Promise.resolve()
        .then(() => {
          if (inspect.enabled || debug.enabled) {
            debugger; // eslint-disable-line
          }
          console.log(`User function triggered, starting execution`);
          start = Date.now();
          // The following line invokes the function
          return handler(event);
        })
        .then((result) => {
          errback(null, result);
        })
        .catch(errback);
    }
  }
}

module.exports = main;

if (module === require.main) {
  const args = process.argv.slice(2);
  const name = args.shift();
  const cloudfunction = JSON.parse(args.shift());
  const context = JSON.parse(args.shift());
  const event = JSON.parse(args.shift());

  main(name, cloudfunction, context, event);
}
