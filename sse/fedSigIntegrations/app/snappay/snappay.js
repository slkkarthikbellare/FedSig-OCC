'use strict';

const axios = require('axios').default;
const { JSONPath } = require("jsonpath-plus");
const Mustache = require("mustache");
const dateFormat = require("dateformat");
const config = require("../config");
const snappay = config.get("snappay");


const template = `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:pay="http://www.cditechnology.com/products/payments">
					<soap:Header/>
					<soap:Body>
					<pay:ExternalRequestJson>
						<!--Optional:-->
						<pay:strInputXML>
						<![CDATA[
					<Request>
					<Method name="SetTransactionDetails">
					<params>
					<param name="RequestNumber">{{requestNumber}}</param>
					<param name="CustomerId">{{jdeCustomerId}}</param>
					<param name="CurrencyCode">{{order.currencyCode}}</param>
					<param name="CompanyCode">00101</param>
					<param name="UserId">{{order.profile.id}}</param>
					<param name="SaveAtUser">{{saveAtUser}}</param>
					<param name="SaveAtCustomer">N</param>
					<param name="DisplayCardsSavedAtCustomer">Y</param>
					<param name="SharedSecretKey">ba7adb8d-5236-41c0-9014-9e089fe75a51</param>
					<param name="RedirectURL">{{redirectUrl}}</param>
					<param name="CVVRequired">Y</param>
					<param name="MerchantId">FedSignalEcomm</param>
					</params>
					<level2>
					<param name="TRANSACTION_TYPE">A</param>
					<param name="ORDER_ID">{{order.orderId}}</param>
					<param name="CUSTOM_ID">{{order.paymentId}}</param>
					<param name="CUSTOM_ID2"></param>
					<param name="INVOICE_ID"></param>
					<param name="COMMENT">Order Payment received.</param>
					<param name="AMOUNT">{{order.customProperties.total}}</param>
					</level2>
					<level3>
					{{#order.items}}
					<Item>
									<param name="PRODUCT_CODE">{{catRefId}}</param>
									<param name="UNIT_COST">{{price}}</param>
									<param name="QUANTITY">{{quantity}}</param>
									<param name="ITEM_DESCRIPTOR">{{description}}</param>
									<param name="MEASURE_UNITS">EA</param>
									<param name="COMMODITY_CODE">SnapPay</param>
									<param name="MEASURE_UNITS">EA</param>
									<param name="TAX_AMOUNT">0.00</param>
									<param name="TAX_RATE">0.00</param>
									<param name="ITEM_DISCOUNT">0.00</param>
									<param name="LINE_ITEM_TOTAL">{{rawTotalPrice}}</param>
					</Item>
					{{/order.items}}
					</level3>
					</Method>
					</Request> 
					]]>
						</pay:strInputXML>
					</pay:ExternalRequestJson>
					</soap:Body>
					</soap:Envelope>`;

const paymentDetailsRequestTemplate = `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:pay="http://www.cditechnology.com/products/payments">
<soap:Header/>
<soap:Body>
   <pay:PaymentDetailsRequestJson>
      <!--Optional:-->
      <pay:strInputXML>
      <![CDATA[
<Request>
<Method name='GetTransactionDetails'>
      <params>
   <param name='RequestNumber'>{{requestNumber}}</param>
   <param name='SharedSecretKey'>ba7adb8d-5236-41c0-9014-9e089fe75a51</param>
 </params>
</Method>
</Request>
      ]]>
      </pay:strInputXML>
   </pay:PaymentDetailsRequestJson>
</soap:Body>
</soap:Envelope>`



const jsonregex = /<ExternalRequestJsonResult>([\s\S]*?)<\/ExternalRequestJsonResult>/;
const jsonPaymentDetailsRegex = /<PaymentDetailsRequestJsonResult>([\s\S]*?)<\/PaymentDetailsRequestJsonResult>/;
const regex = /<Response>[\s\S]*?<\/Response>/;
const snappay_endpoint = snappay.host;
//const endpoint = '/v1/snappay-external-request';

const headerOptions = {
    headers: {
        "Content-Type": "text/xml; charset=utf-8"
    }
};
const SNAPPAY_GUEST_ID = "99887766";
const SNAPPAY_GATEWAY_ID = "SnappayGateway";
const INVOICE_PAYMENT_METHOD = "invoice";
const INITIATE_REQUEST = "0800";
const RETRIEVE_REQUEST = "0900";
const AUTHORIZE = "0100";

//99887766
//31430295

