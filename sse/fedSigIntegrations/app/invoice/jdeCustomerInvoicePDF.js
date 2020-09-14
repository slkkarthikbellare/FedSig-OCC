const config = require("../config");
const axios = require('axios');
const castiron = config.get("castiron");

const headerOptions = {   
    responseType: "arraybuffer",
    headers: {
        "Accept": "application/pdf"
    }     
};

async function getCustomerInvoicePDF(invoiceDocId, logger){    
    let castIronInvoicePDFEndpoint = castiron.host + "/OccInvoicePDF?doc=" + invoiceDocId;
    let customerInvoicePDF = "";        
    
    logger.info("Calling casting iron invoice pdf endpoint: " + castIronInvoicePDFEndpoint);
    await axios.get(castIronInvoicePDFEndpoint, headerOptions)
    .then( response => {                
        customerInvoicePDF = Buffer.from(response.data).toString('base64')
    })
    .catch(err => {
        console.log(err)        ;
        logger.info(JSON.stringify(err.response.data));               
        throw err.response.data;
    })
    return customerInvoicePDF;
}

module.exports = {
    getCustomerInvoicePDF
};
