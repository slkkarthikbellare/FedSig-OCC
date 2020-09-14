const { getCustomerOrders } = require("../orders/jdeCustomerOrders");

module.exports = function (app) {
    'use strict';

    app.post('/v1/customerOrders', async function (req, res) {

        try {
            res.locals.logger.info("POST /v1/customerOrders");

            res.type('application/json'); // set content-type

            res.locals.logger.debug("/v1/customerOrders: request: " + JSON.stringify(req.body));
            let response = {};

            response = await getCustomerOrders(req.body,res.locals.logger);

            res.json(response);
            res.statusCode = 200;
            
        } catch (e) {
            res.locals.logger.error(e);
            res.statusCode = 400;
            res.json(e);
            return;
        }
    });
};
