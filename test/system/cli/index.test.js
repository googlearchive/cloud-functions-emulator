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

const got = require(`got`);
const path = require(`path`);

process.env.XDG_CONFIG_HOME = path.join(__dirname, `../`);

const Configstore = require(`configstore`);
const spawnSync = require(`child_process`).spawnSync;
const fs = require(`fs`);
const storage = require(`@google-cloud/storage`)();
const uuid = require(`uuid`);

const pkg = require(`../../../package.json`);
const run = require(`./utils`).run;
const getProjectId = require('../../../src/utils/project');

const bucketName = `cloud-functions-emulator-${uuid.v4()}`;
const cmd = `node bin/functions`;
const cwd = path.join(__dirname, `../../..`);
const logFile = path.join(__dirname, `../test.log`);
const name = `hello`;
const config = new Configstore(path.join(pkg.name, `config`));
const server = new Configstore(path.join(pkg.name, `.active-server`));
const functions = new Configstore(path.join(pkg.name, `.functions`));
const operations = new Configstore(path.join(pkg.name, `.operations`));
const prefix = `Google Cloud Functions Emulator`;

const GCLOUD = process.env.GCLOUD_CMD_OVERRIDE || `gcloud`;
const REST_PORT = 8088;
const GRPC_PORT = 8089;
const SUPERVISOR_PORT = 8090;
const REGION = `us-central1`;
const PROJECT_ID = getProjectId(null, false);

