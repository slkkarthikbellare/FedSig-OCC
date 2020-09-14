const { getCustomerInvoices } = require("../invoice/jdeCustomerInvoices");

module.exports = function (app) {
    'use strict';

    app.post('/v1/customerInvoices', async function (req, res) {

        try {
            res.locals.logger.info("POST /v1/customerInvoices");

            res.type('application/json'); // set content-type

            res.locals.logger.debug("/v1/customerInvoices: request: " + JSON.stringify(req.body));
            let response = {};

            response = await getCustomerInvoices(req.body,res.locals.logger); 
                       
            res.json(response);
            res.statusCode = 200;
            
        } catch (e) {
            console.log(e);
            res.locals.logger.error(e);
            res.statusCode = 400;
            res.json(e);
            return;
        }
    });
};
