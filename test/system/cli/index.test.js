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

const got = require(`got`);
const path = require(`path`);

process.env.XDG_CONFIG_HOME = path.join(__dirname, `../`);

const Configstore = require(`configstore`);
const fs = require(`fs`);
const rimraf = require(`rimraf`);
const storage = require(`@google-cloud/storage`)();
const tools = require(`@google-cloud/nodejs-repo-tools`);
const uuid = require(`uuid`);

const pkg = require(`../../../package.json`);
const { run } = require(`./utils`);
const detectProjectId = require('../../../src/utils/detectProjectId');

const bucketName = `cloud-functions-emulator-${uuid.v4()}`;
const cmd = `node bin/functions`;
const cwd = path.join(__dirname, `../../..`);
const logFile = path.join(__dirname, `../test-log.txt`);
const name = `hello`;
const config = new Configstore(path.join(pkg.name, `config`));
const server = new Configstore(path.join(pkg.name, `.active-server`));
const functions = new Configstore(path.join(pkg.name, `.functions`));
const operations = new Configstore(path.join(pkg.name, `.operations`));
const prefix = `Google Cloud Functions Emulator`;

const GCLOUD = process.env.GCLOUD_CMD_OVERRIDE || `gcloud`;
const HOST = 'localhost';
const REST_PORT = 8088;
const SUPERVISOR_PORT = 8090;
const REGION = `us-central1`;
const PROJECT_ID = detectProjectId(null, false);

