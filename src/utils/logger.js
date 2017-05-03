'use strict';

var winston = require('winston');

var logger = new winston.Logger();
logger.exitOnError = false;
// Transports get initialized in emulator/main.js

module.exports = logger;
