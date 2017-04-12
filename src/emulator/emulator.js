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

const Model = require('../model');
const Service = require('../service');
const Supervisor = require('../supervisor');

class Emulator {
  constructor (opts) {
    this.config = opts;

    const functions = Model.functions(opts);
    this.supervisor = Supervisor.supervisor(functions, {
      host: opts.supervisorHost,
      port: opts.supervisorPort,
      region: opts.region,
      useMocks: opts.useMocks
    });
    this.restService = Service.restService(functions, {
      host: opts.restHost,
      port: opts.restPort
    });
    this.grpcService = Service.grpcService(functions, {
      host: opts.grpcHost,
      port: opts.grpcPort
    });
  }

  start () {
    const makeHandler = (name) => {
      return (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`${name} (${this.config[name]}) is already in use`);
        } else {
          console.error(err);
        }
      };
    };

    this.supervisor
      .start()
      .on('error', makeHandler('supervisorPort'));
    this.restService
      .start()
      .on('error', makeHandler('restPort'));
    this.grpcService.start();

    process.on('exit', () => {
      this.stop();
    });
  }

  stop () {
    this.supervisor.stop();
    this.restService.stop();
    this.grpcService.stop();
  }
}

module.exports = Emulator;
