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

const grpc = require('grpc');
const merge = require('lodash.merge');
const uuid = require('uuid');

const protos = require('./protos');

const NAME_REG_EXP = /^operations\/([-A-Za-z0-9]+)$/;

/**
 * The Operation class is an abstraction around objects of type
 * "google.longrunning.Operation". Instances of this class are passed around
 * in the application code, but are serialized to protobufs or JSON when sent
 * over the wire.
 *
 * @class Operation
 * @param {string} name The name of the Operation, e.g. "operations/abcd1234"
 * @param {object} [props] Optional hash of properties with which to initialize
 *     the instance.
 * @returns {Operation}
 */
class Operation {
  constructor (name, props = {}) {
    if (!name || typeof name !== 'string' || !Operation.NAME_REG_EXP.test(name)) {
      const message = `Invalid value '${name}': Operation name must contain only lower case Latin letters, digits and hyphens (-).`;
      const err = new Error(message);
      err.code = grpc.status.INVALID_ARGUMENT;
      err.details = [
        {
          typeUrl: 'types.googleapis.com/google.rpc.BadRequest',
          value: {
            fieldViolations: [
              {
                field: 'name',
                description: message
              }
            ]
          }
        },
        {
          typeUrl: 'types.googleapis.com/google.rpc.ResourceInfo',
          value: {
            resourceType: protos.getPath(protos.Operation),
            resourceName: name,
            description: err.message
          }
        },
        {
          typeUrl: 'types.googleapis.com/google.rpc.DebugInfo',
          value: {
            stackEntries: err.stack.split('\n'),
            detail: err.message
          }
        }
      ];
      throw err;
    }
    merge(this, Operation.decode(props), { name });
  }

  /**
   * A Regular Expression for validation an Operation's name.
   *
   * @property Operation.NAME_REG_EXP
   * @type {RegExp}
   */
  static get NAME_REG_EXP () {
    return NAME_REG_EXP;
  }

  /**
   * Decodes an Operation message.
   *
   * @method Operation.decode
   * @param {object} operation The Operation to decode.
   * @returns {object} The decoded operation.
   */
  static decode (operation = {}) {
    // Decode the top-level Operation message fields
    operation = protos.decode(operation, protos.Operation);

    // Decode the Operation error details, if any
    if (operation.error && Array.isArray(operation.error.details)) {
      operation.error.details.forEach((detail) => {
        protos.decodeAnyType(detail);
      });
    }

    // Validate the oneOf property of "error" and "response"
    if (operation.error && operation.response) {
      const message = `Operation may only have one of 'error' or 'response'!`;
      const err = new Error(message);
      err.code = grpc.status.INVALID_ARGUMENT;
      err.details = [
        {
          typeUrl: 'google.rpc.BadRequest',
          value: {
            fieldViolations: [
              {
                field: 'error',
                description: message
              },
              {
                field: 'response',
                description: message
              }
            ]
          }
        }
      ];
      throw err;
    }

    return operation;
  }

  /**
   * Generates a new Operation name.
   *
   * @method Operation.generateId
   * @returns {string} The auto-generated Operation name.
   */
  static generateId () {
    return `operations/${uuid.v4()}`;
  }

  /**
   * Convert this Operation instance into a gRPC Operation message.
   *
   * @method Operation#toProtobuf
   * @returns {object} The encoded Operation message.
   */
  toProtobuf () {
    // Get a sanitized copy of this Operation instance.
    const operation = Operation.decode(this);

    // Encode objects of type "google.protobuf.Any".
    protos.encodeAnyType(operation.metadata);
    protos.encodeAnyType(operation.response);
    if (operation.error && Array.isArray(operation.error.details)) {
      operation.error.details.forEach((detail) => {
        protos.encodeAnyType(detail);
      });
    }

    if (operation.error instanceof Error) {
      const details = operation.error.details;
      operation.error = {
        code: operation.error.code,
        message: operation.error.message
      };
      if (details) {
        operation.error.details = details;
      }
    }

    return operation;
  }

  /**
   * Convert this Operation instance into an object suitable for transport over
   * REST (JSON).
   *
   * @method Operation#toJSON
   * @returns {object} The formatted object.
   */
  toJSON () {
    // Return a sanitized copy of this Operation instance. There's no need to
    // encode anything.
    return Operation.decode(this);
  }
}

module.exports = Operation;
