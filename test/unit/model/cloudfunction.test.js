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

const proxyquire = require(`proxyquire`);

describe(`unit/model/cloudfunction`, () => {
  let CloudFunction;
  const TEST_NAME = `projects/p/locations/l/functions/f`;

  beforeEach(() => {
    CloudFunction = proxyquire(`../../../src/model/cloudfunction`, {});
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
          const message = `Invalid value '': Function name must contain only Latin letters, digits and a hyphen (-). It must start with letter, must not end with a hyphen, and must be at most 63 characters long.`;
          assert(err instanceof Error);
          assert(err.message === message);
          assert.errorType(
            err,
            3,
            message,
            [
              `DebugInfo`,
              `BadRequest`
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
          assert(err.message === `Invalid value '${name}': Function name must contain only Latin letters, digits and a hyphen (-). It must start with letter, must not end with a hyphen, and must be at most 63 characters long.`);
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
          assert(err.message === `Invalid value '1': Function name must contain only Latin letters, digits and a hyphen (-). It must start with letter, must not end with a hyphen, and must be at most 63 characters long.`);
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

      assert.doesNotThrow(
        () => {
          const cloudfunction = new CloudFunction(`${TEST_NAME}_func`);
          assert(cloudfunction.name === `${TEST_NAME}_func`);
        },
        (err) => {
          assert.ifError(err);
          return true;
        },
        `should accept a valid "name" argument`
      );
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
});
