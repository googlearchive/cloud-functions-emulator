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
const grpc = require(`grpc`);
const proxyquire = require(`proxyquire`);

describe(`unit/model/cloudfunction`, () => {
  let CloudFunction, mocks;
  const TEST_NAME = `projects/p/locations/l/functions/f`;

  beforeEach(() => {
    mocks = {
      protos: {
        decode: (arg1) => _.cloneDeep(arg1),
        decodeAnyType: sinon.stub(),
        encodeAnyType: sinon.stub()
      }
    };
    sinon.spy(mocks.protos, `decode`);

    CloudFunction = proxyquire(`../../../src/model/cloudfunction`, {
      './protos': mocks.protos
    });
  });

  describe(`CloudFunction`, () => {
    it(`should be a function`, () => {
      assert(typeof CloudFunction === `function`);
    });

    it(`should throw when not called with "new"`, () => {
      assert.throws(
        () => {
          CloudFunction();
        },
        (err) => {
          assert(err instanceof TypeError);
          assert(err.message === `Class constructor CloudFunction cannot be invoked without 'new'`);
          return true;
        }
      );
    });

    it(`should validate the "name" argument`, () => {
      let name;

      assert.throws(
        () => {
          new CloudFunction(name); // eslint-disable-line
        },
        (err) => {
          const message = `Invalid value '': Function name must contain only lower case Latin letters, digits and a hyphen (-). It must start with letter, must not end with a hyphen, and must be at most 63 characters long.`;
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
          new CloudFunction(name); // eslint-disable-line
        },
        (err) => {
          assert(err instanceof Error);
          assert(err.message === `Invalid value '${name}': Function name must contain only lower case Latin letters, digits and a hyphen (-). It must start with letter, must not end with a hyphen, and must be at most 63 characters long.`);
          return true;
        },
        `should verify that "name" is a string`
      );

      name = `projects/p/locations/l/functions/1`;
      assert.throws(
        () => {
          new CloudFunction(name); // eslint-disable-line
        },
        (err) => {
          assert(err instanceof Error);
          assert(err.message === `Invalid value '1': Function name must contain only lower case Latin letters, digits and a hyphen (-). It must start with letter, must not end with a hyphen, and must be at most 63 characters long.`);
          return true;
        },
        `should validate the format of "name"`
      );

      assert.doesNotThrow(
        () => {
          const cloudfunction = new CloudFunction(TEST_NAME);
          assert(cloudfunction.name === TEST_NAME);
        },
        (err) => {
          assert.ifError(err);
          return true;
        },
        `should accept a valid "name" argument`
      );
    });

    it(`should decode the props`, () => {
      sinon.spy(CloudFunction, `decode`);

      let props = {};
      let cloudfunction = new CloudFunction(TEST_NAME);

      assert.deepEqual(cloudfunction, { name: TEST_NAME });
      assert(CloudFunction.decode.callCount === 1);
      assert.deepEqual(CloudFunction.decode.getCall(0).args, [props]);

      props = { done: true };
      cloudfunction = new CloudFunction(TEST_NAME, props);

      assert.deepEqual(cloudfunction, _.merge(props, { name: TEST_NAME }));
      assert(CloudFunction.decode.callCount === 2);
      assert.deepEqual(CloudFunction.decode.getCall(1).args, [props]);
    });

    it(`should return an CloudFunction instance`, () => {
      assert(new CloudFunction(TEST_NAME) instanceof CloudFunction);
    });
  });

  describe(`CloudFunction.NAME_REG_EXP`, () => {
    it(`should be an instance of RegExp`, () => {
      assert(CloudFunction.NAME_REG_EXP instanceof RegExp);
    });
  });

  describe(`CloudFunction.LOCATION_REG_EXP`, () => {
    it(`should be an instance of RegExp`, () => {
      assert(CloudFunction.LOCATION_REG_EXP instanceof RegExp);
    });
  });

  describe(`CloudFunction.SHORT_NAME_REG_EXP`, () => {
    it(`should be an instance of RegExp`, () => {
      assert(CloudFunction.SHORT_NAME_REG_EXP instanceof RegExp);
    });
  });

  describe(`CloudFunction.decode`, () => {
    it(`should decode the props`, () => {
      let props;
      let cloudfunction = CloudFunction.decode();

      assert.deepEqual(cloudfunction, {});
      assert(mocks.protos.decode.callCount === 1);
      assert(mocks.protos.decodeAnyType.callCount === 0);

      props = {};
      cloudfunction = CloudFunction.decode(props);

      assert.deepEqual(cloudfunction, props);
      assert(cloudfunction !== props);
      assert(mocks.protos.decode.callCount === 2);
    });
  });

  describe(`CloudFunction.formatLocation`, () => {
    it(`should return a formatted CloudFunction location string`);
  });

  describe(`CloudFunction.formatName`, () => {
    it(`should return a formatted CloudFunction name string`);
  });

  describe(`CloudFunction.parseLocation`, () => {
    it(`should parse a formatted CloudFunction location string`);
  });

  describe(`CloudFunction.parseName`, () => {
    it(`should parse a formatted CloudFunction name string`);
  });

  describe(`CloudFunction#shortName`, () => {
    it(`should be just the short function name`, () => {
      const cloudfunction = new CloudFunction(TEST_NAME);

      assert(cloudfunction.shortName === `f`);
    });
  });

  describe(`CloudFunction#setSourceArchiveUrl`, () => {
    it(`should set sourceArchiveUrl`, () => {
      const cloudfunction = new CloudFunction(TEST_NAME);
      const sourceArchiveUrl = `gs://bucket/file.zip`;

      assert.throws(
        () => {
          cloudfunction.setSourceArchiveUrl();
        }
      );
      assert.throws(
        () => {
          cloudfunction.setSourceArchiveUrl(1234);
        }
      );

      cloudfunction.setSourceArchiveUrl(sourceArchiveUrl);
      assert(cloudfunction.sourceArchiveUrl === sourceArchiveUrl);
    });
  });

  describe(`CloudFunction#setTimeout`, () => {
    it(`should set timeout`, () => {
      const cloudfunction = new CloudFunction(TEST_NAME);
      const timeout = `30s`;

      assert.throws(
        () => {
          cloudfunction.setTimeout();
        }
      );
      assert.throws(
        () => {
          cloudfunction.setTimeout(1234);
        }
      );

      cloudfunction.setTimeout(timeout);
      assert(cloudfunction.timeout === timeout);
    });
  });

  describe(`CloudFunction#toProtobuf`, () => {
    it(`should return a representation suitable for serialization to a protobuf`, () => {
      sinon.spy(CloudFunction, `decode`);

      const cloudfunction = new CloudFunction(TEST_NAME, {
        sourceArchiveUrl: `gs://bucket/file.zip`,
        pubsubTrigger: `test`
      });

      assert(CloudFunction.decode.callCount === 1);

      const proto = cloudfunction.toProtobuf();

      assert.deepEqual(proto, cloudfunction);
      assert(CloudFunction.decode.callCount === 2);

      cloudfunction.gcsTrigger = ``;
      cloudfunction.pubsubTrigger = ``;
      delete proto.pubsubTrigger;

      const proto2 = cloudfunction.toProtobuf();

      assert.deepEqual(proto2, proto);
      assert(CloudFunction.decode.callCount === 3);

      cloudfunction.gcsTrigger = proto.gcsTrigger = `test`;

      const proto3 = cloudfunction.toProtobuf();

      assert.deepEqual(proto3, proto);
      assert(CloudFunction.decode.callCount === 4);
    });
  });

  describe(`CloudFunction#toJSON`, () => {
    it(`should return a representation suitable for serialization to JSON`, () => {
      sinon.spy(CloudFunction, `decode`);

      const cloudfunction = new CloudFunction(TEST_NAME);

      assert(CloudFunction.decode.callCount === 1);

      const json = cloudfunction.toJSON();

      assert.deepEqual(json, cloudfunction);
      assert(CloudFunction.decode.callCount === 2);
    });
  });
});
