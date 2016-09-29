#! /usr/bin/env node

var program = require('commander');
var cli = require('./app/cli.js');

program
  .version('0.0.1');
// .description('Google Cloud Functions Simulator')

program
  .command('start')
  .description('Starts the simulator')
  .action(cli.start)
  .option('--project-id <id>',
    'Your Google Cloud Platform project ID. If not provided, the process.env.GCLOUD_PROJECT environment variable will not be set'
  )
  .option('--debug',
    'If true, start the simulator in debug mode'
  );;

program
  .command('stop')
  .description('Stops the simulator gracefully')
  .action(cli.stop);

program
  .command('kill')
  .description('Force kills the simulator process if it stops responding')
  .action(cli.kill);

program
  .command('restart')
  .description('Restarts the simulator')
  .action(cli.restart);

program
  .command('clear')
  .description(
    'Resets the simulator to its default state and clears any deploy functions'
  )
  .action(cli.clear);

program
  .command('prune')
  .description(
    'Removes any functions known to the simulator but which no longer exist in their corresponding module'
  )
  .action(cli.prune);

program
  .command('status')
  .description('Returns the status of the simulator')
  .action(cli.status);

program
  .command('deploy <module> <function>')
  .description(
    'Deploys a function with the given module path and entry point'
  )
  .action(cli.deploy)
  .option('--trigger-http', 'Deploys this function as an HTTP function');

program
  .command('delete <function>')
  .description(
    'Undeploys a previously deployed function (does NOT delete the function source code)'
  )
  .action(cli.undeploy);

program
  .command('list')
  .description('Lists deployed functions')
  .action(cli.list);

program
  .command('get-logs')
  .description('Displays the logs for the simulator')
  .action(cli.getLogs)
  .option('--limit <limit>',
    'Number of log entries to be fetched. Default is 20');

program
  .command('describe <function>')
  .description('Describes the details of a single deployed function')
  .action(cli.describe);

program
  .command('call <function>')
  .description('Invokes a function')
  .action(cli.call)
  .option('--data <json>',
    'The data to send to the function, expressed as a JSON document');


program.parse(process.argv);

// console.log(program);
if (program.args.length < 1) {
  program.help();
}