function makeTests (service, override) {
  const args = `--logFile=${logFile} --service=${service} --grpcHost=localhost --grpcPort=${GRPC_PORT} --debug=false --inspect=false --restHost=localhost --restPort=${REST_PORT} --runSupervisor=true --supervisorHost=localhost --supervisorPort=${SUPERVISOR_PORT} --verbose`;
  let overrideArgs = ``;
  let currentEndpoint;

  describe(`${service}${override ? '-sdk' : ''}`, () => {
    before(() => {
      if (override) {
        overrideArgs = `--region=${REGION}`;
        const output = spawnSync(`${GCLOUD} info --format='value(config.properties.api_endpoint_overrides.cloudfunctions)'`, { shell: true });
        currentEndpoint = output.stdout.toString().trim() + output.stderr.toString().trim();
        spawnSync(`${GCLOUD} config set api_endpoint_overrides/cloudfunctions http://localhost:${REST_PORT}/`, { shell: true, stdio: ['ignore', 'ignore', 'ignore'] });
      }

      try {
        // Try to remove the existing file if it's there
        fs.unlinkSync(logFile);
      } catch (err) {

      }

      // Clear all Functions data
      functions.clear();
      // Clear all Operations data
      operations.clear();

      config.set('restPort', REST_PORT);
      server.set('restPort', REST_PORT);
      config.set('grpcPort', GRPC_PORT);
      server.set('grpcPort', GRPC_PORT);
      config.set('supervisorPort', SUPERVISOR_PORT);
      server.set('supervisorPort', SUPERVISOR_PORT);
      config.set('logFile', logFile);
      server.set('logFile', logFile);

      let output = run(`${cmd} restart ${args}`, cwd);
      assert(output.includes(`${prefix} STARTED`));

      output = run(`${cmd} clear ${args}`, cwd);
      assert(output.includes(`${prefix} CLEARED`));
    });

    after(() => {
      if (override) {
        if (currentEndpoint) {
          spawnSync(`${GCLOUD} config set api_endpoint_overrides/cloudfunctions ${currentEndpoint}`, { shell: true, stdio: ['ignore', 'ignore', 'ignore'] });
        }
      }

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
        assert(output.includes(`grpcHost`));
        assert(output.includes(`grpcPort`));
        assert(output.includes(`restHost`));
        assert(output.includes(`restPort`));
      });
    });

    describe(`deploy`, () => {
      let deployArgs = args;

      before(() => {
        if (override) {
          deployArgs = `${overrideArgs} --stage-bucket=${bucketName}`;
          const output = run(`${override} list`, cwd);
          assert(output.includes(`Listed 0 items.`));
        } else {
          const output = run(`${cmd} list ${args}`, cwd);
          assert(output.includes(`No functions deployed`));
        }
      });

      it(`should deploy a background function`, () => {
        const output = run(`${override || cmd} deploy ${name} --local-path=test/test_module/ --trigger-provider=cloud.storage --trigger-event=object.change --trigger-resource=test ${deployArgs}`, cwd);
        if (override) {
          assert(output.includes(`/functions/${name}`));
        } else {
          assert(output.includes(`Function ${name} deployed.`));
        }
      });

      it(`should deploy a function with JSON`, () => {
        const output = run(`${override || cmd} deploy helloData --local-path=test/test_module/ --trigger-provider=cloud.storage --trigger-event=object.change --trigger-resource=test ${deployArgs}`, cwd);
        if (override) {
          assert(output.includes(`/functions/helloData`));
        } else {
          assert(output.includes(`Function helloData deployed.`));
        }
      });

      it(`should deploy a synchronous function`, () => {
        const output = run(`${override || cmd} deploy helloPromise --local-path=test/test_module/ --trigger-provider=cloud.storage --trigger-event=object.change --trigger-resource=test ${deployArgs}`, cwd);
        if (override) {
          assert(output.includes(`/functions/helloPromise`));
        } else {
          assert(output.includes(`Function helloPromise deployed.`));
        }
      });

      it(`should deploy a function that throws and process does not crash`, () => {
        const output = run(`${override || cmd} deploy helloThrow --local-path=test/test_module/ --trigger-provider=cloud.storage --trigger-event=object.change --trigger-resource=test ${deployArgs}`, cwd);
        if (override) {
          assert(output.includes(`/functions/helloThrow`));
        } else {
          assert(output.includes(`Function helloThrow deployed.`));
        }
      });

      it(`should deploy a function returns JSON`, () => {
        const output = run(`${override || cmd} deploy helloJSON --local-path=test/test_module/ --trigger-provider=cloud.storage --trigger-event=object.change --trigger-resource=test ${deployArgs}`, cwd);
        if (override) {
          assert(output.includes(`/functions/helloJSON`));
        } else {
          assert(output.includes(`Function helloJSON deployed.`));
        }
      });

      it(`should deploy an HTTP function`, () => {
        const output = run(`${override || cmd} deploy helloGET --local-path=test/test_module/ --trigger-http ${deployArgs}`, cwd);
        if (override) {
          assert(output.includes(`/functions/helloGET`));
        } else {
          assert(output.includes(`Function helloGET deployed.`));
        }
      });

      it(`should deploy an HTTP function and send it JSON`, () => {
        const output = run(`${override || cmd} deploy helloPOST --local-path=test/test_module/ --trigger-http ${deployArgs}`, cwd);
        if (override) {
          assert(output.includes(`/functions/helloPOST`));
        } else {
          assert(output.includes(`Function helloPOST deployed.`));
        }
      });

      it(`should fail when the module does not exist`, () => {
        const output = run(`${override || cmd} deploy ${name} --local-path=test/test_module/foo/bar --trigger-http ${deployArgs}`, cwd);
        assert(output.includes(`Provided directory does not exist.`));
      });

      if (!override) {
        it(`should fail when the function does not exist`, () => {
          // TODO: Make this work for the SDK
          const output = run(`${cmd} deploy doesNotExist --local-path=test/test_module/ --trigger-http ${deployArgs}`, cwd);
          assert(output.includes(`Node.js module defined by file index.js is expected to export function named doesNotExist`));
        });
      }

      it(`should deploy a function using a stage bucket`);
    });

    describe(`describe`, () => {
      it(`should describe a background function`, () => {
        const output = run(`${override || cmd} describe ${name} ${overrideArgs || args}`, cwd);
        assert(output.includes(name));
        if (override) {
          assert(output.includes(`eventTrigger`));
        } else {
          assert(output.includes(`Resource`));
        }
        assert(output.includes(`test`));
      });

      it(`should describe an HTTP function`, () => {
        const output = run(`${override || cmd} describe helloGET ${overrideArgs || args}`, cwd);
        assert(output.includes(`helloGET`));
        if (override) {
          assert(output.includes(`httpsTrigger`));
        } else {
          assert(output.includes(`HTTP`));
        }
        assert(output.includes(`/helloGET`));
      });
    });

    describe(`list`, () => {
      it(`should list functions`, () => {
        const output = run(`${override || cmd} list ${override ? '' : args}`, cwd);
        assert(output.includes(name));
        assert(output.includes(`helloData`));
        assert(output.includes(`helloGET`));
        assert(output.includes(`helloPOST`));
      });
    });

    describe(`call`, () => {
      it(`should call a function`, () => {
        const output = run(`${override || cmd} call hello --data '{}' ${overrideArgs || args}`, cwd);
        try {
          assert(output.includes(`Hello World`));
        } catch (err) {
          assert(output.includes(`executionId`));
        }
      });

      it(`should call a function that throws and process does not crash`, () => {
        // TODO: Verify output when it gets fixed
        let output = run(`${override || cmd} call helloThrow --data '{}' ${overrideArgs || args}`, cwd);

        output = run(`${cmd} status ${args}`, cwd);
        assert(output.includes(`RUNNING`));
      });

      if (override) {
        // TODO: Figure out why the output of the following calls is empty when
        // done through the Cloud SDK
        return;
      }

      it(`should call a function with JSON`, () => {
        const output = run(`${override || cmd} call helloData --data '{"foo":"bar"}' ${overrideArgs || args}`, cwd);
        assert(output.includes(`bar`));
      });

      it(`should call a synchronous function`, () => {
        const output = run(`${override || cmd} call helloPromise --data '{"foo":"bar"}' ${overrideArgs || args}`, cwd);
        assert(output.includes(`bar`));
      });

      it(`should call a function returns JSON`, () => {
        const output = run(`${override || cmd} call helloJSON --data '{}' ${overrideArgs || args}`, cwd);
        assert(output.includes(`{ message: 'Hello World' }`));
      });

      it(`should call an HTTP function`, () => {
        const output = run(`${override || cmd} call helloGET --data '{}' ${overrideArgs || args}`, cwd);
        assert(output.includes(`method: 'POST'`));
      });

      it(`should call an HTTP function via trigger URL`, () => {
        return got(`http://localhost:${SUPERVISOR_PORT}/${PROJECT_ID}/${REGION}/helloGET`, {
          method: 'GET',
          headers: {
            'x-api-key': 'any'
          },
          json: true
        }).then((response) => {
          assert.equal(response.body.headers[`x-api-key`], `any`);
          assert.equal(response.body.method, `GET`);
          assert.deepEqual(response.body.query, {});
          assert.equal(response.body.path, `/helloGET`);
        });
      });

      it(`should call an HTTP function via trigger URL with extras`, () => {
        return got(`http://localhost:${SUPERVISOR_PORT}/${PROJECT_ID}/${REGION}/helloGET/test?foo=bar&beep=boop`, {
          method: 'GET',
          headers: {
            'x-api-key': 'any'
          },
          json: true
        }).then((response) => {
          assert.equal(response.body.headers[`x-api-key`], `any`);
          assert.equal(response.body.method, `GET`);
          assert.deepEqual(response.body.query, {
            foo: 'bar',
            beep: 'boop'
          });
          assert.equal(response.body.path, `/helloGET/test`);
        });
      });

      it(`should call an HTTP function and send it JSON`, () => {
        const output = run(`${override || cmd} call helloPOST --data '{"foo":"bar"}' ${overrideArgs || args}`, cwd);
        assert(output.includes(`body: { foo: 'bar' } }`));
      });
    });

    describe(`delete`, () => {
      it(`should delete a function`, () => {
        let output = run(`${override || cmd} delete helloData ${overrideArgs || args}`, cwd);
        if (override) {
          assert(output.includes(`/functions/helloData`));
          assert(output.includes(`will be deleted`));
        } else {
          assert(output.includes(`Function helloData deleted.`));
        }

        output = run(`${override || cmd} list ${overrideArgs || args}`, cwd);
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
        assert(output.includes(`http://localhost:${REST_PORT}/`));
        assert(output.includes(`http://localhost:${GRPC_PORT}/`));

        output = run(`${cmd} stop ${args}`, cwd);
        assert(output.includes(`STOPPED`));

        output = run(`${cmd} status ${args}`, cwd);
        assert(output.includes(`STOPPED`));
      }).timeout(20000);
    });
  });
}

describe(`system/cli`, () => {
  before(() => storage.createBucket(bucketName));

  after(() => {
    return storage.bucket(bucketName).deleteFiles({ force: true })
      .then(() => storage.bucket(bucketName).deleteFiles({ force: true }))
      .then(() => storage.bucket(bucketName).delete());
  });

  makeTests(`rest`);
  makeTests(`rest`, `${GCLOUD} beta functions`);
  makeTests(`grpc`);
});
