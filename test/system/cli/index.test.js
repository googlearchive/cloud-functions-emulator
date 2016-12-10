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

const Configstore = require('configstore');
const path = require('path');

const pkg = require('../../../package.json');
const run = require('./utils').run;

const cmd = 'node bin/functions';
const cwd = path.join(__dirname, '../../..');
const name = 'hello';
const operations = new Configstore(path.join(pkg.name, '.operations'));
const prefix = 'Google Cloud Functions Emulator';

const args = `--serviceMode rest --host localhost --port 8008 --debug false --inspect false --runSupervisor true --supervisorHost localhost --supervisorPort 8009`;

describe('system/cli', () => {
  before(() => {
    // Clear all Operations data
    operations.clear();

    let output = run(`${cmd} restart ${args}`, cwd);
    assert.equal(output.includes(`${prefix} STARTED`), true);

    output = run(`${cmd} clear ${args}`, cwd);
    assert.equal(output.includes(`${prefix} CLEARED`), true);
  });

  afterEach(() => {
    const output = run(`${cmd} clear ${args}`, cwd);
    assert.equal(output.includes(`${prefix} CLEARED`), true);
  });

  after(() => {
    const output = run(`${cmd} stop ${args}`, cwd);
    assert.equal(output.includes(`${prefix} STOPPED`), true);
  });

  describe('call', () => {
    it('should call a function', () => {
      let output = run(`${cmd} deploy ${name} --local-path test/test_module/ --trigger-bucket test ${args}`, cwd);
      assert.equal(output.includes(`Function ${name} deployed.`), true);

      output = run(`${cmd} call hello --data '{}' ${args}`, cwd);
      assert.equal(output.includes('Hello World'), true);
    });

    it('should call a function with JSON', () => {
      let output = run(`${cmd} deploy helloData --local-path test/test_module/ --trigger-bucket test ${args}`, cwd);
      assert.equal(output.includes(`Function helloData deployed.`), true);

      output = run(`${cmd} call helloData --data '{"foo":"bar"}' ${args}`, cwd);
      assert.equal(output.includes('bar'), true);
    });

    it('should call a synchronous function', () => {
      let output = run(`${cmd} deploy helloPromise --local-path test/test_module/ --trigger-bucket test ${args}`, cwd);
      assert.equal(output.includes(`Function helloPromise deployed.`), true);

      output = run(`${cmd} call helloPromise --data '{"foo":"bar"}' ${args}`, cwd);
      assert.equal(output.includes('bar'), true);
    });

    it('should call a function that throws and process does not crash', () => {
      let output = run(`${cmd} deploy helloThrow --local-path test/test_module/ --trigger-bucket test ${args}`, cwd);
      assert.equal(output.includes(`Function helloThrow deployed.`), true);

      // TODO: Verify output when it gets fixed
      run(`${cmd} call helloThrow --data '{}' ${args}`, cwd);

      output = run(`${cmd} status ${args}`, cwd);
      assert.equal(output.includes(`RUNNING`), true);
    });

    it('should call a function returns JSON', () => {
      let output = run(`${cmd} deploy helloJSON --local-path test/test_module/ --trigger-bucket test ${args}`, cwd);
      assert.equal(output.includes(`Function helloJSON deployed.`), true);

      output = run(`${cmd} call helloJSON --data '{}' ${args}`, cwd);
      assert.equal(output.includes(`{ message: 'Hello World' }`), true);
    });

    it('should call an HTTP function', () => {
      let output = run(`${cmd} deploy helloGET --local-path test/test_module/ --trigger-http ${args}`, cwd);
      assert.equal(output.includes(`Function helloGET deployed.`), true);

      output = run(`${cmd} call helloGET --data '{}' ${args}`, cwd);
      assert.equal(output.includes(`statusCode: 200`), true);
    });

    it('should call an HTTP function and send it JSON', () => {
      let output = run(`${cmd} deploy helloPOST --local-path test/test_module/ --trigger-http ${args}`, cwd);
      assert.equal(output.includes(`Function helloPOST deployed.`), true);

      output = run(`${cmd} call helloPOST --data '{"foo":"bar"}' ${args}`, cwd);
      assert.equal(output.includes(`body: { foo: 'bar' } }`), true);
    });
  });

  describe('clear', () => {
    before(() => {
      let output = run(`${cmd} list ${args}`, cwd);
      assert.equal(output.includes('No functions deployed'), true);

      output = run(`${cmd} deploy ${name} --local-path test/test_module/ --trigger-bucket test ${args}`, cwd);
      assert.equal(output.includes(`Function ${name} deployed.`), true);

      output = run(`${cmd} deploy helloData --local-path test/test_module/ --trigger-bucket test ${args}`, cwd);
      assert.equal(output.includes(`Function helloData deployed.`), true);

      output = run(`${cmd} list ${args}`, cwd);
      assert.equal(output.includes('No functions deployed'), false);
      assert.equal(output.includes('hello'), true);
      assert.equal(output.includes('helloData'), true);
    });

    it('should clear existing functions', () => {
      let output = run(`${cmd} clear ${args}`, cwd);
      assert.equal(output.includes(`${prefix} CLEARED`), true);

      output = run(`${cmd} list ${args}`, cwd);
      assert.equal(output.includes('No functions deployed'), true);
    });
  });

  describe('config', () => {
    it('should list configuration', () => {
      let output = run(`${cmd} config list ${args}`, cwd);
      assert.equal(output.includes(`host`), true);
      assert.equal(output.includes(`port`), true);
    });
  });

  describe('delete', () => {
    before(() => {
      let output = run(`${cmd} list ${args}`, cwd);
      assert.equal(output.includes('No functions deployed'), true);

      output = run(`${cmd} deploy ${name} --local-path test/test_module/ --trigger-bucket test ${args}`, cwd);
      assert.equal(output.includes(`Function ${name} deployed.`), true);

      output = run(`${cmd} deploy helloData --local-path test/test_module/ --trigger-bucket test ${args}`, cwd);
      assert.equal(output.includes(`Function helloData deployed.`), true);

      output = run(`${cmd} list ${args}`, cwd);
      assert.equal(output.includes('No functions deployed'), false);
      assert.equal(output.includes('hello'), true);
      assert.equal(output.includes('helloData'), true);
    });

    it('should delete a function', () => {
      let output = run(`${cmd} delete helloData ${args}`, cwd);
      assert.equal(output.includes('Function helloData deleted.'), true);

      output = run(`${cmd} list ${args}`, cwd);
      assert.equal(output.includes('No functions deployed'), false);
      assert.equal(output.includes('helloData'), false);
      assert.equal(output.includes('hello'), true);

      output = run(`${cmd} delete hello ${args}`, cwd);
      assert.equal(output.includes('Function hello deleted.'), true);

      output = run(`${cmd} list ${args}`, cwd);
      assert.equal(output.includes('No functions deployed'), true);
    });
  });

  describe('deploy', () => {
    before(() => {
      const output = run(`${cmd} list ${args}`, cwd);
      assert.equal(output.includes('No functions deployed'), true);
    });

    it('should deploy a background function', () => {
      let output = run(`${cmd} deploy ${name} --local-path test/test_module/ --trigger-bucket test ${args}`, cwd);
      assert.equal(output.includes(`Function ${name} deployed.`), true);

      output = run(`${cmd} list ${args}`, cwd);
      assert.equal(output.includes('No functions deployed'), false);
      assert.equal(output.includes(name), true);
    });

    it('should deploy an HTTP function', () => {
      let output = run(`${cmd} deploy helloGET --local-path test/test_module/ --trigger-http ${args}`, cwd);
      assert.equal(output.includes(`Function helloGET deployed.`), true);

      output = run(`${cmd} list ${args}`, cwd);
      assert.equal(output.includes('No functions deployed'), false);
      assert.equal(output.includes('helloGET'), true);
    });

    it('should fail when the module does not exist', () => {
      // TODO: Verify output once it gets fixed
      let output = run(`${cmd} deploy ${name} --local-path test/test_module/foo/bar --trigger-http ${args}`, cwd);

      output = run(`${cmd} status ${args}`, cwd);
      assert.equal(output.includes(`RUNNING`), true);
    });

    it('should fail when the function does not exist', () => {
      // TODO: Verify output once it gets fixed
      let output = run(`${cmd} deploy doesNotExist --local-path test/test_module/ --trigger-http ${args}`, cwd);

      output = run(`${cmd} status ${args}`, cwd);
      assert.equal(output.includes(`RUNNING`), true);
    });
  });

  describe('describe', () => {
    it('should describe a background function', () => {
      let output = run(`${cmd} deploy ${name} --local-path test/test_module/ --trigger-bucket test ${args}`, cwd);
      assert.equal(output.includes(`Function ${name} deployed.`), true);

      output = run(`${cmd} describe ${name} ${args}`, cwd);
      assert.equal(output.includes(name), true);
      assert.equal(output.includes('Bucket'), true);
      assert.equal(output.includes('test'), true);
    });

    it('should describe an HTTP function', () => {
      let output = run(`${cmd} deploy helloGET --local-path test/test_module/ --trigger-http ${args}`, cwd);
      assert.equal(output.includes(`Function helloGET deployed.`), true);

      output = run(`${cmd} describe helloGET ${args}`, cwd);
      assert.equal(output.includes('helloGET'), true);
      assert.equal(output.includes('HTTP'), true);
      assert.equal(output.includes('/helloGET'), true);
    });
  });

  describe('kill', () => {
    it('should kill the server');
  });

  describe('list', () => {
    it('should list no functions', () => {
      const output = run(`${cmd} list ${args}`, cwd);
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
      let output = run(`${cmd} status ${args}`, cwd);
      assert.equal(output.includes(`${prefix}`), true);
      assert.equal(output.includes(`RUNNING`), true);
      assert.equal(output.includes(`http://localhost:8008/`), true);
      assert.equal(output.includes(`rest`), true);

      output = run(`${cmd} stop ${args}`, cwd);
      assert.equal(output.includes(`STOPPED`), true);

      output = run(`${cmd} status ${args}`, cwd);
      assert.equal(output.includes(`STOPPED`), true);

      output = run(`${cmd} restart ${args}`, cwd);
      assert.equal(output.includes(`STARTED`), true);
    }).timeout(10000);
  });
});
