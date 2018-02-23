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

const bodyParser = require('body-parser');
const Configstore = require('configstore');
const express = require('express');
const fs = require('fs');
const got = require('got');
const logger = require('winston');
const path = require('path');
const url = require('url');

const uuid = require('uuid');

const Errors = require('../utils/errors');
const Model = require('../model');
const pkg = require('../../package.json');
const Service = require('./service');

const { CloudFunction, Operation } = Model;

// TODO: Support more than one version.
const API_VERSION = 'v1';
const DISCOVERY_URL = `https://cloudfunctions.googleapis.com/$discovery/rest?version=${API_VERSION}`;

class RestService extends Service {
  constructor (...args) {
    super(...args);

    this.type = 'REST';
    this._discovery = new Configstore(path.join(pkg.name, '/.discovery'));

    // Standard ExpressJS app. Where possible this should mimic the *actual*
    // setup of Cloud Functions regarding the use of body parsers etc.
    this.server = express();
    // Upload must be handled before the body gets processed
    this.server.put(
      `/upload`,
      (req, res, next) => this.handleUpload(req, res).catch(next)
    );
    this.server.use(bodyParser.json());
    this.server.use(bodyParser.raw());
    this.server.use(bodyParser.text());
    this.server.use(bodyParser.urlencoded({
      extended: true
    }));

    // Never cache
    this.server.use((req, res, next) => {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', 0);
      next();
    });

    this.server
      .get(
        `/([$])discovery/rest`,
        (req, res, next) => this.getDiscoveryDoc(req, res).catch(next)
      )
      .delete(
        `/${API_VERSION}/projects/:project/locations/:location/functions/:name`,
        (req, res, next) => this.deleteFunction(req, res).catch(next)
      )
      .get(
        `/${API_VERSION}/projects/:project/locations/:location/functions/:name`,
        (req, res, next) => this.getFunction(req, res).catch(next)
      )
      .get(
        `/${API_VERSION}/projects/:project/locations/:location/functions`,
        (req, res, next) => this.listFunctions(req, res).catch(next)
      )
      .post(
        `/${API_VERSION}/projects/:project/locations/:location/functions::generateUploadUrl`,
        (req, res, next) => this.generateUploadUrl(req, res).catch(next)
      )
      .post(
        `/${API_VERSION}/projects/:project/locations/:location/functions/:name::call`,
        (req, res, next) => this.callFunction(req, res).catch(next)
      )
      .post(
        `/${API_VERSION}/projects/:project/locations/:location/functions`,
        (req, res, next) => this.createFunction(req, res).catch(next)
      )
      .get(
        `/${API_VERSION}/operations/:operation`,
        (req, res, next) => this.getOperation(req, res).catch(next)
      )
      .all('*', (req, res, next) => {
        next({ code: Errors.status.NOT_FOUND });
      });

    // Define error handlers last
    this.server.use((err, req, res, next) => Errors.sendRestError(err, res));
  }

  /**
   *
   */
  callFunction (req, res) {
    if (req.headers['user-agent'].includes('google-cloud-sdk') && typeof req.body.data === 'string') {
      try {
        req.body.data = JSON.parse(req.body.data);
      } catch (err) {

      }
    }
    try {
      req.body.auth = JSON.parse(req.body.auth);
    } catch (err) {

    }
    const name = CloudFunction.formatName(req.params.project, req.params.location, req.params.name);
    logger.debug('RestService#callFunction', name);
    const eventId = uuid.v4();
    return this.functions.getFunction(name)
      .then((cloudfunction) => {
        const event = {
          // A unique identifier for this execution
          eventId,
          // The current ISO 8601 timestamp
          timestamp: (new Date()).toISOString(),
          // The event payload
          data: req.body.data
        };

        if (cloudfunction.eventTrigger) {
          event.eventType = cloudfunction.eventTrigger.eventType;
          event.resource = req.body.resource || cloudfunction.eventTrigger.resource;
        }

        if (new RegExp('firebase.database').test(event.eventType)) {
          event.auth = req.body.auth || { admin: true };
        }

        return got.post(`${this.functions.getSupervisorHost()}/${req.params.project}/${req.params.location}/${req.params.name}`, {
          body: JSON.stringify(cloudfunction.httpsTrigger ? event.data : event),
          headers: {
            'Content-Type': 'application/json'
          }
        });
      })
      .then((response) => {
        res
          .status(200)
          .send({
            executionId: eventId,
            result: response.body
          })
          .end();
      }, (err) => {
        res
          .status(200)
          .send({
            executionId: eventId,
            error: err.response ? err.response.body : err.message
          })
          .end();
      });
  }

  /**
   *
   */
  createFunction (req, res) {
    const location = CloudFunction.formatLocation(req.params.project, req.params.location);
    logger.debug('RestService#createFunction', location, req.body);
    return this.functions.createFunction(location, req.body)
      .then((operation) => {
        res.status(200).json(operation).end();
      });
  }

  /**
   * Deletes a function.
   *
   * @param {object} req The request.
   * @param {object} req.params The path parameters.
   * @param {string} req.params.project The project of the function to delete.
   * @param {string} req.params.location The location of the function to delete.
   * @param {string} req.params.name The name of the function to delete.
   * @param {object} res The response.
   */
  deleteFunction (req, res) {
    const name = CloudFunction.formatName(req.params.project, req.params.location, req.params.name);
    logger.debug('RestService#deleteFunction', name);
    return this.functions.deleteFunction(name)
      .then((operation) => {
        res.status(200).json(operation).end();
      });
  }

