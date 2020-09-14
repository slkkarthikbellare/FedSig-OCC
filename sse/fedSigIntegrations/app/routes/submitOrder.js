'use strict';
const dateFormat = require("dateformat");

const { jdeSubmitOrder } = require("../orders/jdeSubmitOrder");


module.exports = function (app) {
	'use strict';

	app.post('/v1/submitOrder', async function (req, res) {

		try {
			res.locals.logger.info("POST /v1/submitOrder");

			let payload = await jdeSubmitOrder(req.body, res.locals.logger);
			
			console.log("final payload: " + payload.success);
			if(payload.success === true) {
				console.log("success");
				res.statusCode = 200;
				res.json(payload);
			} else {
				console.log("fail");
				res.statusCode = 400;
				res.json(payload);
			}
			//res.locals.logger.debug(JSON.stringify(req.body));
			//console.log("final payload: " + JSON.stringify(payload);
			//const payload = {};
			
			

		} catch (e) {
			res.locals.logger.error("Error: " + e.message);
			res.end();
			return;
		}
	});


};