async function genericPayment(req, logger) {

    if (req.transactionType === INITIATE_REQUEST) {
        return await externalRequest(req, logger);
    } else if (req.transactionType == RETRIEVE_REQUEST) {


        let paymentResponse = {};
        /*
        const endpoint = 'https://piercewashington.mockable.io/retrieveOrder';
        await axios.post(endpoint, JSON.stringify(req), headerOptions)
            .then((axiosRes) => {
                logger.debug(axiosRes.status);
                logger.debug(axiosRes.statusText);
                logger.debug(JSON.stringify(axiosRes.data));

                paymentResponse = axiosRes.data;
            }).catch((axiosErr) => {
                res.locals.logger.error(axiosErr);
                // console.log(`${axiosErr.response.status } ${axiosErr.response.statusText }`);
                res.send("Error");
                res.statusCode = 400;
            });*/
        logger.error("Call to retrieve request for transactionType: " + RETRIEVE_REQUEST + ", is not valid. Need to investigate");
        return paymentResponse;

    } else if (req.transactionType == AUTHORIZE) {
        /*
        const endpoint = 'https://piercewashington.mockable.io/authorizePayment';
        let paymentResponse = { };
        await axios.post(endpoint, JSON.stringify(req), headerOptions)
            .then((axiosRes) => {
                logger.debug(axiosRes.status);
                logger.debug(axiosRes.statusText);
                logger.debug(JSON.stringify(axiosRes.data));

                paymentResponse = axiosRes.data;
            }).catch((axiosErr) => {
                res.locals.logger.error(axiosErr);
                // console.log(`${axiosErr.response.status } ${axiosErr.response.statusText }`);
                res.send("Error");
                res.statusCode = 400;
            });
        return paymentResponse; */

        return await paymentDetails(req, logger);
    } else {
        logger.info("no snappay payment transactionType for: " + req.transactionType);
        let paymentResponse = { "Error": "No transactionType setup" };
        return paymentResponse;
    }
}

async function paymentDetails(req, logger) {

    const transactionTimestamp = dateFormat(new Date(), "isoDateTime");
    const timestampInMilli = new Date().getTime();
    const requestNumber = req.customProperties.RequestNumber;

    const data = {
        "requestNumber": requestNumber
    };

    const soapRequest = Mustache.render(paymentDetailsRequestTemplate, data);
    let paymentResponse = {};

    await axios.post(snappay_endpoint, soapRequest, headerOptions)
        .then((axiosRes) => {
            //console.log("snappay response");
            logger.debug("Snappay paymentRequest: status: " + axiosRes.status + " " + axiosRes.statusText);
            logger.debug("Snappay paymentRequest: status: " + axiosRes.data);
            //console.log(axiosRes.data);

            let snappayResponse = parseGetPaymentDetails(axiosRes.data, logger);
            logger.debug("snappayResponse: " + JSON.stringify(snappayResponse));

            paymentResponse = {
                "orderId": req.orderId,
                "paymentId": req.paymentId,
                "transactionTimestamp": req.transactionTimestamp,
                "transactionType": req.transactionType,
                "currencyCode": req.currencyCode,
                "hostTimestamp": transactionTimestamp,
                "amount": req.amount
            };

            if (snappayResponse.Status === "Y") {

                //snappayResponse.AddressLine2 = snappayResponse.AddressLine2 ? snappayResponse.AddressLine2 : "";
                //snappayResponse.AddressLine3 = snappayResponse.AddressLine3 ? snappayResponse.AddressLine3 : "";
                //.PhoneNumber = snappayResponse.PhoneNumber ? snappayResponse.PhoneNumber : "";
                if (req.customProperties.PONumber) {
                    snappayResponse.jde_po_number = req.customProperties.PONumber;
                } else {
                    snappayResponse.jde_po_number = req.orderId;
                }


                if (req.profileDetails && req.profileDetails.currentOrganization) {
                    snappayResponse.CompanyName = req.profileDetails.currentOrganization.name;
                } else {
                    //snappayResponse.CompanyName = "";
                }
                if (req.billingAddress.jde_customer_number) {
                    snappayResponse.jde_customer_number = req.billingAddress.jde_customer_number;
                }
                //always CCP for creditcards
                snappayResponse.jde_payment_terms = "CCP";

                //snappayResponse.jde_po_number = "";
                paymentResponse.merchantTransactionId = snappayResponse.PGTransactionId;
                paymentResponse.response = {
                    "success": true
                };

                paymentResponse.additionalProperties = snappayResponse;


            } else {
                paymentResponse.response = {
                    "success": false,
                    "description": snappayResponse.Description
                };
            }


        }).catch((axiosErr) => {
            logger.error("Error calling snappay");
            if (axiosErr.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                logger.error(axiosErr.response.data);
                logger.error(axiosErr.response.status);
            } else if (axiosErr.request) {
                // The request was made but no response was received
                // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                // http.ClientRequest in node.js
                logger.error(axiosErr.request);
            } else {
                // Something happened in setting up the request that triggered an Error
                logger.error(axiosErr.message);
            }
            logger.error(axiosErr);
        });

    return paymentResponse;

}

