var conf = {

  // The local TCP port on which the simulator will run
  port: 8008,

  // Set to true to see debug logs for the simulator itself
  verbose: true,

  // Your Cloud Platform project ID
  projectId: null,

  // The timeout in milliseconds to wait for the simulator to start
  timeout: 3000,

  // The name of the file into which function logs will be writter
  logFileName: 'simulator.log',

  // The (relative) path to the logs directory
  logFilePath: 'logs'

};

module.exports = conf;