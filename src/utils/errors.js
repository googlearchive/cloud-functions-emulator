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
const http = require('http');

const protos = require('../model/protos');

class ExtendableError extends Error {
  constructor (message, details = []) {
    super(message);
    this.name = this.constructor.name;
    Object.defineProperty(this, 'message', {
      configurable: true,
      writable: true,
      enumerable: true,
      value: message
    });
    this.details = details;
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = (new Error(message)).stack;
    }
    this.details.push(new DebugInfo(this));
  }

  static decode (err) {
    // Decode the top-level Status message fields.
    err = protos.decode(err, protos.Status);

    if (Array.isArray(err.details)) {
      err.details.forEach((detail) => {
        protos.encodeAnyType(detail);
      });
    }

    return err;
  }

  toProtobuf () {
    // Get a sanitized copy of this ExtendableError instance.
    return ExtendableError.decode(this);
  }
}

class BadRequest {
  constructor (err, fieldViolations, message) {
    this.typeUrl = 'types.googleapis.com/google.rpc.BadRequest';
    if (typeof fieldViolations === 'string') {
      this.value = {
        fieldViolations: [
          {
            field: fieldViolations,
            description: message || err.message || http.STATUS_CODES[err.code] || http.STATUS_CODES['400']
          }
        ]
      };
    } else {
      this.value = { fieldViolations };
    }
  }
}

class DebugInfo {
  constructor (err) {
    this.typeUrl = 'types.googleapis.com/google.rpc.DebugInfo';
    this.value = {
      stackEntries: (err.stack || '').split('\n'),
      detail: err.message || http.STATUS_CODES[err.code] || http.STATUS_CODES['500']
    };
  }
}

class ResourceInfo {
  constructor (err, type, name) {
    this.typeUrl = 'types.googleapis.com/google.rpc.ResourceInfo';
    this.value = {
      description: err.message,
      resourceType: type,
      resourceName: name
    };
  }
}

class ConflictError extends ExtendableError {
  constructor (...args) {
    super(...args);
    this.code = grpc.status.ALREADY_EXISTS;
  }
}

class InternalError extends ExtendableError {
  constructor (...args) {
    super(...args);
    this.code = grpc.status.INTERNAL;
  }
}

class InvalidArgumentError extends ExtendableError {
  constructor (...args) {
    super(...args);
    this.code = grpc.status.INVALID_ARGUMENT;
  }
}

class NotFoundError extends ExtendableError {
  constructor (...args) {
    super(...args);
    this.code = grpc.status.NOT_FOUND;
  }
}

function sendRestError (err, res) {
  if (!(err instanceof Error) && err.name && err.stack && err.message) {
    const _err = err;
    err = new Error(_err.message);
    err.stack = _err.stack;
  }

  if (err instanceof InvalidArgumentError) {
    res.status(400).json({
      error: {
        code: 400,
        status: 'INVALID_ARGUMENT',
        message: err.message || http.STATUS_CODES['400'],
        errors: [err.message || http.STATUS_CODES['400']]
      }
    }).end();
  } else if (err instanceof ConflictError) {
    res.status(409).json({
      error: {
        code: 409,
        status: 'ALREADY_EXISTS',
        message: err.message || http.STATUS_CODES['409'],
        errors: [err.message || http.STATUS_CODES['409']]
      }
    }).end();
  } else if (err instanceof NotFoundError) {
    res.status(404).json({
      error: {
        code: 404,
        status: 'NOT_FOUND',
        message: err.message || http.STATUS_CODES['404'],
        errors: [err.message || http.STATUS_CODES['404']]
      }
    }).end();
  } else if (err instanceof InternalError) {
    res.status(500).json({
      error: {
        code: 500,
        status: 'INTERNAL',
        message: err.message || http.STATUS_CODES['500'],
        errors: [err.message || http.STATUS_CODES['500']]
      }
    }).end();
  } else {
    res.status(500).send(err && err.message ? err.message : '').end();
  }
}

exports.sendRestError = sendRestError;
exports.status = grpc.status;
exports.BadRequest = BadRequest;
exports.DebugInfo = DebugInfo;
exports.ResourceInfo = ResourceInfo;
exports.ConflictError = ConflictError;
exports.InternalError = InternalError;
exports.InvalidArgumentError = InvalidArgumentError;
exports.NotFoundError = NotFoundError;
