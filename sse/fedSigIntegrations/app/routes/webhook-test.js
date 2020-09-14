const axios = require('axios').default;
const { JSONPath } = require("jsonpath-plus");

const headerOptions = {
    headers: {
        "Content-Type": "application/json; charset=utf-8"
    }
};

module.exports = function (app) {
	'use strict';

	app.post('/v1/webhook-test', function (req, res) {

		try {
			res.locals.logger.info("POST /v1/webhook-test");

			res.locals.logger.debug(JSON.stringify(req.body));

			const endpoint = 'https://demo4258009.mockable.io/webhookTest';

			axios.post(endpoint, JSON.stringify(req.body), headerOptions)
				.then((axiosRes) => {
					res.locals.logger.debug(axiosRes.status);
					res.locals.logger.debug(axiosRes.statusText);
					res.locals.logger.debug(JSON.stringify(axiosRes.data));
					
					res.statusCode = 200;
					res.json(axiosRes.data);

				}).catch((axiosErr) => {
					res.locals.logger.error(axiosErr);
					// console.log(`${axiosErr.response.status } ${axiosErr.response.statusText }`);
					res.send("Error");
					res.statusCode = 400;
				});
			
		
		} catch (e) {
			res.locals.logger.error("Error: " + e.message);
			res.end();
			return;
		}
	});

	app.get('/v1/webhook-test', function (req, res) {
		res.locals.logger.info("GET /v1/webhook-test");
		res.locals.logger.debug(JSON.stringify(req.body));
		res.statusCode = 200;
		res.message = 'OK';
	});

};
