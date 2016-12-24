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

const _ = require('lodash');
const Configstore = require('configstore');
const path = require('path');
const uuid = require('uuid');

const CloudFunction = require('./cloudfunction');
const Errors = require('../utils/errors');
const Operation = require('./operation');
const pkg = require('../../package.json');
const protos = require('./protos');
const Schema = require('../utils/schema');

class ConfigAdapter {
  constructor (opts = {}) {
    this._functions = new Configstore(path.join(pkg.name, '.functions'));
    this._operations = new Configstore(path.join(pkg.name, '.operations'));
  }

  createFunction (cloudfunction) {
    return Promise.resolve()
      .then(() => {
        this._functions.set(cloudfunction.name, cloudfunction);
      });
  }

  createOperation (operation = {}) {
    return Promise.resolve()
      .then(() => {
        operation.name = `operations/${uuid.v4()}`;
        this._operations.set(operation.name, operation);
        return operation;
      });
  }

  deleteFunction (name) {
    return Promise.resolve()
      .then(() => {
        this._functions.delete(name);
      });
  }

  getFunction (name) {
    return Promise.resolve().then(() => this._functions.get(name));
  }

  getOperation (name) {
    return Promise.resolve().then(() => this._operations.get(name));
  }

  listFunctions (opts = {}) {
    return Promise.resolve()
      .then(() => {
        const cloudfunctionsObj = this._functions.all;
        const cloudfunctions = [];
        for (let name in cloudfunctionsObj) {
          cloudfunctions.push(cloudfunctionsObj[name]);
        }
        return {
          functions: cloudfunctions,
          nextPageToken: ''
        };
      });
  }

  updateOperation (name, operation) {
    return Promise.resolve()
      .then(() => {
        this._operations.set(name, operation);
        return operation;
      });
  }
}

const FunctionsConfigSchema = {
  type: 'object',
  properties: {
    projectId: {
      type: 'string'
    },
    location: {
      type: 'string'
    },
    storage: {
      type: 'string',
      enum: ['configstore']
    },
    supervisorHost: {
      type: 'string'
    },
    supervisorPort: {
      type: 'number'
    }
  },
  required: ['projectId', 'location', 'storage', 'supervisorHost', 'supervisorPort']
};

/**
 * TODO
 *
 * @class Functions
 * @param {object} config Configuration settings.
 * @returns {Functions}
 */
class Functions {
  constructor (config = {}) {
    const errors = Schema.validate(config, Functions.configSchema);
    if (errors) {
      const err = new Errors.InvalidArgumentError('CloudFunctions config is invalid!');
      err.details.push(new Errors.BadRequest(err, errors));
      throw err;
    }
    this.config = _.merge({}, config);
    if (this.config.storage === 'configstore') {
      this.adapter = new ConfigAdapter(this.config);
    }
  }

  /**
   * The schema for the config argument passed to the Functions constructor.
   *
   * @name Functions.configSchema
   * @type {object}
   */
  static get configSchema () {
    return FunctionsConfigSchema;
  }

  /**
   * Asserts that a CloudFunction with the given name does not already exist.
   *
   * @method Functions#_assertFunctionDoesNotExist
   * @private
   * @param {string} name The name of the CloudFunction.
   * @returns {Promise}
   */
  _assertFunctionDoesNotExist (name) {
    return this.adapter.getFunction(name)
      .then((cloudfunction) => {
        if (cloudfunction) {
          const parts = CloudFunction.parseName(name);
          const err = new Errors.ConflictError(`Function ${parts.name} in location ${parts.location} in project ${parts.project} already exists`);
          err.details.push(new Errors.ResourceInfo(err, protos.getPath(protos.CloudFunction), name));
          console.error(err);
          return Promise.reject(err);
        }
      });
  }

  _unpackArchive (cloudfunction) {
    return Promise.resolve()
      .then(() => {
        if (!cloudfunction.serviceAccount) {
          throw new Error('Local deployment using "--source-url" is not supported yet!');
        }
        // Function was deployed from the local file system, so we're not going
        // to do anything else here.
      });
  }

  /**
   * Returns a new CloudFunction instance, initialized with the provided name
   * and properties.
   *
   * @method Functions#cloudfunction
   * @param {string} name The name of the CloudFunction.
   * @param {object} [props] Optional properties with which to initialize the
   *     CloudFunction instance.
   * @returns {CloudFunction} The new CloudFunction instance.
   */
  cloudfunction (name, props) {
    if (props instanceof CloudFunction) {
      return props;
    }
    return new CloudFunction(name, props);
  }

  /**
   * Formats an error used when there is a general error creating a
   * CloudFunction.
   *
   * @method Functions#_createFunctionError
   * @private
   * @param {string} name The name of the CloudFunction to create.
   * @param {object} err The error.
   * @param {Operation} operation The in-flight Operation, if any.
   * @returns {Promise}
   */
  _createFunctionError (name, err, operation) {
    err = new Errors.InternalError(err.message);
    err.details.push(new Errors.ResourceInfo(err, protos.getPath(protos.CloudFunction), name));

    if (operation) {
      operation.done = true;
      operation.error = _.cloneDeep(err);

      // Fire off the request to update the Operation
      this.adapter.updateOperation(operation.name, operation)
        .catch((err) => this._createFunctionError(name, err));
    }

    console.error(err);
    return Promise.reject(err);
  }