async function externalRequest(req, logger) {

    const transactionTimestamp = dateFormat(new Date(), "isoDateTime");
    const timestampInMilli = new Date().getTime();
    const requestNumber = req.orderId + "-" + timestampInMilli;
    let jdeCustomerId = req.billingAddress.jde_customer_number;
    let redirectUrl = req.customProperties.redirectUrl + req.orderId
    let saveAtUser = "Y";
    if (req.customProperties.loggedIn === "false") {
        jdeCustomerId = SNAPPAY_GUEST_ID;
        saveAtUser = "N";
    }
    const data = {
        "requestNumber": requestNumber,
        "order": req,
        "jdeCustomerId": jdeCustomerId,
        "saveAtUser": saveAtUser,
        "redirectUrl": redirectUrl
    };

    const soapRequest = Mustache.render(template, data);

    //console.log(soapRequest);
    let paymentResponse = {};

    await axios.post(snappay_endpoint, soapRequest, headerOptions)
        .then((axiosRes) => {
            //console.log("snappay response");
            logger.debug("Snappay externalRequest: status: " + axiosRes.status + " " + axiosRes.statusText);
            logger.debug("Snappay externalRequest " + axiosRes.data);
            //console.log(axiosRes.data);

            let snappayResponse = parseExternalRequest(axiosRes.data, logger);

            logger.debug("snappayResponse: " + JSON.stringify(snappayResponse));
            paymentResponse = {
                "orderId": req.orderId,
                "paymentId": req.paymentId,
                "merchantTransactionId": snappayResponse.RequestNumber,
                "hostTransactionId": req.transactionId,
                "transactionTimestamp": String(timestampInMilli),
                "hostTimestamp": transactionTimestamp,
                "transactionType": req.transactionType,
                "siteId": req.siteId,
                "additionalProperties": snappayResponse,
                "externalProperties": ["RequestNumber", "Status", "ReturnMessage"],
                "amount": req.amount,
                "currencyCode": req.currencyCode,
                "paymentMethod": req.paymentMethod,
                "locale": req.locale,
                "gatewayId": req.gatewayId,
                "response": {
                    "success": true,
                    "code": "200"
                }
            };

        }).catch((axiosErr) => {
            logger.error("Error calling snappay");
            if (axiosErr.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                logger.info("snappayError-1");
                logger.error(axiosErr.response.data);
                logger.error(axiosErr.response.status);
            } else if (axiosErr.request) {
                // The request was made but no response was received
                // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                // http.ClientRequest in node.js
                logger.info("snappayError-2");
                logger.error(axiosErr.request);
            } else {
                // Something happened in setting up the request that triggered an Error
                logger.info("snappayError-3");
                logger.error(axiosErr.message);
            }
            logger.info("snappayError-4");
            //logger.error(axiosErr);
        });

    return paymentResponse;
}

