'use strict';
// stand-alone index.js
require('dotenv').config();
const express = require('express');

var winston = require('winston');
const bodyParser = require('body-parser');
//var app = require('./app/index');
const app = express();

// Read port from command line, config, or default
var port = (process.argv[2] || (process.env.npm_package_config_port || 3000));

//Initialize new logger (example transport mods)
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
                winston.format.colorize(),
                winston.format.simple()
            )
        })

    ]
});

app.use(bodyParser.json());
//app.enable('etag');
//app.set('etag', 'strong');
app.use(function(req, res, next) {
    'use strict';
    if (!res.locals) {
        res.locals = {}
    }

    res.locals.logger = logger;
    //res.locals.logger.info("Set logger");
    next();
});

//Set sub-app path to duplicate how setup on server
app.use("/ccstorex/custom", require("./app/index"));

app.listen(port, function() {
    logger.info('Listening on port ' + port + '...');
});