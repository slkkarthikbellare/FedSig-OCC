const config = require("../config");
const axios = require('axios');
const castiron = config.get("castiron");

// Endpoints
const castIronInvoicesEnpoint = castiron.host + "/OccInvHist";
const headerOptions = {
    headers: {
        "Content-Type": "application/json"
    }
};

async function getCustomerInvoices(req, logger, res){
    let getCustomerInvoicesRequest = {"Invoice History": []};
    let customerInvoicesResp = {};

    getCustomerInvoicesRequest["Invoice History"].push(req);    
    console.log(getCustomerInvoicesRequest);
    await axios.post(castIronInvoicesEnpoint, JSON.stringify(getCustomerInvoicesRequest), headerOptions)
    .then( response => {        
        customerInvoicesResp = response.data;
    })
    .catch(err => {
        console.log(err)        ;
        logger.info(JSON.stringify(err.response.data));               
        throw err.response.data;
    });
    return customerInvoicesResp;
}

module.exports = {
    getCustomerInvoices
};
