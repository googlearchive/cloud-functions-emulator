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

describe(`unit/model/operation`, () => {
  let Operation;
  const TEST_NAME = `operations/abcd1234`;

  beforeEach(() => {
    Operation = proxyquire(`../../../src/model/operation`, {});
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

    it(`should return an Operation instance`, () => {
      assert(new Operation(TEST_NAME) instanceof Operation);
    });
  });

  describe(`Operation.NAME_REG_EXP`, () => {
    it(`should be an instance of RegExp`, () => {
      assert(Operation.NAME_REG_EXP instanceof RegExp);
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
});
