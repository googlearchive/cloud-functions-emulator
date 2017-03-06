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
const grpc = require('grpc');
const googleProtoFiles = require('google-proto-files');
const path = require('path');

const protoRootDir = googleProtoFiles('..');
const functionsProtoPath = path.relative(protoRootDir, googleProtoFiles('cloud/functions/v1beta2/functions.proto'));
const operationsProtoPath = path.relative(protoRootDir, googleProtoFiles('cloud/functions/v1beta2/operations.proto'));
const errorsProtoPath = path.relative(protoRootDir, googleProtoFiles('rpc/error_details.proto'));
const statusProtoPath = path.relative(protoRootDir, googleProtoFiles('rpc/status.proto'));

const options = {
  binaryAsBase64: true,
  convertFieldsToCamelCase: true
};

function loadFile (path) {
  return grpc.load({
    root: protoRootDir,
    file: path
  }, 'proto', options);
}

const protos = _.merge(
  loadFile(functionsProtoPath),
  loadFile(operationsProtoPath),
  loadFile(errorsProtoPath),
  loadFile(statusProtoPath)
);

function getProto (key) {
  key = key.replace('types.googleapis.com/', '');
  return _.get(protos, key);
}

const pathsMap = new Map();

for (let key in protos.google.cloud.functions.v1beta2) {
  pathsMap.set(protos.google.cloud.functions.v1beta2[key], `types.googleapis.com/google.cloud.functions.v1beta2.${key}`);
}
for (let key in protos.google.longrunning) {
  pathsMap.set(protos.google.longrunning[key], `types.googleapis.com/google.longrunning.${key}`);
}

function getPath (proto) {
  return pathsMap.get(proto);
}

function decode (toDecode = {}, Ctor = null) {
  const decoded = {};

  if (Ctor) {
    // Apply defaults
    toDecode = _.merge(new Ctor({}), toDecode);
    for (let key in Ctor.prototype) {
      if (!Ctor.prototype.hasOwnProperty(key)) {
        continue;
      }
      // Pick out the proto Message props
      if (key.indexOf('get') === 0 && key.length > 3 && key[3] !== '_') {
        let prop = _.camelCase(key.substring(3));
        const value = decoded[prop] = _.cloneDeep(toDecode[prop]);
        if (value && value.typeUrl && value.value) {
          // This is an Object of type "google.protobuf.Any"
          decodeAnyType(value);
        }
      }
    }
  } else if (toDecode.typeUrl && toDecode.value) {
    // This is an Object of type "google.protobuf.Any"
    decodeAnyType(_.merge(decoded, toDecode));
  } else {
    _.merge(decoded, toDecode);
  }

  return decoded;
}

/**
 * Decodes an Object of type "google.protobuf.Any". Objects of this type have a
 * "typeUrl" field and a "value" field. The "typeUrl" field is a path to a proto
 * and the "value" field, when encoded, is a base64-encoded JSON string.
 *
 * These are the steps to decoding the "value" field:
 *   1. Read the base64-encoded string into a Node.js Buffer.
 *   2. Convert the Buffer to a utf8-encoded string (the string is JSON).
 *   3. Parse the JSON string into a JavaScript Object.
 *   4. Finally, strip any fields not defined in the proto Message and recurse
 *      into the Message in order to decode nested objects.
 *
 * This method is recursive in that it will check the decoded "value" field for
 * more Objects of type "google.protobuf.Any".
 *
 * @param {object} obj The Object of type "google.protobuf.Any" to be decoded.
 * @param {string} obj.typeUrl The path to the proto Message.
 * @param {string} obj.value The base64-encoded string.
 */
function decodeAnyType (obj) {
  // Verify that this is indeed an Object of type "google.protobuf.Any" whose
  // "value" field has not yet been decoded.
  if (obj && obj.typeUrl && obj.value && typeof obj.value === 'string') {
    // Step 1
    const buffer = Buffer.from(obj.value.toString(), 'base64');
    // Step 2
    const json = buffer.toString();
    // Step 3
    let object = JSON.parse(json);
    // Step 4
    obj.value = decode(object, getProto(obj.typeUrl));
  }
}

/**
 * Encodes an Object of type "google.protobuf.Any". Objects of this type have a
 * "typeUrl" field and a "value" field. The "typeUrl" field is a path to a proto
 * and the "value" field, when decoded, is a JavaScript Object.
 *
 * These are the steps to encoding the "value" field:
 *   1. Convert the JavaScript Object to a JSON string.
 *   2. Read the JSON string into a Node.js Buffer.
 *   3. Convert the Buffer to a base64-encoded string.
 *
 * This method is recursive in that it will check the decoded "value" field for
 * more Objects of type "google.protobuf.Any".
 *
 * @param {object} obj The Object of type "google.protobuf.Any" to be encoded.
 * @param {string} obj.typeUrl The path to the proto Message.
 * @param {string} obj.value The JavaScript Object.
 */
function encodeAnyType (obj) {
  // Verify that this is indeed an Object of type "google.protobuf.Any" whose
  // "value" field has not yet been encoded.
  if (obj && obj.typeUrl && obj.value && typeof obj.value !== 'string') {
    // Recursively encode nested values
    for (let key in obj.value) {
      encodeAnyType(obj.value[key]);
    }
    // Step 1
    const json = JSON.stringify(obj.value);
    // Step 2
    const buffer = Buffer.from(json);
    // Step 3
    obj.value = buffer.toString('base64');
  }
}

_.merge(exports, getProto('google.cloud.functions.v1beta2'));
_.merge(exports, getProto('google.longrunning'));
_.merge(exports, getProto('google.rpc'));

exports.protos = protos;
exports.get = getProto;
exports.decode = decode;
exports.getPath = getPath;
exports.decodeAnyType = decodeAnyType;
exports.encodeAnyType = encodeAnyType;
