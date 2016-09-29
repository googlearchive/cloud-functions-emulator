/*!
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var colors = require('colors');
var Table = require('cli-table2');
var controller = require('./controller.js')
var fs = require('fs');
var config = require('../config.js');
var APP_NAME = 'Cloud Functions Simulator ';


var self = {

  writer: {
    log: function() {
      console.log.apply(console, arguments);
    },
    error: function() {
      console.error.apply(console, arguments);
    },
    write: function() {
      console._stdout.write.apply(console._stdout, arguments);
    }
  },

  start: function(options) {
    var projectId;
    if (options && options.projectId) {
      projectId = options.projectId;
    }

    var debug = (options && options.debug) || false;

    self.writer.log('Starting ' + APP_NAME + 'on port ' + config.port +
      '...');

    controller.start(projectId, debug, function(err, status) {
      if (err) {
        self.writer.error(err);
        return;
      }

      if (status === controller.ALREADY_RUNNING) {
        self.writer.log(APP_NAME + 'already running'.cyan);
      } else {
        self.writer.write(APP_NAME);
        self.writer.write('STARTED\n'.green);
      }

      self.list();
    });
  },

  list: function() {
    self._doIfRunning(function() {
      controller.list(function(err, body) {
        if (err) {
          self.writer.error(err);
          return;
        }

        var table = new Table({
          head: ['Name'.cyan, 'Type'.cyan, 'Path'.cyan],
          colWidths: [15, 12, 52]
        });

        var type, path;
        var count = 0;

        for (var func in body) {

          type = body[func].type;
          path = body[func].path;

          if (self._pathExists(path)) {
            table.push([
              func.white,
              type.white,
              path.white
            ]);
          } else {
            table.push([
              func.white,
              type.white,
              path.red
            ]);
          }

          count++;
        }

        if (count === 0) {
          table.push([{
            colSpan: 3,
            content: 'No functions deployed ¯\\_(ツ)_/¯.  Run \'functions deploy\' to deploy a function'
              .gray
          }]);
        }

        var output = table.toString();

        self.writer.log(output);
      });
    });
  },

  stop: function(options, callback) {
    controller.stop(function(err) {
      if (err) {
        self.writer.error(err);
        if (callback) {
          callback(err);
        }
        return;
      }

      self.writer.write(APP_NAME);
      self.writer.write('STOPPED\n'.red);
    });
  },

  kill: function() {
    controller.kill(function(err, result) {
      if (err) {
        self.writer.error(err);
        return;
      }

      self.writer.write(APP_NAME);

      if (result === controller.KILLED) {
        self.writer.write('KILLED\n'.red);
      } else {
        self.writer.write('NOT RUNNING\n'.cyan);
      }
    });
  },

  restart: function() {
    controller.restart(function(err, status) {
      if (err) {
        self.writer.error(err);
        return;
      }
      if (status === controller.STOPPED) {
        self.start();
      } else {
        self.writer.write(APP_NAME);
        self.writer.write('RESTARTED\n'.green);
        self.list();
      }
    });
  },

  clear: function() {
    self._doIfRunning(function() {
      controller.clear(function(err) {
        if (err) {
          self.writer.error(err);
          self.writer.error('Clear command aborted'.red);
          return;
        }
        self.writer.write(APP_NAME);
        self.writer.write('CLEARED\n'.green);
        self.list();
      });
    });
  },

  prune: function() {
    self._doIfRunning(function() {
      controller.prune(function(err, body) {
        if (err) {
          self.writer.error(err);
          self.writer.error('Prune command aborted'.red);
          return;
        }
        self.writer.write(APP_NAME);
        self.writer.write(('PRUNED ' + body + ' functions\n').green);
        self.list();
      });
    });
  },

  status: function() {
    controller.status(function(err, status) {
      if (err) {
        self.writer.error(err);
        return;
      }

      self.writer.write(APP_NAME + "is ");

      if (status === controller.RUNNING) {
        self.writer.write("RUNNING".green);
        self.writer.write(" on port " + config.port + "\n");
      } else {
        self.writer.write("STOPPED\n".red);
      }
    });
  },

  getLogs: function(options) {
    var limit = 20;
    if (options.limit) {
      limit = parseInt(options.limit);
    }
    controller.getLogs(self.writer, limit);
  },

  deploy: function(modulePath, entryPoint, options) {
    self._doIfRunning(function() {
      var type = (options.triggerHttp === true) ? 'H' : 'B';
      controller.deploy(modulePath, entryPoint, type, function(err,
        body) {
        if (err) {
          self.writer.error(err);
          self.writer.error('Deployment aborted'.red);
          return;
        }
        self.writer.log('Function ' + entryPoint + ' deployed'.green);
        printDescribe(body);
      });
    });
  },

  undeploy: function(name) {
    self._doIfRunning(function() {
      controller.undeploy(name, function(err, body) {
        if (err) {
          self.writer.error(err);
          self.writer.error('Delete aborted'.red);
          return;
        }
        self.writer.log('Function ' + name + ' removed'.green);
        self.list();
      });
    });
  },

  describe: function(name) {
    self._doIfRunning(function() {
      controller.describe(name, function(err, body) {
        if (err) {
          self.writer.error(err);
          return;
        }
        printDescribe(body);
      });
    });
  },

  call: function(name, options) {
    self._doIfRunning(function() {
      controller.call(name, options.data, function(err, body, response) {
        if (err) {
          self.writer.error(err);
          return;
        }
        self.writer.write("Function completed in:  ");
        self.writer.write((response.headers['x-response-time'] +
            '\n')
          .green);

        self.writer.log(body);

        controller.status(function(err, status) {
          if (err) {
            self.writer.error(
              APP_NAME +
              'exited unexpectedly.  Check the simulator.log for more details'
              .red);
            return;
          }
        });
      });
    });
  },

  _doIfRunning: function(fn) {
    controller.status(function(err, status) {
      if (err) {
        self.writer.error(err);
        return;
      }

      if (status === controller.RUNNING) {
        fn();
      } else {
        self.writer.write((APP_NAME +
          'is not running.  Use \'functions start\' to start the simulator\n'
        ).cyan);
      }
    });
  },

  _pathExists: function(p) {
    try {
      fs.statSync(p);
      return true;
    } catch (e) {
      return false;
    }
  }
};

module.exports = self;

var printDescribe = function printDescribe(body) {
  body = JSON.parse(body);

  var table = new Table({
    head: ['Property'.cyan, 'Value'.cyan],
    colWidths: [10, 70]
  });

  table.push(['Name', body.name.white]);
  table.push(['Type', body.type.white]);
  table.push(['Path', body.path.white]);

  if (body.url) {
    table.push(['Url', body.url.white]);
  }
  self.writer.log(table.toString());
}