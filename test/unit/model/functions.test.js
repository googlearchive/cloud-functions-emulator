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

const _ = require(`lodash`);
const os = require('os');
const proxyquire = require(`proxyquire`);

const defaults = require(`../../../src/defaults.json`);
defaults.location = _.kebabCase(os.userInfo().username);

describe(`unit/model/functions`, () => {
  let Functions;

  beforeEach(() => {
    Functions = proxyquire(`../../../src/model/functions`, {});
  });

  describe(`Functions`, () => {
    it(`should be a function`, () => {
      assert(typeof Functions === `function`);
    });

    it(`should return a Functions instance`, () => {
      const functions = new Functions(_.merge({}, defaults, {
        projectId: 'p'
      }));
      assert(functions instanceof Functions);
    });
  });

  describe(`Functions.configSchema`, () => {
    it(`should be a schema`);
  });

  describe(`Functions.configSchema`, () => {
    it(`should be a schema`);
  });

  describe(`Functions#callFunction`, () => {
    it(`should call a function`);
  });

  describe(`Functions#cloudfunction`, () => {
    it(`should return a CloudFunction instance`);
  });

  describe(`Functions#createFunction`, () => {
    it(`should create a function`);
  });

  describe(`Functions#deleteFunction`, () => {
    it(`should delete a function`);
  });

  describe(`Functions#getFunction`, () => {
    it(`should get a function`);
  });

  describe(`Functions#getOperation`, () => {
    it(`should get an operation`);
  });

  describe(`Functions#listFunctions`, () => {
    it(`should list functions`);
  });

  describe(`Functions#operation`, () => {
    it(`should return an Operation instance`);
  });
});
