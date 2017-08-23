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

const logger = require('winston');
const Model = require('../model');
const Service = require('../service');
const Supervisor = require('../supervisor');

class Emulator {
  constructor (opts = {}) {
    this.config = opts;

    const functions = Model.functions(opts);
    this.supervisor = Supervisor.supervisor(functions, {
      bindHost: opts.bindHost,
      host: opts.host,
      port: opts.supervisorPort,
      region: opts.region,
      useMocks: opts.useMocks,
      idlePruneInterval: opts.idlePruneInterval,
      maxIdle: opts.maxIdle,
      watch: opts.watch,
      watchIgnore: opts.watchIgnore
    });
    this.restService = Service.restService(functions, {
      bindHost: opts.bindHost,
      host: opts.host,
      port: opts.restPort
    });
    this.grpcService = Service.grpcService(functions, {
      bindHost: opts.bindHost,
      host: opts.host,
      port: opts.grpcPort
    });
  }

  start () {
    logger.debug('Emulator#start');
    const makeHandler = (name) => {
      return (err) => {
        if (err.code === 'EADDRINUSE') {
          logger.error(`${name} (${this.config[name]}) is already in use`);
        } else {
          logger.error(err);
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

    process.on('exit', (code) => {
      logger.debug(`Emulator exiting with code: ${code}`);
      this.stop();
    });
  }

  stop () {
    logger.debug('Emulator#stop');
    this.supervisor.stop();
    this.restService.stop();
    this.grpcService.stop();
  }
}

module.exports = Emulator;
