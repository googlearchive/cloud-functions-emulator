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

const bodyParser = require('body-parser');
const Configstore = require('configstore');
const express = require('express');
const got = require('got');
const http = require('http');
const path = require('path');
const responseTime = require('response-time');
const url = require('url');

const errors = require('../utils/errors');
const Model = require('../model');
const pkg = require('../../package.json');
const Service = require('./service');

const { CloudFunction, Operation } = Model;

// TODO: Support more than one version.
const API_VERSION = 'v1beta2';
const DISCOVERY_URL = `https://cloudfunctions.googleapis.com/$discovery/rest?version=${API_VERSION}`;

class RestService extends Service {
  constructor (...args) {
    super(...args);

    this.type = 'REST';
    this._discovery = new Configstore(path.join(pkg.name, '/.discovery'));

    // Standard ExpressJS app. Where possible this should mimic the *actual*
    // setup of Cloud Functions regarding the use of body parsers etc.
    this.server = express();
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

    // responseTime will allow us to track the execution time of a function
    this.server.use(responseTime());

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
        next({ code: errors.status.NOT_FOUND });
      });

    // Define error handlers last
    this.server.use((err, req, res, next) => {
      // Check for a serialized error and deserialize it if necessary
      if (!(err instanceof Error) && err.name && err.stack && err.message) {
        const _err = err;
        err = new Error(_err.message);
        err.stack = _err.stack;
      }

      // TODO: Extract most of this error handling/formatting into a utility
      if (err instanceof errors.InvalidArgumentError) {
        res.status(400).json({
          error: {
            code: 400,
            status: 'INVALID_ARGUMENT',
            message: err.message || http.STATUS_CODES['400'],
            errors: [err.message || http.STATUS_CODES['400']]
          }
        }).end();
      } else if (err instanceof errors.ConflictError) {
        res.status(409).json({
          error: {
            code: 409,
            status: 'ALREADY_EXISTS',
            message: err.message || http.STATUS_CODES['409'],
            errors: [err.message || http.STATUS_CODES['409']]
          }
        }).end();
      } else if (err instanceof errors.NotFoundError) {
        res.status(404).json({
          error: {
            code: 404,
            status: 'NOT_FOUND',
            message: err.message || http.STATUS_CODES['404'],
            errors: [err.message || http.STATUS_CODES['404']]
          }
        }).end();
      } else if (err instanceof errors.InternalError) {
        res.status(500).json({
          error: {
            code: 500,
            status: 'INTERNAL',
            message: err.message || http.STATUS_CODES['500'],
            errors: [err.message || http.STATUS_CODES['500']]
          }
        }).end();
      } else if (err instanceof Error) {
        res.status(500).send(err.stack).end();
      } else if (err) {
        res.status(500).end();
      } else {
        res.status(404).end();
      }
    });
  }

  /**
   *
   */
  callFunction (req, res) {
    const name = CloudFunction.formatName(req.params.project, req.params.location, req.params.name);
    return this.functions.getFunction(name)
      .then((cloudfunction) => this.supervisor.invoke(cloudfunction, req.body.data, {}, this.config))
      .then((response) => {
        res.status(200).send(response).end();
      });
  }

  /**
   *
   */
  createFunction (req, res) {
    const location = CloudFunction.formatLocation(req.params.project, req.params.location);
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
    return this.functions.deleteFunction(name)
      .then((operation) => {
        res.status(200).json(operation).end();
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
        if (typeof doc === 'object' && Object.keys(doc).length > 0) {
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
              return Promise.reject({
                code: errors.status.NOT_FOUND,
                message: 'Discovery document not found for API service.'
              });
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
    return this.functions.getFunction(name)
      .then((cloudfunction) => {
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
    return this.functions.getOperation(name)
      .then((operation) => {
        if (!operation) {
          res.status(404).end();
          return;
        }

        res.status(200).json(operation).end();
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
    return this.functions.listFunctions(location, {
      pageSize: req.query.pageSize,
      pageToken: req.query.pageToken
    })
      .then((response) => {
        res.status(200).json(response).end();
      });
  }

  start () {
    super.start();

    this._server = this.server.listen(this.config.port, this.config.host, () => {
      console.debug(`${this.type} service listening at ${this._server.address().address}:${this._server.address().port}.`);
    });
  }

  stop () {
    this._server.close(() => super.stop());
  }
}

module.exports = RestService;
