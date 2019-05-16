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
const axios = require('axios');
const net = require('net');
const path = require('path');
const url = require('url');

const Client = require('./client');
const Model = require('../model');

const { CloudFunction } = Model;

class RestClient extends Client {
  callFunction (name, data, opts) {
    var resource = { data: data };
    if (opts) {
      resource = _.merge(resource, opts);
    }

    return axios.post(this.getUrl(`${CloudFunction.formatName(this.config.projectId, this.config.region, name)}:call`), resource).then((response) => {
      const body = response.data;
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
    return axios.post(this.getUrl(`${CloudFunction.formatLocation(this.config.projectId, this.config.region)}/functions`), cloudfunction).then((response) => [response.data, response]);
  }

  deleteFunction (name) {
    return axios.request({
      url: this.getUrl(CloudFunction.formatName(this.config.projectId, this.config.region, name)),
      method: 'DELETE'
    }).then((response) => [response.data, response]);
  }

  generateUploadUrl (name) {
    return axios.post(
      this.getUrl(`${CloudFunction.formatLocation(this.config.projectId, this.config.region)}/functions:generateUploadUrl`)
    )
      .then((response) => [response.data, response]);
  }

  getUrl (pathname) {
    return url.format({
      protocol: 'http:',
      hostname: this.config.host,
      port: this.config.restPort,
      pathname: path.join('v1', pathname)
    });
  }

  getFunction (name) {
    return axios.get(this.getUrl(CloudFunction.formatName(this.config.projectId, this.config.region, name)))
      .then((response) => [new CloudFunction(response.data.name, response.data), response]);
  }

  getOperation (name) {
    return axios.get(this.getUrl(name)).then(response => response.data);
  }

  listFunctions () {
    return axios.get(this.getUrl(`${CloudFunction.formatLocation(this.config.projectId, this.config.region)}/functions`), {
      params: {
        pageSize: 100
      }
    }).then((response) => [response.data.functions.map((cloudfunction) => new CloudFunction(cloudfunction.name, cloudfunction)), response]);
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
