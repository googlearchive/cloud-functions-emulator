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

const Configstore = require(`configstore`);
const path = require(`path`);

const pkg = require(`../../../package.json`);
const run = require(`./utils`).run;

const cmd = `node bin/functions`;
const cwd = path.join(__dirname, `../../..`);
const name = `hello`;
const operations = new Configstore(path.join(pkg.name, `.operations`));
const prefix = `Google Cloud Functions Emulator`;

const args = `--serviceMode rest --host localhost --port 8008 --debug false --inspect false --runSupervisor true --supervisorHost localhost --supervisorPort 8009`;

describe(`system/cli`, () => {
  before(() => {
    // Clear all Operations data
    operations.clear();

    let output = run(`${cmd} restart ${args}`, cwd);
    assert(output.includes(`${prefix} STARTED`));

    output = run(`${cmd} clear ${args}`, cwd);
    assert(output.includes(`${prefix} CLEARED`));
  });

  after(() => {
    let output = run(`${cmd} restart ${args}`, cwd);
    assert(output.includes(`STARTED`));

    output = run(`${cmd} clear ${args}`, cwd);
    assert(output.includes(`${prefix} CLEARED`));

    output = run(`${cmd} stop ${args}`, cwd);
    assert(output.includes(`${prefix} STOPPED`));
  });

  describe(`config`, () => {
    it(`should list configuration`, () => {
      let output = run(`${cmd} config list ${args}`, cwd);
      assert(output.includes(`host`));
      assert(output.includes(`port`));
    });
  });

  describe(`deploy`, () => {
    before(() => {
      const output = run(`${cmd} list ${args}`, cwd);
      assert(output.includes(`No functions deployed`));
    });

    it(`should deploy a background function`, () => {
      const output = run(`${cmd} deploy ${name} --local-path test/test_module/ --trigger-bucket test ${args}`, cwd);
      assert(output.includes(`Function ${name} deployed.`));
    });

    it(`should deploy a function with JSON`, () => {
      const output = run(`${cmd} deploy helloData --local-path test/test_module/ --trigger-bucket test ${args}`, cwd);
      assert(output.includes(`Function helloData deployed.`));
    });

    it(`should deploy a synchronous function`, () => {
      const output = run(`${cmd} deploy helloPromise --local-path test/test_module/ --trigger-bucket test ${args}`, cwd);
      assert(output.includes(`Function helloPromise deployed.`));
    });

    it(`should deploy a function that throws and process does not crash`, () => {
      const output = run(`${cmd} deploy helloThrow --local-path test/test_module/ --trigger-bucket test ${args}`, cwd);
      assert(output.includes(`Function helloThrow deployed.`));
    });

    it(`should deploy a function returns JSON`, () => {
      const output = run(`${cmd} deploy helloJSON --local-path test/test_module/ --trigger-bucket test ${args}`, cwd);
      assert(output.includes(`Function helloJSON deployed.`));
    });

    it(`should deploy an HTTP function`, () => {
      const output = run(`${cmd} deploy helloGET --local-path test/test_module/ --trigger-http ${args}`, cwd);
      assert(output.includes(`Function helloGET deployed.`));
    });

    it(`should deploy an HTTP function and send it JSON`, () => {
      const output = run(`${cmd} deploy helloPOST --local-path test/test_module/ --trigger-http ${args}`, cwd);
      assert(output.includes(`Function helloPOST deployed.`));
    });

    it.skip(`should fail when the module does not exist`, () => {
      const output = run(`${cmd} deploy ${name} --local-path test/test_module/foo/bar --trigger-http ${args}`, cwd);
      console.log(output);
      // TODO: Verify output once it gets fixed
    });

    // TODO: Fix this. It currently deploys the function when it shouldn`t
    it.skip(`should fail when the function does not exist`, () => {
      // TODO: Verify output once it gets fixed
      const output = run(`${cmd} deploy doesNotExist --local-path test/test_module/ --trigger-http ${args}`, cwd);
      console.log(output);
    });
  });

  describe(`describe`, () => {
    it(`should describe a background function`, () => {
      const output = run(`${cmd} describe ${name} ${args}`, cwd);
      assert(output.includes(name));
      assert(output.includes(`Bucket`));
      assert(output.includes(`test`));
    });

    it(`should describe an HTTP function`, () => {
      const output = run(`${cmd} describe helloGET ${args}`, cwd);
      assert(output.includes(`helloGET`));
      assert(output.includes(`HTTP`));
      assert(output.includes(`/helloGET`));
    });
  });

  describe(`list`, () => {
    it(`should list no functions`, () => {
      const output = run(`${cmd} list ${args}`, cwd);
      assert(output.includes(name));
      assert(output.includes(`helloData`));
      assert(output.includes(`helloGET`));
      assert(output.includes(`helloPOST`));
    });
  });

  describe(`call`, () => {
    it(`should call a function`, () => {
      const output = run(`${cmd} call hello --data '{}' ${args}`, cwd);
      assert(output.includes(`Hello World`));
    });

    it(`should call a function with JSON`, () => {
      const output = run(`${cmd} call helloData --data '{"foo":"bar"}' ${args}`, cwd);
      assert(output.includes(`bar`));
    });

    it(`should call a synchronous function`, () => {
      const output = run(`${cmd} call helloPromise --data '{"foo":"bar"}' ${args}`, cwd);
      assert(output.includes(`bar`));
    });

    it(`should call a function that throws and process does not crash`, () => {
      // TODO: Verify output when it gets fixed
      let output = run(`${cmd} call helloThrow --data '{}' ${args}`, cwd);

      output = run(`${cmd} status ${args}`, cwd);
      assert(output.includes(`RUNNING`));
    });

    it(`should call a function returns JSON`, () => {
      const output = run(`${cmd} call helloJSON --data '{}' ${args}`, cwd);
      assert(output.includes(`{ message: 'Hello World' }`));
    });

    it(`should call an HTTP function`, () => {
      const output = run(`${cmd} call helloGET --data '{}' ${args}`, cwd);
      assert(output.includes(`statusCode: 200`));
    });

    it(`should call an HTTP function and send it JSON`, () => {
      const output = run(`${cmd} call helloPOST --data '{"foo":"bar"}' ${args}`, cwd);
      assert(output.includes(`body: { foo: 'bar' } }`));
    });
  });

  describe(`delete`, () => {
    it(`should delete a function`, () => {
      let output = run(`${cmd} delete helloData ${args}`, cwd);
      assert(output.includes(`Function helloData deleted.`));

      output = run(`${cmd} list ${args}`, cwd);
      assert.equal(output.includes(`No functions deployed`), false);
      assert.equal(output.includes(`helloData`), false);
      assert(output.includes(`hello`));
    });
  });

  describe(`clear`, () => {
    it(`should clear existing functions`, () => {
      let output = run(`${cmd} list ${args}`, cwd);

      assert.equal(output.includes(`No functions deployed`), false);
      assert(output.includes(`helloPOST`));

      output = run(`${cmd} clear ${args}`, cwd);
      assert(output.includes(`${prefix} CLEARED`));

      output = run(`${cmd} list ${args}`, cwd);
      assert(output.includes(`No functions deployed`));
    });
  });

  describe(`kill`, () => {
    it(`should kill the server`);
  });

  describe(`logs`, () => {
    describe(`read`, () => {
      it(`should list logs`);
      it(`should list and limit logs`);
    });
  });

  describe(`prune`, () => {
    it(`should prune functions`);
  });

  describe(`restart`, () => {
    it(`should restart the server`);
  });

  describe(`status`, () => {
    it(`should show the server status`, () => {
      let output = run(`${cmd} status ${args}`, cwd);
      assert(output.includes(`${prefix}`));
      assert(output.includes(`RUNNING`));
      assert(output.includes(`http://localhost:8008/`));
      assert(output.includes(`rest`));

      output = run(`${cmd} stop ${args}`, cwd);
      assert(output.includes(`STOPPED`));

      output = run(`${cmd} status ${args}`, cwd);
      assert(output.includes(`STOPPED`));
    }).timeout(10000);
  });
});
