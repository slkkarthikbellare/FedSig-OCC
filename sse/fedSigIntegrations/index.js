'use strict';
// stand-alone index.js
require('dotenv').config();

var winston = require('winston');
var express = require('express');

var app = express(); // sub-application

//Initialize new logger (example transport mods)
//var logger = new (winston.Logger)({
//Initialize new logger (example transport mods)
const myFormat = winston.format.printf(({ level, message, label, timestamp }) => {
  return `${timestamp} ${level}: ${message}`;
});

var logger = winston.createLogger({
  levels: {
    error: 0,
    warning: 1,
    info: 2,
    debug: 3
  },
  transports: [
    new winston.transports.Console({
      level: 'debug',
      format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.colorize(),
          winston.format.splat(),
          myFormat
      )
    },)

  ]
});



//Set logger to res.locals in sub-app to duplicate how setup on server
app.use(function(req, res, next) {
  if (!res.locals) {
    res.locals = {};
  }
  //http://expressjs.com/en/api.html#res.locals
  //use res.locals to pass object between main and sub apps
  res.locals.logger = logger;
  next();
});

//Set sub-app path to duplicate how setup on server
app.use ("/ccstorex/custom", require ("./app/index"));

// Read port from command line, config, or default
var port = (process.argv[2] || (process.env.npm_package_config_port || 3000));

app.listen(port, function () {
  logger.info('Listening on port ' + port +'...');
});

