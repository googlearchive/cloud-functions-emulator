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
const uuid = require('uuid');

const Errors = require('../utils/errors');
const protos = require('./protos');
const Schema = require('../utils/schema');

const NAME_REG_EXP = /^operations\/([-A-Za-z0-9]+)$/;

const OperationSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string'
    }
  },
  required: ['name']
};

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
      const err = new Errors.InvalidArgumentError(`Invalid value '${name}': Operation name must contain only lower case Latin letters, digits and hyphens (-).`);
      err.details.push(new Errors.BadRequest(err, 'name'));
      err.details.push(new Errors.ResourceInfo(err, protos.getPath(protos.Operation), name));
      throw err;
    }
    _.merge(this, Operation.decode(props), { name });
    const errors = Schema.validate(this, Operation.schema);
    if (errors) {
      const err = new Errors.InvalidArgumentError('Invalid Operation property!');
      err.details.push(new Errors.BadRequest(err, errors));
      err.details.push(new Errors.ResourceInfo(err, protos.getPath(protos.Operation), name));
      throw err;
    }
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
   * The JSON Schema for the Operation class.
   *
   * @property Operation.schema
   * @type {object}
   */
  static get schema () {
    return OperationSchema;
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
      err.code = Errors.status.INVALID_ARGUMENT;
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
   * Returns a formatted Operation name string.
   *
   * @method Operation.formatName
   * @param {string} name The value for the name path parameter.
   * @returns {string} The formatted name string.
   */
  static formatName (name) {
    return `operations/${name}`;
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
   * Parses a formatted Operation name string.
   *
   * @method Operation.parseName
   * @param {string} name The formatted Operation name string.
   * @returns {object} The parsed parameters.
   */
  static parseName (name = '') {
    const matches = name.match(Operation.NAME_REG_EXP);
    return {
      operation: matches ? matches[1] : null
    };
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
