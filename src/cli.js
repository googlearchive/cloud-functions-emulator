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

var Table = require('cli-table2');
require('colors');
var controller = require('./controller.js');
var fs = require('fs');
var config = require('../config.js');
var APP_NAME = 'Google Cloud Functions Emulator ';

var writer = {
  log: function () {
    console.log.apply(console, arguments);
  },
  error: function () {
    console.error.apply(console, arguments);
  },
  write: function () {
    console._stdout.write.apply(console._stdout, arguments);
  }
};

function printDescribe (body) {
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
  writer.log(table.toString());
}

function pathExists (p) {
  try {
    fs.statSync(p);
    return true;
  } catch (e) {
    return false;
  }
}

function doIfRunning (fn) {
  controller.status(function (err, status) {
    if (err) {
      writer.error(err);
      return;
    }

    if (status === controller.RUNNING) {
      fn();
    } else {
      writer.write((APP_NAME +
      "is not running.  Use 'functions start' to start the emulator\n"
        ).cyan);
    }
  });
}

function start (options) {
  var projectId;
  if (options && options.projectId) {
    projectId = options.projectId;
  }

  var debug = (options && options.debug) || false;
  var inspect = (options && options.inspect) || false;

  writer.log('Starting ' + APP_NAME + 'on port ' + config.port + '...');

  controller.start(projectId, debug, inspect, function (err, status) {
    if (err) {
      writer.error(err);
      return;
    }

    if (status === controller.ALREADY_RUNNING) {
      writer.log(APP_NAME + 'already running'.cyan);
    } else {
      writer.write(APP_NAME);
      writer.write('STARTED\n'.green);
    }

    list();
  });
}

function list () {
  doIfRunning(function () {
    controller.list(function (err, body) {
      if (err) {
        writer.error(err);
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

        if (pathExists(path)) {
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
          content: "No functions deployed ¯\\_(ツ)_/¯.  Run 'functions deploy' to deploy a function"
            .gray
        }]);
      }

      var output = table.toString();

      writer.log(output);
    });
  });
}

function stop (options, callback) {
  doIfRunning(function () {
    controller.stop(function (err) {
      if (err) {
        writer.error(err);
        if (callback) {
          callback(err);
        }
        return;
      }

      writer.write(APP_NAME);
      writer.write('STOPPED\n'.red);
    });
  });
}

function kill () {
  controller.kill(function (err, result) {
    if (err) {
      writer.error(err);
      return;
    }

    writer.write(APP_NAME);

    if (result === controller.KILLED) {
      writer.write('KILLED\n'.red);
    } else {
      writer.write('NOT RUNNING\n'.cyan);
    }
  });
}

function restart () {
  controller.restart(function (err, status) {
    if (err) {
      writer.error(err);
      return;
    }
    if (status === controller.STOPPED) {
      start();
    } else {
      writer.write(APP_NAME);
      writer.write('RESTARTED\n'.green);
      list();
    }
  });
}

function clear () {
  doIfRunning(function () {
    controller.clear(function (err) {
      if (err) {
        writer.error(err);
        writer.error('Clear command aborted'.red);
        return;
      }
      writer.write(APP_NAME);
      writer.write('CLEARED\n'.green);
      list();
    });
  });
}

function prune () {
  doIfRunning(function () {
    controller.prune(function (err, body) {
      if (err) {
        writer.error(err);
        writer.error('Prune command aborted'.red);
        return;
      }
      writer.write(APP_NAME);
      writer.write(('PRUNED ' + body + ' functions\n').green);
      list();
    });
  });
}

function status () {
  controller.status(function (err, status, env) {
    if (err) {
      writer.error(err);
      return;
    }

    writer.write(APP_NAME + 'is ');

    if (status === controller.RUNNING) {
      writer.write('RUNNING'.green);
      writer.write(' on port ' + config.port);

      if (env) {
        if (env.inspect && (env.inspect === 'true' || env.inspect === true)) {
          writer.write(', with ' + 'INSPECT'.yellow + ' enabled on port ' + (config.debugPort || 9229));
        } else if (env.debug && (env.debug === 'true' || env.debug === true)) {
          writer.write(', with ' + 'DEBUG'.yellow + ' enabled on port ' + (config.debugPort || 5858));
        }
      }

      writer.write('\n');
    } else {
      writer.write('STOPPED\n'.red);
    }
  });
}

function getLogs (options) {
  var limit = 20;
  if (options && options.limit) {
    limit = parseInt(options.limit);
  }
  controller.getLogs(writer, limit);
}

function deploy (options) {
  doIfRunning(function () {
    var type = (options['trigger-http'] === true) ? 'H' : 'B';
    controller.deploy(options.modulePath, options.functionName, type, function (err,
      body) {
      if (err) {
        writer.error(err);
        writer.error('Deployment aborted'.red);
        return;
      }
      writer.log('Function ' + options.entryPoint + ' deployed'.green);
      printDescribe(body);
    });
  });
}

