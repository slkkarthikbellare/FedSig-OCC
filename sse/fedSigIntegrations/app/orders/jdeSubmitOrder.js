const config = require("../config");
const castiron = config.get("castiron");
const axios = require('axios');

const { findOCCProfileAddress } = require("../jdeAccounts/jdeAccounts");
const { transformOCCShippingAddressToJDEFormat } = require("../jdeAccounts/jdeAccounts");
const { createJDEAccount } = require("../jdeAccounts/jdeAccounts");
const { transformJDEAccountToOCCFormat } = require("../jdeAccounts/jdeAccounts");
const { updateOCCProfileAddress } = require("../jdeAccounts/jdeAccounts");
const { findOCCOrganizationAddress } = require("../jdeAccounts/jdeAccounts");
const { updateOCCOrgAddress } = require("../jdeAccounts/jdeAccounts");

// Endpoints
const castIronSubmitOrdersEnpoint = castiron.host + "/OccOrder";
const mockSubmitOrdersEnpoint = "https://piercewashington.mockable.io/submitOrder";
const headerOptions = {
    headers: {
        "Content-Type": "application/json"
    }
};

async function jdeSubmitOrder(req, logger) {

    let payload = {};
    payload.success = false;
    const shippingAddress = req.order.shippingGroups[0].shippingAddress;
    const profileId = req.order.profileId;
    const orderId = req.order.id;
    const email = req.order.profile.email;


    if (req.order.organization === null) {
        payload.orderType = "b2c";
    } else {
        payload.orderType = "b2b";
    }

    //if profile email is null then it was an anonymous order so we send the order straight to castiron without doing anything
    if (email && email !== null) {

        //ensure the custom property guest_checkout is set to false since it's not anonymous order
        req.order.guest_checkout = false;

        //only create a new jde shipToAddress if the jde_customer_number on the shipping address is null
        if (shippingAddress.jde_customer_number === null || shippingAddress.jde_customer_number === "") {
            if (req.order.organization === null) {
                //if organization is null then order is a b2c order

                payload.msg = "processB2COrder";
                payload.jdeAccountResponse = await processB2COrder(req, orderId, profileId, shippingAddress, logger);
                //the req order shipping address has been updated with jde customer number
                payload.occOrder = req;
            } else {
                console.log("order is a b2b order");

                payload.msg = "processB2BOrder";
                payload.jdeAccountResponse = await processB2BOrder(req, orderId, req.order.organizationId, shippingAddress, logger);
                payload.occOrder = req;
            }
        } else {
            payload.msg = "jde_customer_number already set on shipping address, sent straight to castiron";
            console.log("shipping address on order: " + orderId + " already has a jde_customer_number, send straight to castiron");
        }
    } else {
        payload.orderType = "anonymous";
        payload.msg = "order is an anonymous b2c order, sent straight to castiron";
        console.log("jdeSubmitOrder: order: " + req.order.id + ", email is null so send order straight to castiron");
    }

    //submit order to castiron
    await axios.post(castIronSubmitOrdersEnpoint, req, headerOptions)
        .then(response => {
            logger.debug("Submit Order Payload: " + response.data);
            console.log(response.data);
            payload.success = true;
            //payload = response.data;
        }).catch(axiosErr => {
            let errorMessage = "Error submitting order to jde";
            payload.success = false;
            if (axiosErr.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                errorMessage = axiosErr.response.data;
                logger.error(JSON.stringify(errorMessage));
                logger.debug(JSON.stringify("http response code: " + axiosErr.response.status));
                payload.error = errorMessage;
            } else if (axiosErr.request) {
                // The request was made but no response was received
                // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                // http.ClientRequest in node.js
                logger.error(JSON.stringify(axiosErr.request));
            } else {
                // Something happened in setting up the request that triggered an Error
                logger.error(axiosErr.message);
                errorMessage = axiosErr.message;
            }
        });
    //console.log(shippingAddress);

    return payload;
}

function updateAddressWithJDEProperties(address, jdeAccount, logger) {
    let jdeProperties = transformJDEAccountToOCCFormat(jdeAccount, logger);
    //copy jde properties to shippingAddress
    address = Object.assign(address, jdeProperties);
}