function parseGetPaymentDetails(requestData, logger) {
    const payload = {};
    let match = [];
    if ((match = jsonPaymentDetailsRegex.exec(requestData)) !== null) {

        //console.log(match[1]);
        if (match.length > 1) {

            //logger.debug("parsing " + match[1]);

            //remove @ and # char from string
            let responseStr = match[1].replace(/@/g, "");
            responseStr = responseStr.replace(/#text/g, "text");

            const responseJson = JSON.parse(responseStr);
            const methodJson = responseJson.Response.Method.params;

            payload.RequestNumber = JSONPath({ path: "$..[?(@.name== 'RequestNumber')].text", json: methodJson })[0];
            payload['Status'] = JSONPath({ path: "$..[?(@.name== 'Status')].text", json: methodJson })[0];
            payload['Description'] = JSONPath({ path: "$..[?(@.name== 'Description')].text", json: methodJson })[0];

            const cardParams = responseJson.Response.Method.card;

            payload.TokenId = JSONPath({ path: "$..[?(@.name== 'TokenId')].text", json: responseJson })[0];
            payload.CardType = JSONPath({ path: "$..[?(@.name== 'CardType')].text", json: responseJson })[0];
            payload.FirstName = JSONPath({ path: "$..[?(@.name== 'FirstName')].text", json: responseJson })[0];

            payload.LastName = JSONPath({ path: "$..[?(@.name== 'LastName')].text", json: responseJson })[0];
            payload.ExpirationMonth = JSONPath({ path: "$..[?(@.name== 'ExpirationMonth')].text", json: responseJson })[0];
            payload.ExpirationYear = JSONPath({ path: "$..[?(@.name== 'ExpirationYear')].text", json: responseJson })[0];
            payload.AddressLine1 = JSONPath({ path: "$..[?(@.name== 'AddressLine1')].text", json: responseJson })[0];
            payload.AddressLine2 = JSONPath({ path: "$..[?(@.name== 'AddressLine2')].text", json: responseJson })[0];
            payload.AddressLine3 = JSONPath({ path: "$..[?(@.name== 'AddressLine3')].text", json: responseJson })[0];
            payload.PhoneNumber = JSONPath({ path: "$..[?(@.name== 'PhoneNumber')].text", json: responseJson })[0];

            payload.City = JSONPath({ path: "$..[?(@.name== 'City')].text", json: responseJson })[0];
            payload.State = JSONPath({ path: "$..[?(@.name== 'State')].text", json: responseJson })[0];
            payload.Zip = JSONPath({ path: "$..[?(@.name== 'Zip')].text", json: responseJson })[0];
            payload.Country = JSONPath({ path: "$..[?(@.name== 'Country')].text", json: responseJson })[0];
            payload.Email = JSONPath({ path: "$..[?(@.name== 'Email')].text", json: responseJson })[0];

            const paymentParams = responseJson.Response.Method.payment;

            payload.PGStatus = JSONPath({ path: "$..[?(@.name== 'PGStatus')].text", json: responseJson })[0];
            payload.PGTransactionId = JSONPath({ path: "$..[?(@.name== 'PGTransactionId')].text", json: responseJson })[0];
            payload.PGReturnDescription = JSONPath({ path: "$..[?(@.name== 'PGReturnDescription')].text", json: responseJson })[0];
            payload.AuthCode = JSONPath({ path: "$..[?(@.name== 'AuthCode')].text", json: responseJson })[0];
            payload.Amount = JSONPath({ path: "$..[?(@.name== 'Amount')].text", json: responseJson })[0];
            payload.ZipCodeVerification = JSONPath({ path: "$..[?(@.name== 'ZipCodeVerification')].text", json: responseJson })[0];
            payload.AddressVerification = JSONPath({ path: "$..[?(@.name== 'AddressVerification')].text", json: responseJson })[0];
            payload.CVVVerification = JSONPath({ path: "$..[?(@.name== 'CVVVerification')].text", json: responseJson })[0];
            payload.AuthDate = JSONPath({ path: "$..[?(@.name== 'AuthDate')].text", json: responseJson })[0];
            payload.AuthTime = JSONPath({ path: "$..[?(@.name== 'AuthTime')].text", json: responseJson })[0];

            logger.debug("returning payload: " + JSON.stringify(payload));


        } else {
            logger.error("Error: unable to match ExternalRequestJsonResult in response: " + requestData);
        }
    }
    return payload;
}

function parseExternalRequest(requestData, logger) {
    const payload = {};
    let match = [];
    if ((match = jsonregex.exec(requestData)) !== null) {

        //console.log(match[1]);
        if (match.length > 1) {

            logger.debug("parsing " + match[1]);

            //remove @ and # char from string
            let responseStr = match[1].replace(/@/g, "");
            responseStr = responseStr.replace(/#text/g, "text");

            let responseJson = JSON.parse(responseStr);
            responseJson = responseJson.Response.Method.params;

            payload.RequestNumber = JSONPath({ path: "$..[?(@.name== 'RequestNumber')].text", json: responseJson })[0];
            payload['Status'] = JSONPath({ path: "$..[?(@.name== 'Status')].text", json: responseJson })[0];
            payload['ReturnMessage'] = JSONPath({ path: "$..[?(@.name== 'ReturnMessage')].text", json: responseJson })[0];

            logger.debug("returning payload: " + JSON.stringify(payload));


        } else {
            logger.error("Error: unable to match ExternalRequestJsonResult in response: " + requestData);
        }
    }
    return payload;
}

module.exports = {
    genericPayment
};