  /**
   * Generates an upload URL.
   *
   * @param {object} req The request.
   * @param {object} res The response.
   */
  generateUploadUrl (req, res) {
    logger.debug('RestService#generateUploadUrl');
    return new Promise((resolve) => {
      res.send({
        uploadUrl: CloudFunction.generateUploadUrl(this.config)
      }).end();
      resolve();
    });
  }

  /**
   * Gets the Google Cloud Functions API discovery doc.
   *
   * @param {object} req The request.
   * @param {object} res The response.
   */
  getDiscoveryDoc (req, res) {
    return Promise.resolve()
      .then(() => {
        const doc = this._discovery.all;
        if (typeof doc === 'object' && Object.keys(doc).length > 0 && doc.version === API_VERSION) {
          return doc;
        }
        return got(DISCOVERY_URL, {
          query: {
            version: req.query.version
          }
        })
          .then((response) => {
            const doc = JSON.parse(response.body);
            this._discovery.set(doc);
            return doc;
          })
          .catch((err) => {
            if (err && err.statusCode === 404) {
              return Promise.reject(new Errors.NotFoundError('Discovery document not found for API service.'));
            }
            return Promise.reject(err);
          });
      })
      .then((doc) => {
        // TODO: Change the baseUrl and rootUrl
        doc.baseUrl = doc.rootUrl = url.format({
          hostname: this.config.host,
          port: this.config.port,
          protocol: `${req.protocol}:`
        }) + '/';
        doc.canonicalName = 'Cloud Functions Emulator';
        res.status(200).json(doc).end();
      });
  }

  /**
   * Gets a function.
   *
   * @param {object} req The request.
   * @param {object} req.params The path parameters.
   * @param {string} req.params.project The project of the function to get.
   * @param {string} req.params.location The location of the function to get.
   * @param {string} req.params.name The name of the function to get.
   * @param {object} res The response.
   */
  getFunction (req, res) {
    const name = CloudFunction.formatName(req.params.project, req.params.location, req.params.name);
    logger.debug('RestService#getFunction', name);
    return this.functions.getFunction(name)
      .then((cloudfunction) => {
        if (req.get('user-agent') &&
            req.get('user-agent').includes('google-cloud-sdk') &&
            cloudfunction.status === 'DEPLOYING') {
          // For some reason the Cloud SDK doesn't wait for the operation to be
          // done before printing the function to the user, instead it polls for
          // the function. So here pretend the function doesn't exist until it's
          // no longer deploying.
          return Promise.reject(this.functions._getFunctionNotFoundError(name));
        }

        res.status(200).json(cloudfunction).end();
      });
  }

  /**
   * Gets an operation.
   *
   * @param {object} req The request
   * @param {object} req.params The path parameters.
   * @param {string} req.params.operation The name of the operation to retrieve.
   * @param {object} res The response
   */
  getOperation (req, res) {
    const name = Operation.formatName(req.params.operation);
    logger.debug('RestService#getOperation', name);
    return this.functions.getOperation(name)
      .then((operation) => {
        if (!operation) {
          res.status(404).end();
          return;
        }

        res.status(200).json(operation).end();
      });
  }

  handleUpload (req, res) {
    logger.debug('RestService#handleUpload', req.query.archive);
    return new Promise((resolve, reject) => {
      req
        .pipe(fs.createWriteStream(req.query.archive))
        .on('error', reject)
        .on('finish', () => {
          res.end();
          resolve();
        });
    });
  }

  /**
   * Lists functions.
   *
   * @param {object} req The request.
   * @param {object} req.params The path parameters.
   * @param {string} req.params.project The project from which the functions
   *     should be listed.
   * @param {string} req.params.location The location from which the functions
   *     should be listed. If you want to list functions in all locations, use
   *     '-' in place of a location.
   * @param {object} [req.query] The parsed querystring.
   * @param {number} [req.query.pageSize] Maximum number of functions to
   *     return.
   * @param {string} [req.query.pageToken] The value returned by the last
   *     ListFunctionsResponse; indicates that this is a continuation of a prior
   *     ListFunctions call, and that the system should return the next page of
   *     data.
   * @param {object} res The response.
   */
  listFunctions (req, res) {
    const location = CloudFunction.formatLocation(req.params.project, req.params.location);
    logger.debug('RestService#listFunctions', location);
    return this.functions.listFunctions(location, {
      pageSize: req.query.pageSize,
      pageToken: req.query.pageToken
    })
      .then((response) => {
        res.status(200).json(response).end();
      });
  }

  on (...args) {
    this._server.on(...args);
    return this;
  }

  start () {
    super.start();
    logger.debug('RestService#start');

    this._server = this.server.listen(this.config.port, this.config.bindHost, () => {
      logger.debug(`${this.type} service listening at ${this._server.address().address}:${this._server.address().port}.`);
    });

    return this;
  }

  stop () {
    logger.debug('RestService#stop');
    this._server.close(() => super.stop());
    return this;
  }
}

module.exports = RestService;
