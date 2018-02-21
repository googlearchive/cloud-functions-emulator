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

const proxyquire = require('proxyquire').noPreserveCache();
const sinon = require('sinon');

describe('unit/supervisor/supervisor', () => {
  let Supervisor;

  beforeEach(() => {
    Supervisor = proxyquire('../../../src/supervisor/supervisor', {});
  });

  describe('Supervisor()', () => {
    it('should be a constructor function', () => {
      assert.equal(typeof Supervisor, 'function');
    });

    it('should construct a Supervisor', () => {
      const functionsMock = {};
      const optsMock = {};

      const supervisor = new Supervisor(functionsMock, optsMock);

      assert.strictEqual(supervisor._functions, functionsMock);
      assert.notStrictEqual(supervisor.config, optsMock);
      assert.deepEqual(supervisor.config, {
        idlePruneInterval: Supervisor.DEFAULT_IDLE_PRUNE_INTERVAL,
        maxIdle: Supervisor.DEFAULT_MAX_IDLE
      });
      assert.equal(typeof supervisor.app, 'function');
      assert.equal(typeof supervisor._proxy, 'object');
      assert(supervisor._workerPool instanceof Map);
    });

    it('should check args', () => {
      const functionsMock = {};

      let supervisor = new Supervisor(functionsMock);

      assert.deepEqual(supervisor.config, {
        idlePruneInterval: Supervisor.DEFAULT_IDLE_PRUNE_INTERVAL,
        maxIdle: Supervisor.DEFAULT_MAX_IDLE
      });

      supervisor = new Supervisor(functionsMock, {
        useMocks: 'true'
      });

      assert.strictEqual(supervisor.config.useMocks, true);

      supervisor = new Supervisor(functionsMock, {
        useMocks: 'false'
      });

      assert.strictEqual(supervisor.config.useMocks, false);
    });
  });

  describe('Supervisor#debugHandler', () => {
    it('should start a worker in debug mode', () => {
      const supervisor = new Supervisor();
      supervisor.closeWorker = sinon.stub().returns(Promise.resolve());
      supervisor.getOrCreateWorker = sinon.stub().returns(Promise.resolve());

      const req = {
        body: {
          name: 'functionA'
        }
      };

      const res = {
        end: sinon.stub()
      };

      return supervisor.debugHandler(req, res)
        .then(() => {
          assert.equal(supervisor.closeWorker.callCount, 1);
          assert.deepEqual(
            supervisor.closeWorker.getCall(0).args,
            [req.body.name]
          );
          assert.equal(supervisor.getOrCreateWorker.callCount, 1);
          assert.deepEqual(
            supervisor.getOrCreateWorker.getCall(0).args,
            [req.body.name, req.body]
          );
          assert.equal(res.end.callCount, 1);
          assert.deepEqual(res.end.getCall(0).args, []);
        });
    });
  });

  describe('Supervisor#deleteHandler', () => {
    it('should shutdown a worker', () => {
      const supervisor = new Supervisor();
      supervisor.closeWorker = sinon.stub().returns(Promise.resolve());

      const req = {
        body: {
          name: 'functionA'
        }
      };

      const res = {
        end: sinon.stub()
      };

      return supervisor.deleteHandler(req, res)
        .then(() => {
          assert.equal(supervisor.closeWorker.callCount, 1);
          assert.deepEqual(
            supervisor.closeWorker.getCall(0).args,
            [req.body.name]
          );
          assert.equal(res.end.callCount, 1);
          assert.deepEqual(res.end.getCall(0).args, []);
        });
    });
  });

  describe('Supervisor#deployHandler', () => {
    it('should start a worker', () => {
      const supervisor = new Supervisor();
      supervisor.closeWorker = sinon.stub().returns(Promise.resolve());
      supervisor.getOrCreateWorker = sinon.stub().returns(Promise.resolve());

      const req = {
        body: {
          name: 'functionA'
        }
      };

      const res = {
        end: sinon.stub()
      };

      return supervisor.deployHandler(req, res)
        .then(() => {
          assert.equal(supervisor.closeWorker.callCount, 1);
          assert.deepEqual(
            supervisor.closeWorker.getCall(0).args,
            [req.body.name]
          );
          assert.equal(supervisor.getOrCreateWorker.callCount, 1);
          assert.deepEqual(
            supervisor.getOrCreateWorker.getCall(0).args,
            [req.body.name]
          );
          assert.equal(res.end.callCount, 1);
          assert.deepEqual(res.end.getCall(0).args, []);
        });
    });
  });

  describe('Supervisor#getWorker', () => {
    it('should return a worker', () => {
      const functionsMock = {};
      const supervisor = new Supervisor(functionsMock);

      const workerA = {};
      supervisor._workerPool.set('a', workerA);

      assert.strictEqual(supervisor.getWorker('a'), workerA);
      assert.strictEqual(supervisor.getWorker('b'), undefined);
    });
  });

  describe('Supervisor#hasWorker', () => {
    it('should return a worker', () => {
      const functionsMock = {};
      const supervisor = new Supervisor(functionsMock);

      supervisor._workerPool.set('a', {});

      assert.strictEqual(supervisor.hasWorker('a'), true);
      assert.strictEqual(supervisor.hasWorker('b'), false);
    });
  });

  describe('Supervisor#prune', () => {
    it('should close all idle workers', () => {
      const functionsMock = {};
      const optsMock = {};

      const supervisor = new Supervisor(functionsMock, optsMock);

      supervisor.closeWorker = sinon.stub();

      supervisor._workerPool.set('idle', {
        lastAccessed: Date.now() - 1000000
      });
      supervisor._workerPool.set('active', {
        lastAccessed: Date.now()
      });

      return supervisor.prune()
        .then(() => {
          assert.equal(supervisor.closeWorker.callCount, 1);
          assert.deepEqual(supervisor.closeWorker.getCall(0).args, ['idle']);
        });
    });
  });

  describe('Supervisor#resetHandler', () => {
    it('should reset a worker', () => {
      const result = { worker: { debug: true, debugPort: 5858 } };
      const supervisor = new Supervisor();
      supervisor.closeWorker = sinon.stub();
      supervisor.closeWorker.onCall(0).returns(Promise.resolve(result));
      supervisor.closeWorker.onCall(1).returns(Promise.resolve(result));
      supervisor.closeWorker.onCall(2).returns(Promise.resolve({}));
      supervisor.getOrCreateWorker = sinon.stub().returns(Promise.resolve());

      const req = {
        body: {
          name: 'functionA'
        }
      };

      const res = {
        end: sinon.stub()
      };

      return supervisor.resetHandler(req, res)
        .then(() => {
          assert.equal(supervisor.closeWorker.callCount, 1);
          assert.deepEqual(
            supervisor.closeWorker.getCall(0).args,
            [req.body.name]
          );
          assert.equal(supervisor.getOrCreateWorker.callCount, 1);
          assert.deepEqual(
            supervisor.getOrCreateWorker.getCall(0).args,
            [req.body.name, undefined]
          );
          assert.equal(res.end.callCount, 1);
          assert.deepEqual(res.end.getCall(0).args, []);

          req.body.keep = true;
          return supervisor.resetHandler(req, res);
        })
        .then(() => {
          assert.equal(supervisor.closeWorker.callCount, 2);
          assert.deepEqual(
            supervisor.closeWorker.getCall(1).args,
            [req.body.name]
          );
          assert.equal(supervisor.getOrCreateWorker.callCount, 2);
          assert.deepEqual(
            supervisor.getOrCreateWorker.getCall(1).args,
            [
              req.body.name,
              {
                name: req.body.name,
                debug: result.worker.debug,
                inspect: result.worker.inspect,
                port: result.worker.inspectPort || result.worker.debugPort,
                pause: result.worker.paused
              }
            ]
          );
          assert.equal(res.end.callCount, 2);
          assert.deepEqual(res.end.getCall(1).args, []);

          return supervisor.resetHandler(req, res);
        })
        .then(() => {
          assert.equal(supervisor.closeWorker.callCount, 3);
          assert.deepEqual(
            supervisor.closeWorker.getCall(2).args,
            [req.body.name]
          );
          assert.equal(supervisor.getOrCreateWorker.callCount, 3);
          assert.deepEqual(
            supervisor.getOrCreateWorker.getCall(2).args,
            [req.body.name, undefined]
          );
          assert.equal(res.end.callCount, 3);
          assert.deepEqual(res.end.getCall(2).args, []);
        });
    });
  });

  describe('Supervisor#start', () => {
    it('should start the supervisor', () => {
      const opts = {
        bindHost: 'localhost',
        address: 'localhost',
        port: 8010
      };
      const supervisor = new Supervisor(null, opts);
      const serverMock = {
        address: sinon.stub().returns(opts)
      };
      serverMock.on = sinon.stub().returns(serverMock).yields();
      supervisor.app = {
        listen: sinon.stub().returns(serverMock)
      };
      supervisor.stop = sinon.stub();

      assert.strictEqual(supervisor.start(), supervisor);
      assert(supervisor.pruneIntervalId);
      clearInterval(supervisor.pruneIntervalId);

      assert.equal(supervisor.app.listen.callCount, 1);
      assert.deepEqual(
        supervisor.app.listen.getCall(0).args,
        [opts.port, opts.bindHost]
      );
      assert.equal(serverMock.on.callCount, 3);
      assert.deepEqual(serverMock.on.getCall(0).args.slice(0, -1), ['listening']);
      assert.deepEqual(serverMock.on.getCall(1).args.slice(0, -1), ['error']);
      assert.deepEqual(serverMock.on.getCall(2).args.slice(0, -1), ['clientError']);
    });
  });

  describe('Supervisor#stop', () => {
    before(() => {
      sinon.spy(global, 'clearInterval');
    });

    it('should stop the supervisor', () => {
      const supervisor = new Supervisor();
      const serverMock = {
        close: sinon.stub().yields()
      };
      supervisor._server = serverMock;
      supervisor.clear = sinon.stub();

      assert.strictEqual(supervisor.stop(), supervisor);

      assert.equal(serverMock.close.callCount, 1);
      assert.equal(supervisor.clear.callCount, 1);
    });

    after(() => {
      global.clearInterval.restore();
    });
  });
});
