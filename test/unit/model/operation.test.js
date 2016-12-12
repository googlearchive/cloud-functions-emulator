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

const _ = require(`lodash`);
const grpc = require(`grpc`);
const proxyquire = require(`proxyquire`);

describe(`unit/model/operation`, () => {
  let Operation, mocks;
  const TEST_NAME = `operations/abcd1234`;

  beforeEach(() => {
    mocks = {
      protos: {
        decode: (arg1) => _.cloneDeep(arg1),
        decodeAnyType: sinon.stub(),
        encodeAnyType: sinon.stub()
      }
    };
    sinon.spy(mocks.protos, `decode`);

    Operation = proxyquire(`../../../src/model/operation`, {
      './protos': mocks.protos
    });
  });

  describe(`Operation`, () => {
    it(`should be a function`, () => {
      assert(typeof Operation === `function`);
    });

    it(`should throw when not called with "new"`, () => {
      assert.throws(
        () => {
          Operation();
        },
        (err) => {
          assert(err instanceof TypeError);
          assert(err.message === `Class constructor Operation cannot be invoked without 'new'`);
          return true;
        }
      );
    });

    it(`should validate the "name" argument`, () => {
      let name;

      assert.throws(
        () => {
          new Operation(name); // eslint-disable-line
        },
        (err) => {
          const message = `Invalid value '${name}': Operation name must contain only lower case Latin letters, digits and hyphens (-).`;
          assert(err instanceof Error);
          assert(err.message === message);
          assert.errorType(
            err,
            grpc.status.INVALID_ARGUMENT,
            message,
            [
              `DebugInfo`,
              `BadRequest`,
              `ResourceInfo`
            ]
          );
          return true;
        },
        `should require the "name" argument`
      );

      name = 1234;
      assert.throws(
        () => {
          new Operation(name); // eslint-disable-line
        },
        (err) => {
          assert(err instanceof Error);
          assert(err.message === `Invalid value '${name}': Operation name must contain only lower case Latin letters, digits and hyphens (-).`);
          return true;
        },
        `should verify that "name" is a string`
      );

      name = `opera/fail`;
      assert.throws(
        () => {
          new Operation(name); // eslint-disable-line
        },
        (err) => {
          assert(err instanceof Error);
          assert(err.message === `Invalid value '${name}': Operation name must contain only lower case Latin letters, digits and hyphens (-).`);
          return true;
        },
        `should validate the format of "name"`
      );

      assert.doesNotThrow(
        () => {
          const operation = new Operation(TEST_NAME);
          assert(operation.name === TEST_NAME);
        },
        (err) => {
          assert.ifError(err);
          return true;
        },
        `should accept a valid "name" argument`
      );
    });

    it(`should decode the props`, () => {
      sinon.spy(Operation, `decode`);

      let props = {};
      let operation = new Operation(TEST_NAME);

      assert.deepEqual(operation, { name: TEST_NAME });
      assert(Operation.decode.callCount === 1);
      assert.deepEqual(Operation.decode.getCall(0).args, [props]);

      props = { done: true };
      operation = new Operation(TEST_NAME, props);

      assert.deepEqual(operation, _.merge(props, { name: TEST_NAME }));
      assert(Operation.decode.callCount === 2);
      assert.deepEqual(Operation.decode.getCall(1).args, [props]);
    });

    it(`should return an Operation instance`, () => {
      assert(new Operation(TEST_NAME) instanceof Operation);
    });
  });

  describe(`Operation.NAME_REG_EXP`, () => {
    it(`should be an instance of RegExp`, () => {
      assert(Operation.NAME_REG_EXP instanceof RegExp);
    });
  });

  describe(`Operation.decode`, () => {
    it(`should decode the props`, () => {
      let props;
      let operation = Operation.decode();

      assert.deepEqual(operation, {});
      assert(mocks.protos.decode.callCount === 1);
      assert(mocks.protos.decodeAnyType.callCount === 0);

      props = {
        error: {
          details: [
            {}
          ]
        }
      };
      operation = Operation.decode(props);

      assert.deepEqual(operation, props);
      assert(operation !== props);
      assert(mocks.protos.decode.callCount === 2);
      assert(mocks.protos.decodeAnyType.callCount === 1);
    });

    it(`should disallow both "error" and "response"`, () => {
      let props = {
        error: {},
        response: {}
      };
      assert.throws(
        () => {
          Operation.decode(props);
        },
        (err) => {
          const message = `Operation may only have one of 'error' or 'response'!`;
          assert(err instanceof Error);
          assert(err.message === message);
          assert.errorType(
            err,
            grpc.status.INVALID_ARGUMENT,
            message,
            [
              `BadRequest`
            ]
          );
          return true;
        }
      );
    });
  });

  describe(`Operation.formatName`, () => {
    it(`should return a formatted Operation name string`);
  });

  describe(`Operation.generateId`, () => {
    it(`should generate a unique name`, () => {
      const name = Operation.generateId();
      assert(typeof name === 'string');
      assert(/^operations\/[-A-Za-z0-9]+$/.test(name));
    });
  });

  describe(`Operation.parseName`, () => {
    it(`should parse a formatted Operation name string`);
  });

  describe(`Operation#toProtobuf`, () => {
    it(`should return a representation suitable for serialization to a protobuf`, () => {
      sinon.spy(Operation, `decode`);

      const message = `error`;
      const operation = new Operation(TEST_NAME, {
        metadata: {},
        error: {
          message,
          code: 1,
          details: [
            {}
          ]
        }
      });

      assert(Operation.decode.callCount === 1);

      const proto = operation.toProtobuf();

      assert.deepEqual(proto, operation);
      assert(Operation.decode.callCount === 2);
      assert(mocks.protos.encodeAnyType.callCount === 3);

      operation.error = new Error(message);
      operation.error.code = 1;
      operation.error.details = [
        {}
      ];

      const proto2 = operation.toProtobuf();

      assert.deepEqual(proto2, proto);
      assert(Operation.decode.callCount === 3);
      assert(mocks.protos.encodeAnyType.callCount === 6);

      delete operation.metadata;
      delete operation.error;

      const proto3 = operation.toProtobuf();

      assert.deepEqual(proto3, { name: TEST_NAME });
      assert(Operation.decode.callCount === 4);
      assert(mocks.protos.encodeAnyType.callCount === 8);

      operation.error = new Error(message);
      operation.error.code = 1;

      const proto4 = operation.toProtobuf();

      assert.deepEqual(proto4, {
        name: TEST_NAME,
        error: {
          code: 1,
          message
        }
      });
      assert(Operation.decode.callCount === 5);
      assert(mocks.protos.encodeAnyType.callCount === 10);
    });
  });

  describe(`Operation#toJSON`, () => {
    it(`should return a representation suitable for serialization to JSON`, () => {
      sinon.spy(Operation, `decode`);

      const operation = new Operation(TEST_NAME);

      assert(Operation.decode.callCount === 1);

      const json = operation.toJSON();

      assert.deepEqual(json, operation);
      assert(Operation.decode.callCount === 2);
    });
  });
});
