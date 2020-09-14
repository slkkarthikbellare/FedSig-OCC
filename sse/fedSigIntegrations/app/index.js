'use strict';
// index.js

var config = require('./config');

var express = require('express');
var bodyParser = require('body-parser');
var crypto = require('crypto');
var os = require('os');
const { keys } = require('./constants');
const { registry } = require('gulp');

// Export Express 4 style sup-application in order to be embedded in OCCS server-side extension architecture
var app = module.exports = new express.Router();
//var app = module.exports = express();

app.use(bodyParser.json({
	/*
	From http://docs.oracle.com/cd/E78936_01/Cloud.16-5/ExtendingCC/html/s0304securewebhooks01.html
	Webhook events are signed so that the system receiving the event can verify their authenticity. 
	Webhook POST requests include an HMAC SHA1 signature in the X-Oracle-CC-WebHook-Signature header. 
	This signature is calculated using the secret key to generate a hash of the raw UTF-8 bytes of the body of the post. 
	A base64 encoding is then used to turn the hash into a string. 
	*/
    verify: function(req, res, buf, encoding) {
		//var buffer = new Buffer("username:password");
		//var toBase64 = buffer.toString('base64');
		//logger.info("Authorization: Basic " + toBase64);
	
		if (req.headers['x-oracle-cc-webhook-signature'] !== undefined) {
			//Read secret key from config 

			if (config.get("keys:" + req.url)){
				
				var secret_key = config.get('keys:'+req.url);
				
				// Secret key is base64 encoded and must be decoded into bytes; BUG 24619421::Documentation for HMAC SHA1 key from the raw key bytes 
				var decoded_secret_key = Buffer.from(secret_key, 'base64'); 

				var calculated_signature = crypto.createHmac('sha1', decoded_secret_key)
					.update(buf, encoding)
					.digest('base64');

					res.locals.logger.info("x-oracle-cc-webhook-signature: " + req.headers['x-oracle-cc-webhook-signature'] + ", calculated_signature: " + calculated_signature );
				
				if (calculated_signature != req.headers['x-oracle-cc-webhook-signature']) {
					res.locals.logger.error('Invalid signature. Access denied');
					throw new Error('Invalid signature. Access denied');
				}
			}
		}  else {
			res.locals.logger.warning('No secret key provided for request: ' + req.url);
			if(!process.env.DISABLE_AUTH) {
			//	throw new Error('Signature not included. Access denied. Set local env variable DISABLE_AUTH to true to bypass for local development.');
			}
		}
		/*
		res.locals.logger.info("Headers: " + JSON.stringify(req.headers));
		
		//info: Authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQ=
		if (req.headers['authorization'] !== undefined) {
							
			// Get the "Authorization" header.
			var auth = req.headers['authorization'];

			// Get credentials
			var credentials = new Buffer(auth.split(" ").pop(), "base64").toString("ascii").split(":");
			res.locals.logger.debug("name="+credentials[0]+";pwd="+credentials[1]);
			if (credentials[0] === "username" && credentials[1] === "password") {
				// The username and password are correct, so the user is authorized.
				res.locals.logger.info("Access Granted!");
			} else {
				// Username or password incorrect.
				throw new Error('Invalid credentials. Access denied');
			}
		}	*/		
	}
}));

try {
	// Load all routes
	require('./routes')(app);
} catch (e) {
	console.log(e.message);
}


//app.listen(3000, function () {
//  logger.info('Listening on port 3000...');
//});
