const config = require("../config");
const castiron = config.get("castiron");
const axios = require('axios');

// Endpoints
const castIronOrdersEnpoint = castiron.host + "/OccSalesHist";
const headerOptions = {
    headers: {
        "Content-Type": "application/json"
    }
};

async function getCustomerOrders(req, logger, res){
    let getCustomerOrdersRequest = {"Sales History": []};
    let customerOrdersResp = {};

    getCustomerOrdersRequest["Sales History"].push(req);
    //logger.debug("Get customer orders request: " + JSON.stringify(getCustomerOrdersRequest));

    await axios.post(castIronOrdersEnpoint, JSON.stringify(getCustomerOrdersRequest), headerOptions)
    .then( response => {        
        customerOrdersResp = response.data;
    })
    .catch(err => {        
        logger.info(JSON.stringify(err.response.data));               
        throw err.response.data;
    });
    return customerOrdersResp;
}

module.exports = {
    getCustomerOrders
};
