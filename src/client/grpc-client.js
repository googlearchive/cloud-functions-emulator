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

const grpc = require('grpc');

const Client = require('./client');
const Model = require('../model');

const { CloudFunction, protos } = Model;

const { CloudFunctionsService, Operations } = protos;

class GrpcClient extends Client {
  constructor (opts) {
    super(opts);

    this._setup();
  }

  _setup () {
    this.functionsClient = new CloudFunctionsService(
      `${this.config.host}:${this.config.grpcPort}`,
      grpc.credentials.createInsecure()
    );
    this.operationsClient = new Operations(
      `${this.config.host}:${this.config.grpcPort}`,
      grpc.credentials.createInsecure()
    );
  }

  _processError (err) {
    if (err.metadata) {
      const details = err.metadata.get('detail-bin');
      if (Array.isArray(details)) {
        err.details = details.map((detail) => {
          detail = JSON.parse(detail.toString());
          protos.decodeAnyType(detail);
          return detail;
        });
      }
      err.metadata.remove('detail-bin');
      if (!Object.keys(err.metadata.getMap()).length) {
        delete err.metadata;
      }
    }
    return err;
  }

  callFunction (name, data) {
    return new Promise((resolve, reject) => {
      this.functionsClient.callFunction({
        name: CloudFunction.formatName(this.config.projectId, this.config.region, name),
        data: JSON.stringify(data)
      }, (err, body) => {
        if (err) {
          reject(this._processError(err));
        } else {
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
          const response = { body };
          resolve([body, response]);
        }
      });
    });
  }

  createFunction (cloudfunction) {
    return new Promise((resolve, reject) => {
      this.functionsClient.createFunction({
        location: CloudFunction.formatLocation(this.config.projectId, this.config.region),
        function: cloudfunction.toProtobuf()
      }, (err, operation) => {
        if (err) {
          reject(this._processError(err));
        } else {
          resolve([operation]);
        }
      });
    });
  }

  deleteFunction (name) {
    return new Promise((resolve, reject) => {
      this.functionsClient.deleteFunction({
        name: CloudFunction.formatName(this.config.projectId, this.config.region, name)
      }, (err, operation) => {
        if (err) {
          reject(this._processError(err));
        } else {
          operation.metadata = JSON.parse(Buffer.from(operation.metadata.value, 'base64').toString());
          operation.metadata.request = operation.metadata.request.value.toString('utf8');
          resolve([operation]);
        }
      });
    });
  }

  getFunction (name) {
    return new Promise((resolve, reject) => {
      this.functionsClient.getFunction({
        name: CloudFunction.formatName(this.config.projectId, this.config.region, name)
      }, (err, cloudfunction) => {
        if (err) {
          reject(this._processError(err));
        } else {
          resolve([new CloudFunction(cloudfunction.name, cloudfunction)]);
        }
      });
    });
  }

  getOperation (name) {
    return new Promise((resolve, reject) => {
      this.operationsClient.getOperation({ name }, (err, operation) => {
        if (err) {
          reject(this._processError(err));
        } else {
          resolve([operation]);
        }
      });
    });
  }

  listFunctions () {
    return new Promise((resolve, reject) => {
      this.functionsClient.listFunctions({
        pageSize: 100,
        location: CloudFunction.formatLocation(this.config.projectId, this.config.region)
      }, (err, response) => {
        if (err) {
          reject(this._processError(err));
        } else {
          resolve([
            response.functions.map((cloudfunction) => new CloudFunction(cloudfunction.name, cloudfunction))
          ]);
        }
      });
    });
  }

  testConnection () {
    return new Promise((resolve, reject) => {
      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + 3);
      // There's got to be a better way to get a "heartbeat" from the gRPC server
      this.functionsClient.listFunctions({
        pageSize: 1,
        location: 'heartbeat'
      }, { deadline }, (err, response) => {
        if (err) {
          reject(this._processError(err));
        } else {
          resolve();
        }
      });
    });
  }
}

module.exports = GrpcClient;
