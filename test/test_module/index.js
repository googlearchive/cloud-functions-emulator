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

module.exports = {
  hello (event, callback) {
    console.log('first stdout');
    setTimeout(() => {
      console.error('second stderr');
    }, 50);
    setTimeout(() => {
      callback(null, 'Hello World');
      console.log('late stdout');
    }, 100);
  },
  helloData (event, callback) {
    callback(null, event.data['foo']);
  },
  helloPromise (event) {
    return event.data['foo'];
  },
  helloJSON (event, callback) {
    callback(null, {
      message: 'Hello World'
    });
  },
  helloSlow (req, res) {
    setTimeout(() => {
      res.status(200).send('too slow').end();
    }, 10000);
  },
  helloNoResponse (req, res) {
    setTimeout(() => {
      res.send(var_does_not_exist_this_will_fail).end(); // eslint-disable-line
    }, 1000);
  },
  helloGET (req, res) {
    console.log(req.method);
    res.send({
      method: req.method,
      headers: req.headers,
      query: req.query,
      path: req.path
    }).end();
  },
  helloPOST (req, res) {
    res.send({
      method: req.method,
      headers: req.headers,
      body: req.body
    }).end();
  },
  helloModule (req, res) {
    const path = require('path');
    res.send(path.join('foo', 'bar')).end();
  },
  helloPubSub (event) {
    const pubsubMessage = event.data;
    if (pubsubMessage.data) {
      // Decode
      pubsubMessage.data = Buffer.from(pubsubMessage.data, 'base64').toString();
      try {
        // Maybe the data is JSON
        pubsubMessage.data = JSON.parse(pubsubMessage.data);
      } catch (err) {

      }
    }
    console.log('attributes', pubsubMessage.attributes);
    console.log('data', pubsubMessage.data);
  },
  helloThrow (event, callback) {
    throw new Error('uncaught exception!');
  },
  helloReject (event, callback) {
    return Promise.reject(new Error('uncaught exception!'));
  },
  helloWorld (req, res) {
    // Example input: {"message": "Hello!"}
    if (req.body.message === undefined) {
      // This is an error case, as "message" is required.
      res.status(400).send('No message defined!');
    } else {
      // Everything is okay.
      console.log(req.body.message);
      res.status(200).send('Success: ' + req.body.message);
    }
  }
};
