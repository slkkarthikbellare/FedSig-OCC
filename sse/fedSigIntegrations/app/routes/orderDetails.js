const { getCustomerOrderDetails } = require("../orders/jdeCustomerOrderDetails");

module.exports = function (app) {
    'use strict';

    app.post('/v1/customerOrderDetails', async function (req, res) {

        try {
            res.locals.logger.info("POST /v1/customerOrderDetails");

            res.type('application/json'); // set content-type

            res.locals.logger.info("/v1/customerOrderDetails: request: " + JSON.stringify(req.body));
            
            // Call to get customer order detail
            let orderDetails = await getCustomerOrderDetails(req.body, res.locals.logger);                      
            
            res.statusCode = 200;
            res.send(orderDetails);
            
        } catch (e) {
            res.locals.logger.error(e);
            res.statusCode = 400;
            res.json(e);
        }
    });
};
