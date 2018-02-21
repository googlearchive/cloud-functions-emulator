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
const nock = require('nock');
const request = require('supertest');

describe('unit/service/rest-service', () => {
  let RestService;

  beforeEach(() => {
    RestService = proxyquire('../../../src/service/rest-service', {});
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe(`callFunction`, () => {
    it(`should call function successfully if no opts specified`, done => {
      const functionsMock = {
        getSupervisorHost: () => {
          return 'https://faked.com';
        },
        getFunction: () => {
          return Promise.resolve({});
        }
      };
      const service = new RestService(functionsMock, {});

      nock('https://faked.com')
        .post('/fake-project/us-central1/test-function')
        .reply(200);

      request(service.server)
        .post('/v1/projects/fake-project/locations/us-central1/functions/test-function:call')
        .expect(200, done);
    });

    it(`should fill in correct default resource and eventType`, done => {
      const functionsMock = {
        getSupervisorHost: () => {
          return 'https://faked.com';
        },
        getFunction: () => {
          return Promise.resolve({
            eventTrigger: {
              eventType: 'fake.type',
              resource: 'fake.resource'
            }
          });
        }
      };
      const service = new RestService(functionsMock, {});

      nock('https://faked.com')
        .post('/fake-project/us-central1/test-function', {
          resource: 'fake.resource',
          eventType: 'fake.type'
        })
        .reply(200);

      request(service.server)
        .post('/v1/projects/fake-project/locations/us-central1/functions/test-function:call')
        .expect(200, done);
    });

    it(`should default auth to {admin:true} for Firebase database functions`, done => {
      const functionsMock = {
        getSupervisorHost: () => {
          return 'https://faked.com';
        },
        getFunction: () => {
          return Promise.resolve({
            eventTrigger: {
              eventType: 'firebase.database',
              resource: 'fake.resource'
            }
          });
        }
      };
      const service = new RestService(functionsMock, {});

      nock('https://faked.com')
        .post('/fake-project/us-central1/test-function', {
          auth: {admin: true}
        })
        .reply(200);

      request(service.server)
        .post('/v1/projects/fake-project/locations/us-central1/functions/test-function:call')
        .expect(200, done);
    });

    it(`should allow auth, eventType, and resource to be custom-defined`, done => {
      const functionsMock = {
        getSupervisorHost: () => {
          return 'https://faked.com';
        },
        getFunction: () => {
          return Promise.resolve({
            eventTrigger: {
              eventType: 'firebase.database', // only firebase database uses auth, and allows it to be defined
              resource: 'fake.resource'
            }
          });
        }
      };
      const service = new RestService(functionsMock, {});

      nock('https://faked.com')
        .post('/fake-project/us-central1/test-function', {
          auth: {admin: false},
          resource: 'custom.resource'
        })
        .reply(200);

      request(service.server)
        .post('/v1/projects/fake-project/locations/us-central1/functions/test-function:call')
        .send({
          auth: {admin: false},
          resource: 'custom.resource'
        })
        .expect(200, done);
    });
  });
});
