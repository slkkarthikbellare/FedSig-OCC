

module.exports = function (app) {
	'use strict';

	app.post('/v1/validate-prices', function (req, res) {

		try {
			res.locals.logger.info("POST /v1/validate-prices");


			res.type('application/json'); // set content-type

			res.locals.logger.debug("/v1/validate-prices: for " + JSON.stringify(req.body.orderId));
			var data = {
				"ResponseCode": "5001"
			  }

			res.statusCode = 200;
			res.json(data);
		} catch (e) {

			res.locals.logger.error("Error: " + e.message);
			res.end();
			return;
		}
	});


};