  /**
   * Creates a CloudFunction.
   *
   * @method Functions#createFunction
   * @param {string} location The location for the new CloudFunction.
   * @param {object} cloudfunction The CloudFunction configuration.
   * @returns {Promise}
   */
  createFunction (location, cloudfunction = {}) {
    console.debug('Functions', 'createFunction', location, cloudfunction);
    return Promise.resolve()
      .then(() => {
        const request = {
          location,
          function: _.cloneDeep(cloudfunction)
        };

        // TODO: Filter out fields that cannot be edited by the user
        cloudfunction = this.cloudfunction(cloudfunction.name, cloudfunction);

        if (cloudfunction.httpsTrigger) {
          cloudfunction.httpsTrigger.url = `http://${this.config.supervisorHost}:${this.config.supervisorPort}/${this.config.projectId}/${this.config.location}/${cloudfunction.shortName}`;
        }

        _.merge(cloudfunction, {
          // Just set status to READY because deployment is instant
          status: protos.CloudFunctionStatus.READY
        });

        return this._assertFunctionDoesNotExist(cloudfunction.name)
          .then(() => {
            const operationName = Operation.generateId();

            // Prepare the Operation
            const operation = this.operation(operationName, {
              done: false,
              metadata: {
                typeUrl: protos.getPath(protos.OperationMetadataV1Beta2),
                value: {
                  target: cloudfunction.name,
                  type: protos.OperationType.CREATE_FUNCTION,
                  request: {
                    typeUrl: protos.getPath(protos.CreateFunctionRequest),
                    value: request
                  }
                }
              }
            });

            return this.adapter.createOperation(operation)
              .then(() => {
                // Asynchronously perform the creation of the CloudFunction
                setImmediate(() => {
                  // Create the CloudFunction
                  this.adapter.createFunction(cloudfunction)
                    .then(() => this._unpackArchive(cloudfunction))
                    .then(() => {
                      operation.done = true;
                      operation.response = {
                        typeUrl: protos.getPath(protos.CloudFunction),
                        value: _.cloneDeep(cloudfunction)
                      };

                      // Fire off the request to update the Operation
                      this.adapter.updateOperation(operation.name, operation)
                        .catch((err) => this._createFunctionError(cloudfunction.name, err));
                    }, (err) => this._createFunctionError(cloudfunction.name, err, operation));
                });

                // Synchronously return the Operation instance
                return operation;
              }, (err) => this._createFunctionError(cloudfunction.name, err));
          });
      });
  }

  /**
   * Formats an error used when there is a general error deleting a
   * CloudFunction.
   *
   * @method Functions#_deleteFunctionError
   * @private
   * @param {string} name The name of the CloudFunction to delete.
   * @param {object} err The error.
   * @param {Operation} operation The in-flight Operation, if any.
   * @returns {Promise}
   */
  _deleteFunctionError (name, err, operation) {
    err = new Errors.InternalError(err.message);
    err.details.push(new Errors.ResourceInfo(err, protos.getPath(protos.CloudFunction), name));

    if (operation) {
      operation.done = true;
      operation.error = _.cloneDeep(err);

      // Fire off the request to update the Operation
      this.adapter.updateOperation(operation.name, operation)
        .catch((err) => this._deleteFunctionError(name, err));
    }

    console.error(err);
    return Promise.reject(err);
  }

  /**
   * Deletes a CloudFunction.
   *
   * @method Functions#deleteFunction
   * @param {string} name The name of the CloudFunction to delete.
   * @returns {Promise}
   */
  deleteFunction (name) {
    console.debug('Functions', 'deleteFunction', name);
    return this.getFunction(name)
      .then(() => {
        const operationName = Operation.generateId();

        // Prepare the Operation
        const operation = this.operation(operationName, {
          done: false,
          metadata: {
            typeUrl: protos.getPath(protos.OperationMetadataV1Beta2),
            value: {
              target: name,
              type: protos.OperationType.DELETE_FUNCTION,
              request: {
                typeUrl: protos.getPath(protos.DeleteFunctionRequest),
                value: { name }
              }
            }
          }
        });

        // Save the Operation
        return this.adapter.createOperation(operation)
          .then(() => {
            // Asynchronously perform the deletion of the CloudFunction
            setImmediate(() => {
              // Delete the CloudFunction
              this.adapter.deleteFunction(name)
                .then(() => {
                  operation.done = true;
                  operation.response = {
                    typeUrl: 'types.googleapis.com/google.protobuf.Empty',
                    value: {}
                  };

                  // Fire off the request to update the Operation
                  this.adapter.updateOperation(operation.name, operation)
                    .catch((err) => this._deleteFunctionError(name, err));
                }, (err) => this._deleteFunctionError(name, err, operation));
            });

            // Synchronously return the Operation instance
            return operation;
          }, (err) => this._deleteFunctionError(name, err));
      });
  }

