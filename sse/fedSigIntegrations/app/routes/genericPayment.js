'use strict';
const dateFormat = require("dateformat");
const { invoicePayment } = require("../invoice/invoicePayment");
const { genericPayment } = require("../snappay/snappay");


const INVOICE_PAYMENT_METHOD = "invoice";
const GENERIC_PAYMENT_METHOD = "generic";

module.exports = function (app) {
	'use strict';

	app.post('/v1/fedSigExternalPayment', async function (req, res) {

		try {
			res.locals.logger.info("POST /v1/fedSigExternalPayment");

			res.locals.logger.debug(JSON.stringify(req.body));

			if (req.body.paymentMethod == INVOICE_PAYMENT_METHOD) {
				let payload = invoicePayment(req.body, res.locals.logger);
				//additional properties added for FedSig to match the response of snappay
				let additionalProperties = req.body.customProperties;
				if(!additionalProperties) {
					additionalProperties = {};
				}
				additionalProperties.jde_po_number = req.body.PONumber;
				if(req.body.profileDetails) {
					additionalProperties.LastName = req.body.profileDetails.lastName;
					additionalProperties.FirstName = req.body.profileDetails.firstName;
				}
				payload.additionalProperties = additionalProperties;
				res.json(payload);
				res.statusCode = 200;
				//console.log("invoice payment"); 
			} else if (req.body.paymentMethod == GENERIC_PAYMENT_METHOD) {
				console.log("generic payment payment");
				let payload = await genericPayment(req.body, res.locals.logger);
				//console.log("payload: " + payload);
				res.json(payload);
				res.statusCode = 200;
			} else {
				res.locals.logger.error("Call to Generic Payment Gateway payment method not supported for: " + req.body.paymentMethod);
			}

		} catch (e) {
			res.locals.logger.error("Error: " + e.message);
			res.locals.logger.error(e);
			res.end();
			return;
		}
	});


};
