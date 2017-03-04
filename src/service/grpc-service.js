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

const got = require('got');
const grpc = require('grpc');
const http = require('http');
const uuid = require('uuid');

const Model = require('../model');
const Service = require('./service');

const {
  Metadata,
  Server,
  ServerCredentials,
  status
} = grpc;

const { CloudFunction, protos } = Model;

function notImplemented (call, cb) {
  cb({
    code: status.UNIMPLEMENTED,
    details: http.STATUS_CODES['501']
  });
}

class RpcService extends Service {
  constructor (...args) {
    super(...args);

    this.type = 'gRPC';
    this.server = new Server();

    this.server.addProtoService(protos.Operations.service, {
      cancelOperation: notImplemented,
      deleteOperation: notImplemented,
      getOperation: (call, cb) => this.getOperation(call, cb),
      listOperations: notImplemented
    });

    this.server.addProtoService(protos.CloudFunctionsService.service, {
      callFunction: (call, cb) => this.callFunction(call, cb).catch((err) => this.handleError(err, cb)),
      createFunction: (call, cb) => this.createFunction(call, cb).catch((err) => this.handleError(err, cb)),
      deleteFunction: (call, cb) => this.deleteFunction(call, cb).catch((err) => this.handleError(err, cb)),
      getFunction: (call, cb) => this.getFunction(call, cb).catch((err) => this.handleError(err, cb)),
      listFunctions: (call, cb) => this.listFunctions(call, cb).catch((err) => this.handleError(err, cb)),
      updateFunction: notImplemented
    });
  }

  /**
   * Calls a function.
   *
   * @param {object} call The rpc context.
   * @param {object} call.request The request.
   * @param {string} call.request.name The name of the function to call.
   * @param {string} call.request.data The data to send to the function.
   * @param {function} The callback function.
   */
  callFunction (call, cb) {
    const eventId = uuid.v4();
    return this.functions.getFunction(call.request.name)
      .then((cloudfunction) => {
        if (typeof call.request.data === 'string') {
          try {
            call.request.data = JSON.parse(call.request.data);
          } catch (err) {
            call.request.data = {};
          }
        }

        const event = {
          // A unique identifier for this execution
          eventId,
          // The current ISO 8601 timestamp
          timestamp: (new Date()).toISOString(),
          // TODO: The event type
          eventType: 'TODO',
          // TODO: The resource that triggered the event
          resource: 'TODO',
          // The event payload
          data: call.request.data
        };

        const parts = CloudFunction.parseName(call.request.name);

        return got.post(`http://${this.supervisor.config.host}:${this.supervisor.config.port}/${parts.project}/${parts.location}/${parts.name}`, {
          body: JSON.stringify(cloudfunction.httpsTrigger ? event.data : event),
          headers: {
            'Content-Type': 'application/json'
          },
          json: true
        });
      })
      .then((response) => {
        const message = {
          executionId: eventId
        };
        try {
          message.result = JSON.stringify(response.body);
        } catch (err) {

        }
        cb(null, message);
      }, (err) => {
        const message = {
          executionId: eventId
        };
        try {
          message.error = JSON.stringify(err.response.body);
        } catch (err) {

        }
        cb(null, message);
      });
  }

  /**
   * Creates a function.
   *
   * @param {object} call The rpc context.
   * @param {object} call.request The request.
   * @param {string} call.request.location The location for the new function.
   * @param {string} call.request.function The function data.
   * @param {function} The callback function.
   */
  createFunction (call, cb) {
    return this.functions.createFunction(call.request.location, call.request.function)
      .then((operation) => cb(null, operation.toProtobuf()))
      .then(() => this.supervisor.delete(call.request.function.name));
  }

  /**
   * Deletes a function.
   *
   * @param {object} call The rpc context.
   * @param {object} call.request The request.
   * @param {string} call.request.name The name of the function to delete.
   * @param {function} The callback function.
   */
  deleteFunction (call, cb) {
    return this.functions.deleteFunction(call.request.name)
      .then((operation) => cb(null, operation.toProtobuf()))
      .then(() => this.supervisor.delete(call.request.name));
  }

  /**
   * Gets a function.
   *
   * @param {object} call The rpc context.
   * @param {object} call.request The rpc request.
   * @param {string} call.request.name The name of the function to get.
   * @param {function} The callback function.
   */
  getFunction (call, cb) {
    return this.functions.getFunction(call.request.name)
      .then((cloudfunction) => cb(null, cloudfunction.toProtobuf()));
  }

  /**
   * Gets an operation.
   *
   * @param {object} call The rpc context.
   * @param {object} call.request The rpc request.
   * @param {string} call.request.name The name of the operation to get.
   * @param {function} The callback function.
   */
  getOperation (call, cb) {
    return this.functions.getOperation(call.request.name)
      .then((operation) => cb(null, operation.toProfobuf()));
  }

  handleError (err, cb) {
    console.error('GrpcService', err);

    err = err.toProtobuf();

    const error = {
      code: err.code || status.INTERNAL,
      details: err.message || http.STATUS_CODES['500']
    };

    if (Array.isArray(err.details)) {
      const metadata = new Metadata();
      err.details.forEach((detail, i) => {
        if (i) {
          metadata.add('detail-bin', Buffer.from(JSON.stringify(detail)));
        } else {
          metadata.set('detail-bin', Buffer.from(JSON.stringify(detail)));
        }
      });
      error.metadata = metadata;
    }

    cb(error);
  }

  /**
   * Lists functions.
   *
   * @param {object} call The rpc context.
   * @param {object} call.request The rpc request.
   * @param {string} call.request.location The project and location from which
   *     the function should be listed, specified in the format:
   *         projects/PROJECT/locations/LOCATION
   *     If you want to list functions in all locations, use '-' in place of a
   *     location.
   * @param {number} [call.request.pageSize] Maximum number of functions to
   *     return.
   * @param {string} [call.request.pageToken] The value returned by the last
   *     ListFunctionsResponse; indicates that this is a continuation of a prior
   *     ListFunctions call, and that the system should return the next page of
   *     data.
   * @param {function} The callback function.
   */
  listFunctions (call, cb) {
    console.log('LIST FUNCTIONS');
    const request = call.request;

    // This is used by the CLI to get a heartbeat from the gRPC Service
    if (call.request.location === 'heartbeat') {
      return Promise.resolve({
        functions: [],
        nextPageToken: ''
      }).then((response) => cb(null, response));
    }

    return this.functions.listFunctions(request.location, {
      pageToken: request.pageToken,
      pageSize: request.pageSize
    })
      .then((response) => {
        response.functions = response.functions.map((func) => func.toProtobuf());
        cb(null, response);
      });
  }

  start () {
    super.start();

    this.server.bind(`${this.config.host}:${this.config.port}`, ServerCredentials.createInsecure());
    this.server.start();
    console.debug(`${this.type} service listening at ${this.config.host}:${this.config.port}.`);

    return this;
  }

  stop () {
    this.server.tryShutdown(() => super.stop());

    return this;
  }
}

module.exports = RpcService;
