const { getCustomerInvoicePDF } = require("../invoice/jdeCustomerInvoicePDF");

module.exports = function (app) {
    'use strict';

    app.get('/v1/customerInvoicePDF', async function (req, res) {

        try {
            res.locals.logger.info("GET /v1/customerInvoicePDF");

            let invoiceDocId = req.query.doc; 
            let response = {};

            res.locals.logger.debug("/v1/customerInvoicePDF: Invoice doc id: " + invoiceDocId);           

            response = await getCustomerInvoicePDF(invoiceDocId, res.locals.logger);               
            
            res.end(response);            
            
        } catch (e) {
            res.locals.logger.error(e);
            res.statusCode = 400;
            res.json(e);
            return;
        }
    });
};