  /**
   * Formats an error used when a requested CloudFunction does not exist.
   *
   * @method Functions#_getFunctionNotFoundError
   * @private
   * @param {string} name The name of the requested CloudFunction.
   * @returns {Promise}
   */
  _getFunctionNotFoundError (name) {
    const parts = CloudFunction.parseName(name);
    const err = new Errors.NotFoundError(`Function ${parts.name} in location ${parts.location} in project ${parts.project} does not exist`);
    err.details.push(new Errors.ResourceInfo(err, protos.getPath(protos.CloudFunction), name));
    console.error(err);
    return Promise.reject(err);
  }

  /**
   * Formats an error used when there is a general error retrieving a
   * CloudFunction.
   *
   * @method Functions#_getFunctionError
   * @private
   * @param {string} name The name of the requested CloudFunction.
   * @param {object} err The error.
   * @returns {Promise}
   */
  _getFunctionError (name, err) {
    err = new Errors.InternalError(err.message);
    err.details.push(new Errors.ResourceInfo(err, protos.getPath(protos.CloudFunction), name));
    console.error(err);
    return Promise.reject(err);
  }

  /**
   * Gets a CloudFunction.
   *
   * @method Functions#getFunction
   * @param {string} name The name of the requested CloudFunction.
   * @returns {Promise}
   */
  getFunction (name) {
    console.debug('Functions', 'getFunction', name);
    return this.adapter.getFunction(name)
      .then((cloudfunction) => {
        if (!cloudfunction) {
          return this._getFunctionNotFoundError(name);
        }

        return this.cloudfunction(name, cloudfunction);
      }, (err) => this._getFunctionError(name, err));
  }

  /**
   * Formats an error used when a requested Operation does not exist.
   *
   * @method Functions#_getOperationNotFoundError
   * @private
   * @param {string} name The name of the requested Operation.
   * @returns {Promise}
   */
  _getOperationNotFoundError (name) {
    const err = new Errors.NotFoundError(`Operation ${name} does not exist`);
    err.details.push(new Errors.ResourceInfo(err, protos.getPath(protos.Operation), name));
    console.error(err);
    return Promise.reject(err);
  }

  /**
   * Formats an error used when there is a general error retrieving an
   * Operation.
   *
   * @method Functions#_getOperationError
   * @private
   * @param {string} name The name of the requested Operation.
   * @param {objects} err The error.
   * @returns {Promise}
   */
  _getOperationError (name, err) {
    err = new Errors.InternalError(err.message);
    err.details.push(new Errors.ResourceInfo(err, protos.getPath(protos.Operation), name));
    console.error(err);
    return Promise.reject(err);
  }

  /**
   * Gets an Operation.
   *
   * @method Functions#getOperation
   * @param {string} name The name of the requested Operation.
   * @returns {Promise}
   */
  getOperation (name) {
    console.debug('Functions', 'getOperation', name);
    return this.adapter.getOperation(name).then(
      (operation) => operation ? this.operation(name, operation) : this._getOperationNotFoundError(name),
      (err) => this._getOperationError(err)
    );
  }

  /**
   * Lists CloudFunction.
   *
   * @method Functions#listFunctions
   * @param {string} location The project and location from which
   *     the CloudFunctions should be listed, specified in the format:
   *         projects/PROJECT/locations/LOCATION
   *     If you want to list functions in all locations, use '-' in place of a
   *     location.
   * @param {object} [opts] Configuration options.
   * @param {number} [opts.pageSize] Maximum number of functions to return.
   * @param {string} [opts.pageToken] The value returned by the last
   *     ListFunctionsResponse; indicates that this is a continuation of a prior
   *     ListFunctions call, and that the system should return the next page of
   *     data.
   * @returns {Promise}
   */
  listFunctions (location, opts = {}) {
    console.debug('Functions', 'listFunctions', location, opts);
    return Promise.resolve()
      .then(() => {
        // TODO: Convert these to the proper format
        if (!location) {
          throw new Error('"location" is required!');
        } else if (typeof location !== 'string') {
          throw new Error('"location" must be a string!');
        } else if (opts && opts.pageSize) {
          opts.pageSize = parseInt(opts.pageSize, 10);
          if (isNaN(opts.pageSize) || typeof opts.pageSize !== 'number') {
            throw new Error('"pageSize" must be a number!');
          }
        } else if (opts && opts.pageToken && typeof opts.pageToken !== 'string') {
          throw new Error('"pageToken" must be a string!');
        }

        return this.adapter.listFunctions(opts);
      })
      .then((response) => {
        response.functions = response.functions.map((func) => this.cloudfunction(func.name, func));
        return response;
      });
  }

  /**
   * Returns a new Operation instance, initialized with the provided name and
   * properties.
   *
   * @method Functions#operation
   * @param {string} name The name of the Operation.
   * @param {object} [props] Optional properties with which to initialize the
   *     Operation instance.
   * @returns {Operation} The new Operation instance.
   */
  operation (name, props) {
    if (props instanceof Operation) {
      return props;
    }
    return new Operation(name, props);
  }
}

module.exports = Functions;
