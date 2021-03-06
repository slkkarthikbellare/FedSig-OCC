'use strict';
// externalPricing.js
const axios = require('axios');
const config = require("../config");
const endPoints = config.get("endPoints");
const nconf = require('nconf');

const headerOptions = {
	headers: {
		"Content-Type": "application/json; charset=utf-8"
	}
};

module.exports = function (app) {
	'use strict';

	app.post('/v1/getExternalPrice2', async function (req, res) {

	var sendMockResponse = process.env.SEND_MOCK_EXTERNAL_PRICE;
	res.type('application/json');
	res.locals.logger.info("getExternalPrice2:" + JSON.stringify(req.body.Pricing));
	
	var pricingRequest = req.body;
	if (sendMockResponse && sendMockResponse === true) {
		res.locals.logger.info("sendMockResponse:" + sendMockResponse);
		var items = [];
		if (pricingRequest) {
			for (var i = 0; i < pricingRequest.length; i++) {
				var item = {};
				item.JDEItemNumber = pricingRequest[i].JDEItemNumber;
				item.UnitPrice = 35;
				item.ListPrice = 50;
				items.push(item);
			}
		}
		var responseData = {};
		responseData.Items = items;
		res.locals.logger.info("Mock Response :" + JSON.stringify(responseData));
		res.json(responseData);
		res.statusCode = 200;
		res.message = 'OK';
	} else {
		var url = endPoints.EXTERNAL_PRICE_URL;
		res.locals.logger.debug("Sending Request to:" + url);
		
		//commented out the proxy configuration to see if it fixes the error in the browser console log that says
		//ETAG parse error:  SyntaxError: Unexpected token þ in JSON at position 1
		/*
		const proxy = process.env.http_proxy || nconf.get('general:proxy-server');
		const agent = proxy ? new HttpsProxyAgent(proxy) : null;
		const pricingApi = agent ? axios.create({ httpsAgent: agent }) : axios;
		*/
		await axios.post(url, pricingRequest, headerOptions)
			.then((response) => {
				res.locals.logger.info("getExternalPrice Response:" + response.status + ":DATA:" + JSON.stringify(response.data));
				res.json(response.data);
				res.statusCode = 200;
				res.message = 'OK';
			}).catch((axiosErr) => {
				let errorMessage = "Error Calling external pricing";
				let jsonMessage = {};
				if (axiosErr.response) {
					// The request was made and the server responded with a status code
					// that falls out of the range of 2xx
					try {
						res.locals.logger.warning("Error calling getExternalPrice from castiron - responseCode: " + JSON.stringify(axiosErr.response.status) + " - " + JSON.stringify(axiosErr.response.data));
					} catch (e) {
						res.locals.logger.error("Error trying to stingify response on: ");
						res.locals.logger.error(axiosErr.response.status);
						res.locals.logger.error(axiosErr.response.data);
						res.locals.logger.error(e);
					}
					res.json(axiosErr.response.data);
				} else if (axiosErr.request) {
					// The request was made but no response was received
					// `error.request` is an instance of XMLHttpRequest in the browser and an instance of
					// http.ClientRequest in node.js
					res.locals.logger.error(JSON.stringify(axiosErr.request));
					res.json(axiosErr.request);
				} else {
					// Something happened in setting up the request that triggered an Error
					res.locals.logger.error(axiosErr.message);
					res.send("Error Calling external pricing: " + axiosErr.message);
				}
				//res.locals.logger.debug("error config: " + JSON.stringify(axiosErr.config));

				//res.send("Error");
				res.statusCode = 400;
			});
	}
	});


};