async function processB2BOrder(req, orderId, orgId, shippingAddress, logger) {
    let orgAddress = null;
    let jdeAccountResponse = {};
    await findOCCOrganizationAddress(orgId, shippingAddress, logger)
        .then(response => {
            //logger.info("found profile address: " + JSON.stringify(response));
            if (response != null && response.items.length > 0) {
                orgAddress = response.items[0];
                if (response.items.length > 1) {
                    logger.warning("found more than 1 valid shipping address for organization: " + orgId + ", shippingAddress: " + JSON.stringify(shippingAddress));
                }
            }
        })
        .catch(err => {
            logger.error("Error finding org address for org: " + orgId + ", on orderId: " + orderId + ", shippingAddress: " + JSON.stringify(shippingAddress));
            console.log(err);
        });
    if (orgAddress !== null) {
        shippingAddress.repositoryId = orgAddress.address.repositoryId;
        logger.debug("org address found for shipping address on order: " + orderId + ", addressId: " + shippingAddress.repositoryId + " - " + (orgAddress !== null ? "true" : "false"));
    } else {
        //send warning that an address in occ could not be found, this should not really happen so investiage why the address does not exist
        //even if this happens, we will still create a jde account and send the order to castiron with the new account info
        logger.warning("org address not found for shipping address on order: " + orderId);
    }

    if (orgAddress !== null && orgAddress.address.jde_customer_number !== null) {
        //jde customer number already set on profile address, no need to create a new jde account, just set the info on the order shipping address
        const msg = "jde customer number found on addressId: " + shippingAddress.repositoryId + ", for orderId: " + orderId + ", jde_customer_number: " + orgAddress.address.jde_customer_number + ", do not need to create new jde account";
        logger.debug(msg);
        jdeAccountResponse.msg = msg;
        populateOCCAddressOnOCCShippingAddress(orgAddress.address, shippingAddress);
    } else {
        
        const jdeCustomerNumber = req.order.paymentGroups[0].billingAddress.jde_customer_number;

        if (jdeCustomerNumber) {
            logger.debug("jde customer number not found on addressId: " + shippingAddress.repositoryId + ", for orderId: " + orderId + ", begin create new jde account");
            const jdeAddressFormat = transformOCCShippingAddressToJDEFormat(orgId, jdeCustomerNumber, shippingAddress, logger);
            logger.debug("JDE ACCOUNT REQUEST PAYLOAD: " + JSON.stringify(jdeAddressFormat));
            //create jde shipToAddress and update that info on the order shipping address
            if (jdeAddressFormat.Address.length > 0) {
                await createJDEAccount(jdeAddressFormat, logger)
                    .then(response => {
                        jdeAccountResponse = response;
                        if (response !== undefined && response.Address !== undefined && response.Address.length > 0) {
                            updateAddressWithJDEProperties(shippingAddress, response.Address[0], logger);
                            return response;
                        } else {
                            return null;
                        }
                    })
                    .then(response2 => {
                        if (orgAddress && response2) {
                            logger.debug("update Org Address: " + shippingAddress.repositoryId + ", org: " + orgId + ",  with new jde account info");
                            updateAddressWithJDEProperties(orgAddress.address, response2.Address[0], logger);
                            orgAddress.address.is_shipping_address = true;
                            updateOCCOrgAddress(orgId, orgAddress.address.repositoryId, orgAddress, logger);
                        }
                    })
                    .catch(jdeError => {
                        logger.error("Error creating jdeAccount for order: " + orderId);
                        console.log(jdeError);
                    });
            }
        } else {
            const msg = "no jde customer number found on billingAddress for orderId: " + orderId;
            jdeAccountResponse.msg = msg;
            logger.error(msg);
        }
    }
    return jdeAccountResponse;
}

