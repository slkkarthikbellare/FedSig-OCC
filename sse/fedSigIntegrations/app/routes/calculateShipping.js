'use strict';

const axios = require('axios').default;
const config = require("../config");
const castiron = config.get("castiron");

module.exports = function (app) {
	'use strict';

	app.post('/v1/calculateShipping', function (req, res) {

		try {
			res.locals.logger.info("POST /v1/calculateShipping");

			res.type('application/json'); // set content-type

			//res.locals.logger.debug("POST /v1/calculateShipping: " + req.body.request);
			res.locals.logger.debug(JSON.stringify(req.body.request.address));
			//Verify address is included in payload
			if (!req.body.request.address ||
				!req.body.request.address.postalCode) {

				res.locals.logger.warn('Address not included.'); 
				//Send bad request error
				res.statusCode = 400;
				return res.send(
					{
						"error": {
							"code": "123",
							"message": "Address not included."
						}
					}
				);
			}

			const headers = {
				"Content-Type": "application/json",
				"Accept": "application/json"
			};

			const headerOptions = {
				headers: {
					"Content-Type": "application/json",
					"Accept": "application/json"
				}
			};

			let orderId = req.body.order.orderId;
			const mock = req.body.mock;

			if (mock) {
				const endpoint = 'https://demo4258009.mockable.io/calculateShipping';

				axios.post(endpoint, JSON.stringify(req.body), headerOptions)
					.then((axiosRes) => {
						res.locals.logger.debug(axiosRes.status);
						res.locals.logger.debug(axiosRes.statusText);
						res.locals.logger.debug(JSON.stringify(axiosRes.data));
						if (axiosRes.data.orderIdReceived) {
							axiosRes.data.orderIdReceived = orderId;
						}
						res.statusCode = 200;
						res.json(axiosRes.data);

					}).catch((axiosErr) => {
						res.locals.logger.error(axiosErr);
						// console.log(`${axiosErr.response.status } ${axiosErr.response.statusText }`);
						res.statusCode = 400;
					});

			} else {

				//Read address information
				res.locals.logger.debug("postalCode=" + req.body.request.address.postalCode + "; Country=" + req.body.request.address.country);
				//console.log("castiron endpoint: " + castiron.host);
				var dateFormat = require('dateformat');
				var shippingCost = 0.00;
				var shippingTax = 2.35;
				var deliveryDays = 2;
				var estimatedDeliveryDate = new Date();

				//Simple shipping calculator
				if (req.body.request.address.country === "US") {
					//If shipping to US address, calculate shipping as 10% of order total
					shippingCost = (req.body.request.orderTotal * .1);
				} else {
					//For all other countries, calculate shipping cost as 25% of order total
					shippingCost = (req.body.request.orderTotal * .25);
					//Add 3 days to delivery days for non-US address
					deliveryDays = +deliveryDays + 3;
				}

				var payload = {
					"orderIdReceived": req.body.order.orderId,
					"shippingMethods": [
						{
							"shippingMethodId": "sm30001",
							"shippingGroupType": "hardgoodShippingGroup",
							"shippingCost": shippingCost,
							"shippingTax": shippingTax,
							"shippingTotal": (shippingTax + shippingCost),
							"internationalDutiesTaxesFees": 0,
							"eligibleForProductWithSurcharges": true,
							"deliveryDays": deliveryDays,
							"estimatedDeliveryDateGuaranteed": false,
							"estimatedDeliveryDate": dateFormat(estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + deliveryDays), "isoDateTime"),
							"displayName": "FedEx Ground",
							"taxcode": null,
							"carrierId": "USPS",
							"currency": "USD"
						},
						{
							"shippingMethodId": "sm30002",
							"shippingGroupType": "hardgoodShippingGroup",
							"shippingCost": shippingCost + 10,
							"shippingTax": shippingTax,
							"shippingTotal": (shippingTax + shippingCost + 10),
							"internationalDutiesTaxesFees": 0,
							"eligibleForProductWithSurcharges": true,
							"deliveryDays": deliveryDays,
							"estimatedDeliveryDateGuaranteed": false,
							"estimatedDeliveryDate": dateFormat(estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + deliveryDays), "isoDateTime"),
							"displayName": "FedEx 2Day",
							"taxcode": null,
							"carrierId": "USPS",
							"currency": "USD"
						}
					]
				};
				
				res.locals.logger.debug("/v1/calculateShipping: sending payload: " + JSON.stringify(payload));
				res.statusCode = 200;
				res.json(payload);
				
			}

		} catch (e) {
			res.locals.logger.error("Error: " + e.message);
			res.end();
			return;
		}
	});

	app.get('/v1/calculateShipping', function (req, res) {
		var payload = {
			"shippingMethods": [
				{
					"displayName": "FedEx Ground",
					"carrierId": "TEST",
					"shippingMethodId": "sm30001"
				},
				{
					"displayName": "FedEx 2Day",
					"carrierId": "TEST",
					"shippingMethodId": "sm30002"
				}
			]
		}
		res.json(payload);
		res.statusCode = 200;
		res.message = 'OK';
	});

};