function makeTests (service, override) {
  const shortArgs = ``;
  let overrideArgs = ``;
  let currentEndpoint;

  describe(`${service}${override ? '-sdk' : ''}`, () => {
    before(() => {
      return Promise.resolve()
        .then(() => {
          if (override) {
            overrideArgs = `--region=${REGION}`;
            return tools.spawnAsyncWithIO(GCLOUD, ['info', `--format='value(config.properties.api_endpoint_overrides.cloudfunctions)'`], cwd)
              .then((results) => {
                currentEndpoint = results.output;
                return tools.spawnAsyncWithIO(GCLOUD, ['config', 'set', 'api_endpoint_overrides/cloudfunctions', `http://localhost:${REST_PORT}/`], cwd);
              });
          }
        })
        .then(() => {
          try {
            // Try to remove the existing file if it's there
            fs.unlinkSync(logFile);
          } catch (err) {

          }

          // Clear all Functions data
          functions.clear();
          // Clear all Operations data
          operations.clear();

          config.set('host', HOST);
          server.set('host', HOST);
          config.set('service', service);
          server.set('service', service);
          config.set('restPort', REST_PORT);
          server.set('restPort', REST_PORT);
          config.set('supervisorPort', SUPERVISOR_PORT);
          server.set('supervisorPort', SUPERVISOR_PORT);
          config.set('logFile', logFile);
          server.set('logFile', logFile);

          return tools.spawnAsyncWithIO('node', ['bin/functions', 'stop'], cwd);
        })
        .then(() => tools.spawnAsyncWithIO('node', ['bin/functions', 'restart'], cwd))
        .then((results) => {
          assert(results.output.includes(`${prefix} STARTED`));

          return tools.tryTest(() => {
            return tools.spawnAsyncWithIO('node', ['bin/functions', 'clear'], cwd)
              .then((results) => {
                assert(results.output.includes(`${prefix} CLEARED`));
              });
          }).start();
        });
    });

    after(() => {
      return Promise.resolve()
        .then(() => {
          if (override) {
            if (currentEndpoint) {
              return tools.spawnAsyncWithIO(GCLOUD, ['config', 'set', 'api_endpoint_overrides/cloudfunctions', currentEndpoint]);
            } else {
              return tools.spawnAsyncWithIO(GCLOUD, ['config', 'unset', 'api_endpoint_overrides/cloudfunctions']);
            }
          }
        })
        .then(() => tools.spawnAsyncWithIO('node', ['bin/functions', 'restart'], cwd))
        .then((results) => {
          assert(results.output.includes(`${prefix} STARTED`));

          return tools.tryTest(() => {
            return tools.spawnAsyncWithIO('node', ['bin/functions', 'clear'], cwd)
              .then((results) => {
                assert(results.output.includes(`${prefix} CLEARED`));
              });
          }).start();
        })
        .then(() => tools.spawnAsyncWithIO('node', ['bin/functions', 'stop'], cwd))
        .then((results) => {
          assert(results.output.includes(`${prefix} STOPPED`));
        });
    });

    describe(`config`, () => {
      it(`should list configuration`, () => {
        let output = run(`${cmd} config list`, cwd);
        assert(output.includes(`host`));
        assert(output.includes(`restPort`));
      });
    });

    describe(`deploy`, () => {
      let deployArgs = shortArgs;

      before(() => {
        if (override) {
          deployArgs = `${overrideArgs} --stage-bucket=${bucketName}`;
          const output = run(`${override} list --regions=${REGION}`, cwd);
          assert(output.includes(`Listed 0 items.`));
        } else {
          return tools.tryTest(() => {
            const output = run(`${cmd} list`, cwd);
            assert(output.includes(`No functions deployed`));
          }).start();
        }
      });

      it(`should deploy a background function`, () => {
        const output = run(`${override || cmd} deploy ${name} --source=test/test_module/ --trigger-bucket=test ${deployArgs}`, cwd);
        if (override) {
          try {
            assert(output.includes(`/functions/${name}`));
          } catch (err) {
            console.error('flaky', err);
          }
          assert(output.includes(`done`));
        } else {
          assert(output.includes(`Function ${name} deployed.`));
        }
      });

      it(`should deploy a function with JSON`, () => {
        const output = run(`${override || cmd} deploy helloData --source=test/test_module/ --trigger-bucket=test ${deployArgs}`, cwd);
        if (override) {
          try {
            assert(output.includes(`/functions/helloData`));
          } catch (err) {
            console.error('flaky', err);
          }
          assert(output.includes(`done`));
        } else {
          assert(output.includes(`Function helloData deployed.`));
        }
      });

      it(`should deploy a synchronous function`, () => {
        const output = run(`${override || cmd} deploy helloPromise --source=test/test_module/ --trigger-bucket=test ${deployArgs}`, cwd);
        if (override) {
          try {
            assert(output.includes(`/functions/helloPromise`));
          } catch (err) {
            console.error('flaky', err);
          }
          assert(output.includes(`done`));
        } else {
          assert(output.includes(`Function helloPromise deployed.`));
        }
      });

      it(`should deploy a function that throws and process does not crash`, () => {
        const output = run(`${override || cmd} deploy helloThrow --source=test/test_module/ --trigger-bucket=test ${deployArgs}`, cwd);
        if (override) {
          try {
            assert(output.includes(`/functions/helloThrow`));
          } catch (err) {
            console.error('flaky', err);
          }
          assert(output.includes(`done`));
        } else {
          assert(output.includes(`Function helloThrow deployed.`));
        }
      });

      it(`should deploy a function returns JSON`, () => {
        const output = run(`${override || cmd} deploy helloJSON --source=test/test_module/ --trigger-bucket=test ${deployArgs}`, cwd);
        if (override) {
          try {
            assert(output.includes(`/functions/helloJSON`));
          } catch (err) {
            console.error('flaky', err);
          }
          assert(output.includes(`done`));
        } else {
          assert(output.includes(`Function helloJSON deployed.`));
        }
      });

      it(`should deploy a function with a timeout`, () => {
        const output = run(`${override || cmd} deploy helloSlow --source=test/test_module/ --trigger-http --timeout=2s ${deployArgs}`, cwd);
        if (override) {
          try {
            assert(output.includes(`/functions/helloSlow`));
          } catch (err) {
            console.error('flaky', err);
          }
          assert(output.includes(`done`));
        } else {
          assert(output.includes(`Function helloSlow deployed.`));
        }
      });

      it(`should deploy an HTTP function that fails to respond (crashes asynchronously)`, () => {
        const output = run(`${override || cmd} deploy helloNoResponse --source=test/test_module/ --trigger-http ${deployArgs}`, cwd);
        if (override) {
          try {
            assert(output.includes(`/functions/helloNoResponse`));
          } catch (err) {
            console.error('flaky', err);
          }
          assert(output.includes(`done`));
        } else {
          assert(output.includes(`Function helloNoResponse deployed.`));
        }
      });

      it(`should deploy an HTTP function`, () => {
        const output = run(`${override || cmd} deploy helloGET --source=test/test_module/ --trigger-http ${deployArgs}`, cwd);
        if (override) {
          try {
            assert(output.includes(`/functions/helloGET`));
          } catch (err) {
            console.error('flaky', err);
          }
          assert(output.includes(`done`));
        } else {
          assert(output.includes(`Function helloGET deployed.`));
        }
      });

      it(`should deploy an HTTP function and send it JSON`, () => {
        const output = run(`${override || cmd} deploy helloPOST --source=test/test_module/ --trigger-http ${deployArgs}`, cwd);
        if (override) {
          try {
            assert(output.includes(`/functions/helloPOST`));
          } catch (err) {
            console.error('flaky', err);
          }
          assert(output.includes(`done`));
        } else {
          assert(output.includes(`Function helloPOST deployed.`));
        }
      });

      it(`should deploy a function that needs "npm install"`, () => {
        let _cmd = `${override || cmd} deploy helloUuidNpm --source=test/test_module_2/ --trigger-http ${deployArgs}`;
        if (!_cmd.includes(`--stage-bucket=${bucketName}`)) {
          _cmd = `${_cmd} --stage-bucket=${bucketName}`;
        }
        const output = run(_cmd, cwd);
        try {
          if (override) {
            assert(output.includes(`/functions/helloUuidNpm`));
            assert(output.includes(`done`));
          } else {
            assert(output.includes(`Function helloUuidNpm deployed.`));
          }
        } catch (err) {
          console.error('flaky', err);
        }
      });

      it(`should deploy a function that needs "yarn install"`, () => {
        let _cmd = `${override || cmd} deploy helloUuidYarn --source=test/test_module_3/ --trigger-http ${deployArgs}`;
        if (!_cmd.includes(`--stage-bucket=${bucketName}`)) {
          _cmd = `${_cmd} --stage-bucket=${bucketName}`;
        }
        const output = run(_cmd, cwd);
        try {
          if (override) {
            assert(output.includes(`/functions/helloUuidYarn`));
            assert(output.includes(`done`));
          } else {
            assert(output.includes(`Function helloUuidYarn deployed.`));
          }
        } catch (err) {
          console.error('flaky', err);
        }
      });

      it(`should fail when the module does not exist`, () => {
        const output = run(`${override || cmd} deploy fail --source=test/test_module/foo/bar --trigger-http ${deployArgs}`, cwd);
        assert(output.includes(`Provided directory does not exist.`));
      });

      if (!override) {
        it(`should fail when the function does not exist`, () => {
          // TODO: Make this work for the SDK
          const output = run(`${cmd} deploy doesNotExist --source=test/test_module/ --trigger-http ${deployArgs}`, cwd);
          assert(output.includes(`Node.js module defined by file index.js is expected to export function named doesNotExist`));
        });
      }

      it(`should deploy a function using a stage bucket`);
    });

    describe(`describe`, () => {
      it(`should describe a background function`, () => {
        const output = run(`${override || cmd} describe ${name} ${overrideArgs || shortArgs}`, cwd);
        assert(output.includes(name));
        if (override) {
          assert(output.includes(`eventTrigger`));
        } else {
          assert(output.includes(`Resource`));
        }
        assert(output.includes(`test`));
      });

      it(`should describe an HTTP function`, () => {
        const output = run(`${override || cmd} describe helloGET ${overrideArgs || shortArgs}`, cwd);
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
        const output = run(`${override || cmd} list ${override ? `--regions=${REGION}` : shortArgs}`, cwd);
        assert(output.includes(name));
        assert(output.includes(`helloData`));
        assert(output.includes(`helloGET`));
        assert(output.includes(`helloPOST`));
      });
    });

    describe(`call`, () => {
      let deployArgs = shortArgs;

      before(() => {
        if (override) {
          deployArgs = `${overrideArgs} --stage-bucket=${bucketName}`;
        }
      });

      it(`should call a function`, () => {
        const output = run(`${override || cmd} call hello --data='{}' ${overrideArgs || shortArgs}`, cwd);
        try {
          assert(output.includes(`Hello World`));
        } catch (err) {
          assert(output.includes(`executionId`));
        }
      });

      it(`should call a function that throws and process does not crash`, () => {
        // TODO: Verify output when it gets fixed
        let output = run(`${override || cmd} call helloThrow --data='{}' ${overrideArgs || shortArgs}`, cwd);

        output = run(`${cmd} status ${shortArgs}`, cwd);
        assert(output.includes(`RUNNING`));
      });

      if (override) {
        // TODO: Figure out why the output of the following calls is empty when
        // done through the Cloud SDK
        return;
      }

      it(`should call a function with JSON`, () => {
        const output = run(`${override || cmd} call helloData --data '{"foo":"bar"}' ${overrideArgs || shortArgs}`, cwd);
        assert(output.includes(`bar`));
      });

      it(`should call a synchronous function`, () => {
        const output = run(`${override || cmd} call helloPromise --data '{"foo":"bar"}' ${overrideArgs || shortArgs}`, cwd);
        assert(output.includes(`bar`));
      });

      it(`should call a function that returns JSON`, () => {
        const output = run(`${override || cmd} call helloJSON --data '{}' ${overrideArgs || shortArgs}`, cwd);
        assert(output.includes(`{ message: 'Hello World' }`));
      });

      it(`should re-deploy over a function`, () => {
        const output = run(`${override || cmd} deploy helloJSON --entry-point=helloPromise --source=test/test_module/ --trigger-bucket=test ${deployArgs}`, cwd);
        if (override) {
          assert(output.includes(`/functions/helloJSON`));
        } else {
          assert(output.includes(`Function helloJSON deployed.`));
        }
      });

      it(`should call the re-deployed function`, () => {
        const output = run(`${override || cmd} call helloJSON --data '{"foo":"bar"}' ${overrideArgs || shortArgs}`, cwd);
        assert(output.includes(`bar`));
      });

      it(`should call (via CLI) an HTTP function that exceeds its timeout`, () => {
        const output = run(`${override || cmd} call helloSlow ${overrideArgs || shortArgs}`, cwd);
        assert(output.includes(`function execution attempt timed out`));
      });

      it(`should call (via request) an HTTP function that exceeds its timeout`, () => {
        return got(`http://localhost:${SUPERVISOR_PORT}/${PROJECT_ID}/${REGION}/helloSlow`, {
          json: true
        }).then((response) => {
          assert.fail(`should have failed`);
        }).catch((err) => {
          assert.equal(err.response.statusCode, 500);
          assert.deepEqual(err.response.body, {
            error: {
              code: 500,
              status: 'INTERNAL',
              message: 'function execution attempt timed out'
            }
          });
        });
      });

      it(`should call (via CLI) an HTTP function that fails to respond (crashes asynchronously)`, () => {
        const output = run(`${override || cmd} call helloNoResponse ${overrideArgs || shortArgs}`, cwd);
        assert(output.includes(`function crashed`));
      });

      it(`should call (via request) an HTTP function that fails to respond (crashes asynchronously)`, () => {
        return got(`http://localhost:${SUPERVISOR_PORT}/${PROJECT_ID}/${REGION}/helloNoResponse`, {
          json: true
        }).then((response) => {
          assert.fail(`should have failed`);
        }).catch((err) => {
          assert.equal(err.response.statusCode, 500);
          assert.deepEqual(err.response.body, {
            error: {
              code: 500,
              status: 'INTERNAL',
              message: 'function crashed',
              errors: err.response.body.error.errors
            }
          });
        });
      });

      it(`should call an HTTP function`, () => {
        const output = run(`${override || cmd} call helloGET --data '{}' ${overrideArgs || shortArgs}`, cwd);
        assert(output.includes(`method: 'POST'`));
      });

      it(`should call a function that needed "npm install"`, () => {
        const output = run(`${override || cmd} call helloUuidNpm ${overrideArgs || shortArgs}`, cwd);
        assert(/[a-z0-9]+-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+/.test(output));
      });

      it(`should call a function that needed "yarn install"`, () => {
        const output = run(`${override || cmd} call helloUuidYarn ${overrideArgs || shortArgs}`, cwd);
        assert(/[a-z0-9]+-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+/.test(output));
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
          assert.equal(response.body.path, `/`);
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
          assert.equal(response.body.path, `/test`);
        });
      });

      it(`should call an HTTP function and send it JSON`, () => {
        const output = run(`${override || cmd} call helloPOST --data '{"foo":"bar"}' ${overrideArgs || shortArgs}`, cwd);
        assert(output.includes(`body: { foo: 'bar' } }`));
      });
    });

    describe(`delete`, () => {
      it(`should delete a function`, () => {
        let output = run(`${override || cmd} delete helloData ${overrideArgs ? overrideArgs + ' -q' : shortArgs}`, cwd);
        if (override) {
          assert(output.includes(`/functions/helloData`));
          assert(output.toLowerCase().includes(`deleted`));
        } else {
          assert(output.includes(`Function helloData deleted.`));
        }

        output = run(`${override || cmd} list ${override ? '--regions=' + REGION : ''}`, cwd);
        assert.equal(output.includes(`No functions deployed`), false);
        assert.equal(output.includes(`helloData`), false);
        assert(output.toLowerCase().includes(`hello`));
      });
    });

    if (!override) {
      describe(`debug`, () => {
        after(() => {
          run(`${cmd} reset helloGET ${shortArgs}`, cwd);
          run(`${cmd} reset helloPOST ${shortArgs}`, cwd);
        });
        it(`should debug a function`, () => {
          let output = run(`${cmd} debug helloGET ${shortArgs}`, cwd);
          assert(output.includes(`Debugger for helloGET listening on port 5858.`));
        });
        it(`should disallow use of same debug port`, () => {
          let output = run(`${cmd} debug helloPOST ${shortArgs}`, cwd);
          assert(output.includes(`Debug/Inspect port 5858 already in us`));
        });
        it(`should allow configuring debug port`, () => {
          let output = run(`${cmd} debug helloPOST --port=5859 ${shortArgs}`, cwd);
          assert(output.includes(`Debugger for helloPOST listening on port 5859.`));
        });
      });

      describe(`inspect`, () => {
        after(() => {
          run(`${cmd} reset helloGET ${shortArgs}`, cwd);
          run(`${cmd} reset helloPOST ${shortArgs}`, cwd);
        });
        it(`should inspect a function`, () => {
          let output = run(`${cmd} inspect helloGET ${shortArgs}`, cwd);
          assert(output.includes(`Debugger for helloGET listening on port 9229.`));
        });
        it(`should disallow use of same inspect port`, () => {
          let output = run(`${cmd} inspect helloPOST ${shortArgs}`, cwd);
          assert(output.includes(`Debug/Inspect port 9229 already in use`));
        });
        it(`should allow configuring inspect port`, () => {
          let output = run(`${cmd} inspect helloPOST --port=9230 ${shortArgs}`, cwd);
          assert(output.includes(`Debugger for helloPOST listening on port 9230.`));
        });
      });
    }

    describe(`clear`, () => {
      it(`should clear existing functions`, () => {
        let output = run(`${cmd} list ${shortArgs}`, cwd);

        assert.equal(output.includes(`No functions deployed`), false);
        assert(output.includes(`helloPOST`));

        output = run(`${cmd} clear ${shortArgs}`, cwd);
        assert(output.includes(`${prefix} CLEARED`));

        output = run(`${cmd} list ${shortArgs}`, cwd);
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
        let output = run(`${cmd} status ${shortArgs}`, cwd);
        assert(output.includes(`${prefix}`));
        assert(output.includes(`RUNNING`));
        assert(output.includes(`http://localhost:${REST_PORT}/`));
        assert(output.includes(`http://localhost:${SUPERVISOR_PORT}/${PROJECT_ID}/${REGION}`));

        output = run(`${cmd} stop ${shortArgs}`, cwd);
        assert(output.includes(`STOPPED`));

        output = run(`${cmd} status ${shortArgs}`, cwd);
        assert(output.includes(`STOPPED`));
      });
    });
  });
}

describe(`system/cli`, () => {
  before(() => {
    try {
      // Try to remove the existing file if it's there
      fs.unlinkSync(logFile);
    } catch (err) {

    }
    try {
      rimraf.sync(path.parse(config.path).dir);
    } catch (err) {

    }
    return storage.createBucket(bucketName);
  });

  after(() => {
    return storage.bucket(bucketName).deleteFiles({ force: true })
      .then(() => storage.bucket(bucketName).deleteFiles({ force: true }))
      .then(() => storage.bucket(bucketName).delete());
  });

  makeTests(`rest`);
  makeTests(`rest`, `${GCLOUD} beta functions`);
});
