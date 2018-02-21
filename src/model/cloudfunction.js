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
const querystring = require('querystring');
const tmp = require('tmp');
const url = require('url');

const Errors = require('../utils/errors');
const Schema = require('../utils/schema');

const LOCATION_REG_EXP = /^projects\/([-\w]+)\/locations\/([-\w]+)$/;
const NAME_REG_EXP = /^projects\/([-\w]+)\/locations\/([-\w]+)\/functions\/([A-Za-z][-A-Za-z0-9_]*)$/;
const SHORT_NAME_REG_EXP = /^[A-Za-z][-A-Za-z0-9_]*$/;

const CloudFunctionSchema = {
  type: 'object',
  properties: {
    gcsTrigger: {
      type: 'string'
    },
    gcsUrl: {
      type: 'string'
    },
    eventTrigger: {
      type: ['null', 'object'],
      properties: {
        eventType: {
          type: 'string'
        },
        resource: {
          type: 'string'
        },
        path: {
          type: 'string'
        }
      },
      required: ['eventType']
    },
    httpsTrigger: {
      type: ['null', 'object'],
      properties: {
        url: {
          type: 'string'
        }
      }
    },
    name: {
      type: 'string'
    },
    pubsubTrigger: {
      type: 'string'
    },
    sourceArchiveUrl: {
      type: 'string'
    },
    sourceUploadUrl: {
      type: 'string'
    }
  },
  required: ['name']
};

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
  constructor (name = '', props = {}) {
    let matches, shortName;
    if (name && name.match) {
      matches = name.match(NAME_REG_EXP) || [];
      shortName = matches[3];
    }

    if (!shortName || typeof shortName !== 'string' || shortName.length > 63 || !CloudFunction.SHORT_NAME_REG_EXP.test(shortName)) {
      if (typeof name === 'string' && !shortName) {
        shortName = name.split('/').pop();
      }
      if (!shortName) {
        shortName = name;
      }
      const err = new Errors.InvalidArgumentError(`Invalid value '${shortName}': Function name must contain only Latin letters, digits and a hyphen (-). It must start with letter, must not end with a hyphen, and must be at most 63 characters long.`);
      err.details.push(new Errors.BadRequest(err, 'name'));
      throw err;
    }
    _.merge(this, props, { name });
    const errors = Schema.validate(this, CloudFunction.schema);
    if (errors) {
      const err = new Errors.InvalidArgumentError('Invalid CloudFunction property!');
      err.details.push(new Errors.BadRequest(err, errors));
      throw err;
    }
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

  static getArchive (cloudfunction = {}) {
    const sourceUploadUrl = cloudfunction.sourceUploadUrl || '';
    const parts = url.parse(sourceUploadUrl);
    const query = querystring.parse(parts.query);
    return query.archive;
  }

  static getLocaldir (cloudfunction = {}) {
    const sourceUploadUrl = cloudfunction.sourceUploadUrl || '';
    const parts = url.parse(sourceUploadUrl);
    const query = querystring.parse(parts.query);
    return query.localdir;
  }

  static addLocaldir (cloudfunction, localdir) {
    if (!cloudfunction) {
      return;
    }
    const parts = url.parse(cloudfunction.sourceUploadUrl || 'http://localhost:8010');
    const query = querystring.parse(parts.query);
    query.localdir = localdir;
    const newQueryString = querystring.stringify(query);
    parts.search = `?${newQueryString}`;
    parts.query = newQueryString;
    cloudfunction.sourceUploadUrl = url.format(parts);
  }

  static generateUploadUrl (opts = {}) {
    opts.bindHost || (opts.bindHost = 'localhost');
    opts.port || (opts.port = '8010');
    let url = `http://${opts.bindHost}:${opts.port}/upload`;
    const tmpName = tmp.tmpNameSync({
      postfix: '.zip'
    });
    url += `?archive=${tmpName}`;
    return url;
  }

  /**
   * The JSON Schema for the CloudFunction class.
   *
   * @property CloudFunction.schema
   * @type {object}
   */
  static get schema () {
    return CloudFunctionSchema;
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
   * Returns a formatted CloudFunction location string.
   *
   * @method CloudFunction.formatLocation
   * @param {string} project The value for the project path parameter.
   * @param {string} location The value for the location path parameter.
   * @returns {string} The formatted location string.
   */
  static formatLocation (project, location) {
    return `projects/${project}/locations/${location}`;
  }

  /**
   * Returns a formatted CloudFunction name string.
   *
   * @method CloudFunction.formatName
   * @param {string} project The value for the project path parameter.
   * @param {string} location The value for the location path parameter.
   * @param {string} name The value for the name path parameter.
   * @returns {string} The formatted name string.
   */
  static formatName (project, location, name) {
    return `projects/${project}/locations/${location}/functions/${name}`;
  }

  /**
   * Parses a formatted CloudFunction location string.
   *
   * @method CloudFunction.parseLocation
   * @param {string} location The formatted CloudFunction location string.
   * @returns {object} The parsed parameters.
   */
  static parseLocation (location = '') {
    const matches = location.match(CloudFunction.LOCATION_REG_EXP);
    return {
      project: matches ? matches[1] : null,
      location: matches ? matches[2] : null
    };
  }

  /**
   * Parses a formatted CloudFunction name string.
   *
   * @method CloudFunction.parseName
   * @param {string} name The formatted CloudFunction name string.
   * @returns {object} The parsed parameters.
   */
  static parseName (name = '') {
    const matches = name.match(CloudFunction.NAME_REG_EXP);
    return {
      project: matches ? matches[1] : null,
      location: matches ? matches[2] : null,
      name: matches ? matches[3] : null
    };
  }

  setSourceArchiveUrl (sourceArchiveUrl) {
    if (!sourceArchiveUrl || typeof sourceArchiveUrl !== 'string') {
      throw new Error('"sourceArchiveUrl" must be a non-empty string!');
    }
    this.sourceArchiveUrl = sourceArchiveUrl;
  }
}

module.exports = CloudFunction;