function undeploy (options) {
  doIfRunning(function () {
    controller.undeploy(options.functionName, function (err, body) {
      if (err) {
        writer.error(err);
        writer.error('Delete aborted'.red);
        return;
      }
      writer.log('Function ' + options.functionName + ' removed'.green);
      list();
    });
  });
}

function describe (options) {
  doIfRunning(function () {
    controller.describe(options.functionName, function (err, body) {
      if (err) {
        writer.error(err);
        return;
      }
      printDescribe(body);
    });
  });
}

function call (options) {
  doIfRunning(function () {
    controller.call(options.functionName, options.data, function (err, body, response) {
      if (err) {
        writer.error(err);
        return;
      }
      writer.write('Function completed in:  ');
      writer.write((response.headers['x-response-time'] + '\n').green);

      writer.log(body);

      controller.status(function (err, status) {
        if (err) {
          writer.error(
            APP_NAME +
            'exited unexpectedly.  Check the cloud-functions-emulator.log for more details'
              .red);
          return;
        }
      });
    });
  });
}

var cli = require('yargs');
var program = module.exports = {
  call: call,
  clear: clear,
  delete: undeploy,
  deploy: deploy,
  describe: describe,
  getLogs: getLogs,
  kill: kill,
  list: list,
  main: function (args) {
    cli
      .help('h')
      .alias('h', 'help')
      .version()
      .alias('v', 'version')
      .strict()
      .parse(args)
      .argv;
  },
  prune: prune,
  restart: restart,
  start: start,
  status: status,
  stop: stop,
  writer: writer
};

cli
  .demand(1)
  .command('call <functionName>', 'Invokes a function. You must specify either the "data" or the "file" option.', {
    data: {
      alias: 'd',
      description: 'Specify inline the JSON data to send to the function.',
      requiresArg: true,
      type: 'string'
    },
    file: {
      alias: 'f',
      description: 'A path to a JSON file to send to the function.',
      normalize: true,
      requiresArg: true,
      type: 'string'
    }
  }, function (opts) {
    if (opts.data) {
      try {
        opts.data = JSON.parse(opts.data);
      } catch (err) {
        throw new Error('"data" must be a valid JSON string!');
      }
    } else if (opts.file) {
      opts.data = fs.readFileSync(opts.file, 'utf8');
    } else {
      throw new Error('You must specify a "data" or "file" option!');
    }
    program.call(opts);
  })
  .command('clear', 'Resets the emulator to its default state and clears and deployed functions.', {}, program.clear)
  .command('delete <functionName>', 'Undeploys a previously deployed function (does NOT delete the function source code).', {}, program.delete)
  .command('deploy <modulePath> <functionName>', 'Deploys a function with the given module path and function name (entry point).', {
    'trigger-http': {
      alias: 't',
      description: 'Deploys the function as an HTTP function.',
      requiresArg: false
    }
  }, program.deploy)
  .command('describe <functionName>', 'Describes the details of a single deployed function.', {}, program.describe)
  .command('logs <command>', 'Manages emulator logs access.', function (yargs) {
    return yargs
      .command('read', 'Show logs produced by functions.', {
        limit: {
          alias: 'l',
          default: 20,
          description: 'Number of log entries to be fetched.',
          type: 'number',
          requiresArg: true
        }
      }, program.getLogs);
  })
  .command('kill', 'Force kills the emulator process if it stops responding.', {}, program.kill)
  .command('list', 'Lists deployed functions.', {}, program.list)
  .command('prune', 'Removes any functions known to the emulator but which no longer exist in their corresponding module.', {}, program.prune)
  .command('restart', 'Restarts the emulator.', {}, program.restart)
  .command('start', 'Starts the emulator.', {
    debug: {
      alias: 'd',
      default: false,
      description: 'Start the emulator in debug mode.',
      type: 'boolean',
      requiresArg: false
    },
    inspect: {
      alias: 'i',
      default: false,
      description: 'Experimental! (Node 7+ only).  Pass the --inspect flag to Node',
      type: 'boolean',
      requiresArg: false
    },
    projectId: {
      alias: 'p',
      default: process.env.GCLOUD_PROJECT,
      description: 'Your Google Cloud Platform project ID.',
      type: 'string',
      requiresArg: true
    }
  }, program.start)
  .command('status', 'Reports the current status of the emulator.', {}, program.status)
  .command('stop', 'Stops the emulator gracefully.', {}, program.stop)
  .example('$0 deploy ~/myModule helloWorld --trigger-http', 'Deploy helloWorld as an HTTP function from the module located in ~/myModule')
  .example('$0 call helloWorld', 'Invoke the helloWorld function with no data argument')
  .example('$0 call helloWorld --data \'{"foo": "bar"}\'', 'Invoke the helloWorld function with a JSON document argument')
  .example('$0 call helloWorld --file ~/myData/datafile.json', 'Invoke the helloWorld function with a file argument')
  .example('$0 logs read --limit 10', 'Display the most recent 10 lines from the logs')
  .wrap(140);
