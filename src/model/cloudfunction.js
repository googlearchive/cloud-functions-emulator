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

const protos = require('./protos');

const LOCATION_REG_EXP = /^projects\/([-\w]+)\/locations\/([-\w]+)$/;
const NAME_REG_EXP = /^projects\/([-\w]+)\/locations\/([-\w]+)\/functions\/([A-Za-z][-A-Za-z0-9]*)$/;
const SHORT_NAME_REG_EXP = /^[A-Za-z][-A-Za-z0-9]*$/;

/**
 * The CloudFunction class is an abstraction around objects of type
 * "google.cloud.functions.v1beta2.CloudFunction". Instances of this class are
 * passed around in the application code, but are serialized to protobufs or
 * JSON when sent over the wire.
 *
 * @class CloudFunction
 * @param {string} name The name of the CloudFunction, e.g.
 *     "projects/my-project/locations/us-central1/functions/myFunction".
 * @param {object} [props] Optional hash of properties with which to initialize
 * the instance.
 * @returns {CloudFunction}
 */
class CloudFunction {
  constructor (name, props = {}) {
    const matches = name.match(NAME_REG_EXP) || [];
    const shortName = matches[3];
    if (!shortName || typeof shortName !== 'string' || shortName.length > 63 || !CloudFunction.SHORT_NAME_REG_EXP.test(shortName)) {
      const message = `Invalid value '${shortName}': Function name must contain only lower case Latin letters, digits and a hyphen (-). It must start with letter, must not end with a hyphen, and must be at most 63 characters long.`;
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
            resourceType: protos.getPath(protos.CloudFunction),
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
    merge(this, CloudFunction.decode(props), { name });
  }

  /**
   * A Regular Expression for validation a CloudFunction's location.
   *
   * @property CloudFunction.NAME_REG_EXP
   * @type {RegExp}
   */
  static get LOCATION_REG_EXP () {
    return LOCATION_REG_EXP;
  }

  /**
   * A Regular Expression for validation a CloudFunctions's full name.
   *
   * @property CloudFunction.NAME_REG_EXP
   * @type {RegExp}
   */
  static get NAME_REG_EXP () {
    return NAME_REG_EXP;
  }

  /**
   * A Regular Expression for validation a CloudFunction's short name.
   *
   * @property CloudFunction.SHORT_NAME_REG_EXP
   * @type {RegExp}
   */
  static get SHORT_NAME_REG_EXP () {
    return SHORT_NAME_REG_EXP;
  }

  /**
   * The CloudFunction's short name.
   *
   * @property CloudFunction#shortName
   * @type {string}
   */
  get shortName () {
    return this.name.match(CloudFunction.NAME_REG_EXP)[3];
  }

  /**
   * Decodes a CloudFunction message.
   *
   * @method CloudFunction.decode
   * @param {object} cloudfunction The CloudFunction to decode.
   * @returns {object} The decoded cloudfunction.
   */
  static decode (cloudfunction = {}) {
    // Decode the top-level CloudFunction message fields
    cloudfunction = protos.decode(cloudfunction, protos.CloudFunction);

    return cloudfunction;
  }

  setTimeout (timeout) {
    if (!timeout || typeof timeout !== 'string') {
      throw new Error('"timeout" must be a Google Duration string!');
    }
    this.timeout = timeout;
  }

  setGcsUrl (gcsUrl) {
    if (!gcsUrl || typeof gcsUrl !== 'string') {
      throw new Error('"gcsUrl" must be a non-empty string!');
    }
    this.gcsUrl = gcsUrl;
  }

  /**
   * Convert this CloudFunction instance into a gRPC CloudFunction message.
   *
   * @method CloudFunction#toProtobuf
   * @returns {object} The encoded CloudFunction message.
   */
  toProtobuf () {
    // Get a sanitized copy of this CloudFunction instance.
    const cloudfunction = CloudFunction.decode(this);

    // These must be removed from the object for serialization
    if (!cloudfunction.pubsubTrigger) {
      delete cloudfunction.pubsubTrigger;
    }
    if (!cloudfunction.gcsTrigger) {
      delete cloudfunction.gcsTrigger;
    }

    return cloudfunction;
  }

  /**
   * Convert this CloudFunction instance into an object suitable for transport
   * over REST (JSON).
   *
   * @method CloudFunction#toJSON
   * @returns {object} The formatted object.
   */
  toJSON () {
    // Return a sanitized copy of this CloudFunction instance. There's no need to
    // encode anything.
    return CloudFunction.decode(this);
  }
}

module.exports = CloudFunction;