async function processB2COrder(req, orderId, profileId, shippingAddress, logger) {
    let jdeAccountResponse = {};
    let profileAddress = null;
    await findOCCProfileAddress(profileId, shippingAddress, logger)
        .then(response => {
            //logger.info("found profile address: " + JSON.stringify(response));
            if (response != null && response.items.length > 0) {
                profileAddress = response.items[0];
                if (response.items.length > 1) {
                    logger.warn("found more than 1 valid shipping address for profile: " + profileId + ", shippingAddress: " + JSON.stringify(shippingAddress));
                }
            }
        })
        .catch(err => {
            logger.error("Error finding profile address for profile: " + profileId + ", on orderId: " + orderId + ", shippingAddress: " + JSON.stringify(shippingAddress));
            console.log(err);
        });
    if (profileAddress !== null) {
        shippingAddress.repositoryId = profileAddress.address.repositoryId;
        logger.debug("profile address found for shipping address on order: " + orderId + ", addressId: " + shippingAddress.repositoryId + " - " + (profileAddress !== null ? "true" : "false"));
    } else {
        //send warning that an address in occ could not be found, this should not really happen so investiage why the address does not exist
        //even if this happens, we will still create a jde account and send the order to castiron with the new account info
        logger.warning("profile address not found for shipping address on order: " + orderId);
    }

    if (profileAddress !== null && profileAddress.address.jde_customer_number !== null) {
        //jde customer number already set on profile address, no need to create a new jde account, just set the info on the order shipping address
        const msg = "jde customer number found on addressId: " + shippingAddress.repositoryId + ", for orderId: " + orderId + ", jde_customer_number: " + profileAddress.address.jde_customer_number + ", do not need to create new jde account";
        logger.debug(msg);
        jdeAccountResponse.msg = msg;
        populateOCCAddressOnOCCShippingAddress(profileAddress.address, shippingAddress);

    } else {
        
        const jdeCustomerNumber = req.order.paymentGroups[0].billingAddress.jde_customer_number;

        if (jdeCustomerNumber) {
            logger.debug("jde customer number not found on addressId: " + shippingAddress.repositoryId + ", for orderId: " + orderId + ", begin create new jde account");
            const jdeAddressFormat = transformOCCShippingAddressToJDEFormat(profileId, jdeCustomerNumber, shippingAddress, logger);
            //create jde shipToAddress and update that info on the order shipping address
            logger.debug("JDE ACCOUNT REQUEST PAYLOAD: " + JSON.stringify(jdeAddressFormat));
            if (jdeAddressFormat.Address.length > 0) {
                await createJDEAccount(jdeAddressFormat, logger)
                    .then(response => {
                        jdeAccountResponse = response;
                        if (response !== undefined && response.Address !== undefined && response.Address.length > 0) {
                            updateAddressWithJDEProperties(shippingAddress, response.Address[0], logger);
                            return response;
                        } else {
                            return null;
                        }
                    })
                    .then(response2 => {
                        if (profileAddress && response2) {
                            logger.debug("update Profile Address: " + shippingAddress.repositoryId + ", profile: " + profileId + ",  with new jde account info");
                            updateAddressWithJDEProperties(profileAddress.address, response2.Address[0], logger);
                            updateOCCProfileAddress(profileId, profileAddress.address.repositoryId, profileAddress, logger);
                        }

                    })
                    .catch(jdeError => {
                        logger.error("Error creating jdeAccount" + JSON.stringify(jdeError));
                    });
            }
        } else {
            const msg = "no jde customer number found on billingAddress for orderId: " + orderId;
            jdeAccountResponse.msg = msg;
            logger.error(msg);
        }
    }
    return jdeAccountResponse;

}

function populateOCCAddressOnOCCShippingAddress(occAddress, shippingAddress) {
    shippingAddress.jde_customer_number = occAddress.jde_customer_number;
    shippingAddress.jde_address_type = shippingAddress.jde_address_type;
    shippingAddress.jde_address_sub_type = shippingAddress.jde_address_sub_type;
    shippingAddress.jde_tax_code = shippingAddress.jde_tax_code;
    shippingAddress.jde_payment_terms = shippingAddress.jde_payment_terms;
    shippingAddress.jde_trade_discount_code = shippingAddress.jde_trade_discount_code;
    shippingAddress.jde_vertex_code = shippingAddress.jde_vertex_code;
}


module.exports = {
    jdeSubmitOrder
};
