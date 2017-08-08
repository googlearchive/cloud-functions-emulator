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
const google = require('googleapis');
const net = require('net');
const path = require('path');
const url = require('url');

const Client = require('./client');
const Model = require('../model');

const { CloudFunction } = Model;

class RestClient extends Client {
  _action (method, params) {
    return this.getService()
      .then((functionsService) => {
        return new Promise((resolve, reject) => {
          _.get(functionsService, method).call(functionsService, params, (err, body, response) => {
            if (err) {
              reject(err);
            } else {
              resolve([body, response]);
            }
          });
        });
      });
  }

  callFunction (name, data, opts) {
    var resource = { data: data };
    if (opts) {
      resource = _.merge(resource, opts);
    }

    return this._action(
      'projects.locations.functions.call',
      {
        name: CloudFunction.formatName(this.config.projectId, this.config.region, name),
        resource: resource
      }
    ).then(([body, response]) => {
      if (body.result && typeof body.result === 'string') {
        try {
          body.result = JSON.parse(body.result);
        } catch (err) {

        }
      } else if (body.error && typeof body.error === 'string') {
        try {
          body.error = JSON.parse(body.error);
        } catch (err) {

        }
      }
      return [body, response];
    });
  }

  createFunction (cloudfunction) {
    return this._action(
      'projects.locations.functions.create',
      {
        location: CloudFunction.formatLocation(this.config.projectId, this.config.region),
        resource: cloudfunction
      }
    );
  }

  deleteFunction (name) {
    return this._action(
      'projects.locations.functions.delete',
      {
        name: CloudFunction.formatName(this.config.projectId, this.config.region, name)
      }
    );
  }

  getService () {
    return new Promise((resolve, reject) => {
      const discoveryPath = '$discovery/rest';
      const parts = url.parse(this.getUrl(discoveryPath));
      const discoveryUrl = url.format(_.merge(parts, {
        pathname: discoveryPath,
        search: '?version=v1beta2'
      }));

      google.discoverAPI(discoveryUrl, (err, functions) => {
        if (err) {
          reject(err);
        } else {
          resolve(functions);
        }
      });
    });
  }

  getUrl (pathname) {
    return url.format({
      protocol: 'http:',
      hostname: this.config.host,
      port: this.config.restPort,
      pathname: path.join('v1beta2', pathname)
    });
  }

  getFunction (name) {
    return this._action(
      'projects.locations.functions.get',
      {
        name: CloudFunction.formatName(this.config.projectId, this.config.region, name)
      }
    ).then(([body, response]) => [new CloudFunction(body.name, body), response]);
  }

  getOperation (name) {
    return this._action('operations.get', { name });
  }

  listFunctions () {
    return this._action(
      'projects.locations.functions.list',
      {
        pageSize: 100,
        location: CloudFunction.formatLocation(this.config.projectId, this.config.region)
      }
    ).then(([body, response]) => [body.functions.map((cloudfunction) => new CloudFunction(cloudfunction.name, cloudfunction)), response]);
  }

  testConnection () {
    return new Promise((resolve, reject) => {
      const client = net.connect(this.config.restPort, this.config.host, () => {
        client.end();
        resolve();
      });
      client.on('error', reject);
    });
  }
}

module.exports = RestClient;
