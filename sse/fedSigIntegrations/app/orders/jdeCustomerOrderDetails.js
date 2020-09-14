const config = require("../config");
const castiron = config.get("castiron");
const axios = require('axios');
const CommerceSDK = require("occsrest");
const Mustache = require("mustache");
const Constants = require('../constants');
const { JSONPath } = require("jsonpath-plus");

// Initialize commerce sdk instance
const sdk = new CommerceSDK({
	hostname: config.get(Constants.OCC_HOST),
	apiKey: config.get(Constants.OCC_APPLICATION_KEY)
});

// Endpoints
const castIronOrderDetailEndpoint = castiron.host + "/OccOrdHistDetail";
const mockOrderDetailEndpoint = "https://piercewashington.mockable.io/orderDetails";
const getSKUEndpoint = "/ccstore/v1/skus/{{id}}";
const headerOptions = {
    headers: {
        "Content-Type": "application/json"
    }
};

async function getCustomerOrderDetails(req, logger, res){
    let getCustomerOrderDetailsRequest = req;
    let getCustomerOrderDetailsResp = {};    
    logger.info("Get customer order details request: " + JSON.stringify(getCustomerOrderDetailsRequest));

    await axios.post(castIronOrderDetailEndpoint, JSON.stringify(getCustomerOrderDetailsRequest), headerOptions)
    .then((resp) => {        
        getCustomerOrderDetailsResp = resp.data;    
        logger.info("Get customer order details response: " + JSON.stringify(resp.data));    
    })
    .catch((err) => {        
        logger.info(JSON.stringify(err.response.data));           
        throw err.response.data;
    }); 
    
    return getCustomerOrderDetailsResp;

}

module.exports = {
    getCustomerOrderDetails    
}
