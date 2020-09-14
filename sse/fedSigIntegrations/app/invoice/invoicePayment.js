'use strict';
const { v1: uuidv1 } = require('uuid');

const dateFormat = require("dateformat");



const AUTH_TRANSACTION_TYPE = "AUTHORIZE";


function invoicePayment(request, logger) {
    logger.info("InvoiceRequest Payment"); 
    if (request.transactionType == AUTH_TRANSACTION_TYPE) {
        return invoiceAuthRequest(request, logger);
    } else {
        logger.error("No invoice transaction type setup for: " + request.transactionType + " on order: " + req.orderId);
    }
}

function invoiceAuthRequest(req, logger) {

    const transactionTimestamp = dateFormat(new Date(), "isoDateTime");
    const timestampInMilli = new Date().getTime();

    //invoice auth response. Happens when a user checksout with a PO
    logger.info("InvoiceRequest auth request: " + req.orderId);
    let authResponse = {
        "merchantTransactionTimestamp": timestampInMilli,
        "currencyCode": "USD",
        "transactionId": req.transactionId,
        "PONumber": req.PONumber,
        "referenceNumber": req.referenceNumber,
        "organizationId": req.organizationId,
        "amount": req.amount,
        "transactionType": "AUTHORIZE",
        "authorizationResponse": {
            "hostTransactionId": uuidv1(),
            "responseCode": "1000",
            "responseReason": "1002",
            "responseDescription": "Valid PO Number",
            "merchantTransactionId": transactionTimestamp
        },
        "transactionTimestamp": req.transactionTimestamp,
        "paymentMethod": "invoice",
        "orderId": req.orderId,
        "gatewayId": req.gatewayId
    }
    logger.debug("InvoiceRequest response: " + JSON.stringify(authResponse));
    return authResponse;

}


module.exports = {
    invoicePayment
};

