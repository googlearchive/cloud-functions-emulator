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

const path = require('path');

const run = require('./utils').run;

const cmd = 'node bin/functions';
const cwd = path.join(__dirname, '../..');
const name = 'hello';
const prefix = 'Google Cloud Functions Emulator';
const testModulePath = path.join(__dirname, '../test_module');

describe('cli', () => {
  before(() => {
    let output = run(`${cmd} restart`, cwd);
    assert.equal(output.includes(`${prefix} STARTED`), true);

    output = run(`${cmd} clear`, cwd);
    assert.equal(output.includes(`${prefix} CLEARED`), true);
  });

  afterEach(() => {
    const output = run(`${cmd} clear`, cwd);
    assert.equal(output.includes(`${prefix} CLEARED`), true);
  });

  after(() => {
    const output = run(`${cmd} stop`, cwd);
    assert.equal(output.includes(`${prefix} STOPPED`), true);
  });

  describe('call', () => {
    it('should call a function', () => {
      let output = run(`${cmd} deploy ${name} test/test_module`, cwd);
      assert.equal(output.includes(`Function ${name} deployed.`), true);

      output = run(`${cmd} call hello --data '{}'`, cwd);
      assert.equal(output.includes('Hello World'), true);
    });

    it('should call a function with JSON', () => {
      let output = run(`${cmd} deploy helloData test/test_module`, cwd);
      assert.equal(output.includes(`Function helloData deployed.`), true);

      output = run(`${cmd} call helloData --data '{"foo":"bar"}'`, cwd);
      assert.equal(output.includes('bar'), true);
    });

    it('should call a synchronous function', () => {
      let output = run(`${cmd} deploy helloPromise test/test_module`, cwd);
      assert.equal(output.includes(`Function helloPromise deployed.`), true);

      output = run(`${cmd} call helloPromise --data '{"foo":"bar"}'`, cwd);
      assert.equal(output.includes('bar'), true);
    });

    it('should call a function that throws and process does not crash', () => {
      let output = run(`${cmd} deploy helloThrow test/test_module`, cwd);
      assert.equal(output.includes(`Function helloThrow deployed.`), true);

      // TODO: Verify output when it gets fixed
      run(`${cmd} call helloThrow --data '{}'`, cwd);

      output = run(`${cmd} status`, cwd);
      assert.equal(output.includes(`${prefix} is RUNNING on port 8008`), true);
    });

    it('should call a function returns JSON', () => {
      let output = run(`${cmd} deploy helloJSON test/test_module`, cwd);
      assert.equal(output.includes(`Function helloJSON deployed.`), true);

      output = run(`${cmd} call helloJSON --data '{}'`, cwd);
      assert.equal(output.includes(`{ message: 'Hello World' }`), true);
    });
  });

  describe('clear', () => {
    before(() => {
      let output = run(`${cmd} list`, cwd);
      assert.equal(output.includes('No functions deployed'), true);

      output = run(`${cmd} deploy ${name} test/test_module`, cwd);
      assert.equal(output.includes(`Function ${name} deployed.`), true);

      output = run(`${cmd} deploy helloData test/test_module`, cwd);
      assert.equal(output.includes(`Function helloData deployed.`), true);

      output = run(`${cmd} list`, cwd);
      assert.equal(output.includes('No functions deployed'), false);
      assert.equal(output.includes('hello'), true);
      assert.equal(output.includes('BACKGROUND'), true);
      assert.equal(output.includes('helloData'), true);
      assert.equal(output.includes('BACKGROUND'), true);
    });

    it('should clear existing functions', () => {
      let output = run(`${cmd} clear`, cwd);
      assert.equal(output.includes(`${prefix} CLEARED`), true);

      output = run(`${cmd} list`, cwd);
      assert.equal(output.includes('No functions deployed'), true);
    });
  });

  describe('config', () => {
    it('should list configuration', () => {
      let output = run(`${cmd} config list`, cwd);
      assert.equal(output.includes(`host`), true);
      assert.equal(output.includes(`port`), true);
    });
  });

  describe('delete', () => {
    before(() => {
      let output = run(`${cmd} list`, cwd);
      assert.equal(output.includes('No functions deployed'), true);

      output = run(`${cmd} deploy ${name} test/test_module`, cwd);
      assert.equal(output.includes(`Function ${name} deployed.`), true);

      output = run(`${cmd} deploy helloData test/test_module`, cwd);
      assert.equal(output.includes(`Function helloData deployed.`), true);

      output = run(`${cmd} list`, cwd);
      assert.equal(output.includes('No functions deployed'), false);
      assert.equal(output.includes('hello'), true);
      assert.equal(output.includes('BACKGROUND'), true);
      assert.equal(output.includes('helloData'), true);
      assert.equal(output.includes('BACKGROUND'), true);
    });

    it('should delete a function', () => {
      let output = run(`${cmd} delete helloData`, cwd);
      assert.equal(output.includes('Function helloData deleted.'), true);

      output = run(`${cmd} list`, cwd);
      assert.equal(output.includes('No functions deployed'), false);
      assert.equal(output.includes('helloData'), false);
      assert.equal(output.includes('hello'), true);
      assert.equal(output.includes('BACKGROUND'), true);

      output = run(`${cmd} delete hello`, cwd);
      assert.equal(output.includes('Function hello deleted.'), true);

      output = run(`${cmd} list`, cwd);
      assert.equal(output.includes('No functions deployed'), true);
    });
  });

  describe('deploy', () => {
    before(() => {
      const output = run(`${cmd} list`, cwd);
      assert.equal(output.includes('No functions deployed'), true);
    });

    it('should deploy a background function', () => {
      let output = run(`${cmd} deploy ${name} test/test_module`, cwd);
      assert.equal(output.includes(`Function ${name} deployed.`), true);

      output = run(`${cmd} list`, cwd);
      assert.equal(output.includes('No functions deployed'), false);
      assert.equal(output.includes('hello'), true);
      assert.equal(output.includes('BACKGROUND'), true);
    });

    it('should deploy an HTTP function');

    it('should fail when the module does not exist', () => {
      // TODO: Verify output once it gets fixed
      let output = run(`${cmd} deploy ${name} test/test_module/foo/bar`, cwd);

      output = run(`${cmd} status`, cwd);
      assert.equal(output.includes(`${prefix} is RUNNING on port 8008`), true);
    });

    it('should fail when the function does not exist', () => {
      // TODO: Verify output once it gets fixed
      let output = run(`${cmd} deploy doesNotExist test/test_module`, cwd);

      output = run(`${cmd} status`, cwd);
      assert.equal(output.includes(`${prefix} is RUNNING on port 8008`), true);
    });
  });

  describe('describe', () => {
    before(() => {
      const output = run(`${cmd} deploy ${name} test/test_module`, cwd);
      assert.equal(output.includes(`Function ${name} deployed.`), true);
    });

    it('should describe a function', () => {
      const output = run(`${cmd} describe ${name}`, cwd);
      assert.equal(output.includes(name), true);
      assert.equal(output.includes('BACKGROUND'), true);
      assert.equal(output.includes(testModulePath), true);
    });
  });

  describe('kill', () => {
    it('should kill the server');
  });

  describe('list', () => {
    it('should list no functions', () => {
      const output = run(`${cmd} list`, cwd);
      assert.equal(output.includes('No functions deployed'), true);
    });
  });

  describe('logs', () => {
    describe('read', () => {
      it('should list logs');
      it('should list and limit logs');
    });
  });

  describe('prune', () => {
    it('should prune functions');
  });

  describe('restart', () => {
    it('should restart the server');
  });

  describe('status', () => {
    it('should show the server status', () => {
      let output = run(`${cmd} status`, cwd);
      assert.equal(output.includes(`${prefix} is RUNNING on port 8008`), true);

      output = run(`${cmd} stop`, cwd);
      assert.equal(output.includes(`${prefix} STOPPED`), true);

      output = run(`${cmd} status`, cwd);
      assert.equal(output.includes(`${prefix} STOPPED`), true);

      output = run(`${cmd} restart`, cwd);
      assert.equal(output.includes(`${prefix} STARTED`), true);
    });
  });
});
