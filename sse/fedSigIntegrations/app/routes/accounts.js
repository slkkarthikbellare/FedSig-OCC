/*jslint node: true */
'use strict';

// Require modules
const config = require("../config");
const castiron = config.get("castiron");
const CommerceSDK = require("occsrest");
const Constants = require('../constants');
const Mustache = require("mustache");
const axios = require('axios');
const { JSONPath } = require("jsonpath-plus");
const { syncProfile } = require("../jdeAccounts/jdeAccounts");
const { syncAccount } = require("../jdeAccounts/jdeAccounts");
const headerOptions = {
    headers: {
        "Content-Type": "application/json"
    }
};

// Initialize commerce sdk instance
const sdk = new CommerceSDK({
    hostname: config.get(Constants.OCC_HOST),
    apiKey: config.get(Constants.OCC_APPLICATION_KEY)
});

const addressCompany = "04200";
const jdeCurrency = "USD";
const requiredAddressFields = [
    "Company",
    "AddressID",
    "JDECustomerNumber",
    "JDECurrency",
    "FirstName",
    "LastName",
    "EmailAddress",
    "Address1",
    "City",
    "Country",
    "StateProvince",
    "ZipPostalCode",
    "IsBillingAddress",
    "IsShippingAddress"
];

// Define rest api endpoints
const updateAddressForOrganizationEndPoint = "/ccadmin/v1/organizations/{{orgId}}/secondaryAddresses/{{addressId}}";
const updateOrganizationEndpoint = "/ccadmin/v1/organizations/{{orgId}}";
const updateAddressForProfileEndPoint = "/ccadmin/v1/profiles/{{profileId}}/addresses/{{addressId}}";
const getProfileDetailsEndpoint = "/ccadmin/v1/profiles/{{profileId}}";
const castIronOccAddressEndpoint = castiron.host + "/OccAddress";
const mockJDEEndpoint = "https://piercewashington.mockable.io/jdeCreateAccountResponse";

module.exports = function(app) {
    'use strict';

    //TODO change the routes here to call app/jdeAccounts/jdeAccounts.js
    app.post('/v1/createProfileToJDEAccount', async function(req, res) {
        try {
            return await syncProfile(req,res, false);
            
        } catch (e) {
            res.statusCode = 400;
            res.locals.logger.error("Error: " + e.message);
            res.json("{'ErrorMessage': '" + e.message + "'}");
            return;
        }
    });

    app.post('/v1/updateProfileToJDEAccount', async function(req, res) {
        try {
            return await syncProfile(req,res, true);
            
        } catch (e) {
            res.statusCode = 400;
            res.locals.logger.error("Error: " + e.message);
            res.json("{'ErrorMessage': '" + e.message + "'}");
            return;
        }
    });

    // Create account route handler
    app.post('/v1/createOrgToJDEAccount', async function(req, res) {
        try {
            
            return await syncAccount(req,res, false);
        } catch (e) {
            res.statusCode = 400;
            console.log(e);
            res.locals.logger.error("Error: " + e.message);
            res.json("{'ErrorMessage': '" + e.message + "'}");
            return;
        }
    });

    app.post('/v1/updateOrgToJDEAccount', async function(req, res) {
        try {
            
            return await syncAccount(req,res, true);
        } catch (e) {
            res.statusCode = 400;
            console.log(e);
            res.locals.logger.error("Error: " + e.message);
            res.json("{'ErrorMessage': '" + e.message + "'}");
            return;
        }
    });

    async function createJDEAccount(address, logger) {
        //logger.info("JDE ACCOUNT REQUEST PAYLOAD: " + JSON.stringify(address));
        let jdeCreateAccountResponse = {};

        await axios.post(castIronOccAddressEndpoint, JSON.stringify(address), headerOptions)
            .then(response => {
                logger.debug("JDE ACCOUNT RESPONSE PAYLOAD: " + JSON.stringify(response.data));
                jdeCreateAccountResponse = response.data;
            }).catch(axiosErr => {
                let errorMessage = "Error creating account in JDE";
                if (axiosErr.response) {
                    // The request was made and the server responded with a status code
                    // that falls out of the range of 2xx
                    errorMessage = axiosErr.response.data;
                    logger.error(JSON.stringify(errorMessage) + " for customer: " + address.Address[0].EmailAddress + ", addressId: " + address.Address[0].AddressID);
                    logger.debug(JSON.stringify("http response code: " + axiosErr.response.status));
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
                jdeCreateAccountResponse = errorMessage;
            });

        return jdeCreateAccountResponse;
    }

    async function updateOCCOrgAddress(createAccountDetails, occDerivedBillingAddress, occOrgAddress, jdeAccountAddress, logger) {
        const endpoint = Mustache.render(updateAddressForOrganizationEndPoint, { "orgId": createAccountDetails.id, "addressId": jdeAccountAddress.AddressID });

        // Convert create account resp from JDE to OCC update format
        let updateAddressRequest = transformJDEAccountToOCCFormat(jdeAccountAddress);

        // Set IsDefaultBilling property if derived billing address has not yet been populated
        if (occDerivedBillingAddress === null && occOrgAddress.is_billing_address) {
            updateAddressRequest.isDefaultBillingAddress = true;
        }

        if (occOrgAddress.is_billing_address) {
            let updateOrgRequest = {};
            updateOrgRequest.paymentMethods = ['generic'];

            // Update organization payment methods if payment terms is ccp
            if (updateAddressRequest.jde_payment_terms === "CCP") {
                await updateOCCOrganization(createAccountDetails.id, occOrgAddress.fs_site_id, updateOrgRequest, logger)
                    .then(response => {
                        logger.info("Payment methods updated for organization: " + createAccountDetails.id + " " + JSON.stringify(response));
                    })
                    .catch(err => {
                        logger.error("Error updating payment methods for organization: " + createAccountDetails.id + " " + JSON.stringify(err));
                    });
            }
        }

        logger.debug("UpdateOCCOrgAddress endpoint: " + endpoint);
        logger.debug("UpdateOCCOrgAddress request: " + JSON.stringify(updateAddressRequest));
        return new Promise((resolve, reject) => {
            let result = {};
            const urlOptions = {
                url: endpoint,
                headers: {
                    "Content-Type": "application/json"
                },
                data: {
                    address: updateAddressRequest
                },
                callback: (err, response) => {
                    if (err) {
                        logger.error(err);
                        result = err;
                    } else {
                        logger.info("ORG ADDRESS UPDATE RESPONSE: " + JSON.stringify(response));
                        result.AccountCreated = response;
                    }
                    resolve(result);
                }
            };
            sdk.put(urlOptions);
        });
    }

    async function updateOCCOrganization(orgId, siteId, updateOrgRequest, logger) {
        const endpoint = Mustache.render(updateOrganizationEndpoint, { "orgId": orgId });
        logger.debug("updateOrgRequest endpoint: " + endpoint);
        logger.debug("updateOrgRequest: " + JSON.stringify(updateOrgRequest));
        return new Promise((resolve, reject) => {
            let result = {};

            const urlOptions = {
                url: endpoint,
                headers: {
                    "Content-Type": "application/json",
                    "x-ccsite": siteId
                },
                data: updateOrgRequest,
                callback: (err, response) => {
                    if (err) {
                        logger.error(err);
                        result = err;
                    } else {
                        logger.info("Updated organization: " + JSON.stringify(response));
                    }
                    resolve(result);
                }
            };
            sdk.put(urlOptions);
        });
    }

    /** filters all the secondary addresses to return only those addresses whose fs_site_id matches the siteId passed in */
    function filterAddressesForSite(siteId, secondaryAddresses) {
        const addressBySite = secondaryAddresses.filter(function(address) {
            return address.fs_site_id === siteId;
        });
        return addressBySite;
    }

    function filterNewAddresses(secondaryAddresses) {
        const addressBySite = secondaryAddresses.filter(function(address) {
            return address.jde_customer_number === null || address.jde_customer_number === "";
        });
        return addressBySite;
    }

    /** Removes any addresses where is_billing_address is set to true. This should be called to remove any billTo addresses
     * from being pocessed if a site already has a valid billTo address.
     */
    function filterSecondaryBillToAddresses(secondaryAddresses) {
        const addressBySite = secondaryAddresses.filter(function(address) {
            return address.is_billing_address === null || address.is_billing_address === "" || address.is_billing_address === false;
        });
        return addressBySite;
    }

    function filterRequiredB2BFields(secondaryAddresses) {
        const addressBySite = secondaryAddresses.filter(function(address) {
            return address.jde_first_name_originator !== null && address.jde_last_name_originator !== null && address.jde_email_originator !== null;
        });
        return addressBySite;
    }

    function filterNullShipToAddresses(secondaryAddresses) {
        const addressBySite = secondaryAddresses.filter(function(address) {
            if (address.is_shipping_address === null && address.is_billing_address !== true) {
                return false;
            } else {
                return true;
            }
        });
        return addressBySite;
    }

    function jdeRulesFilter(id, billToAddress, newAddressesForSite, logger) {
        if (billToAddress === undefined && newAddressesForSite[0].is_billing_address !== true) {
            logger.error("Cannot create a new jde shipping address without a billing address for profile: " + id);
            newAddressesForSite = [];
            return;
        }

        if (billToAddress === undefined && newAddressesForSite[0].is_billing_address === true && newAddressesForSite[0].is_shipping_address === true) {
            //if the first address to process is both a new billToAddress and new shipToAddress then only process this address
            newAddressesForSite.splice(1);
        }

        if (newAddressesForSite.length > 1) {
            //if the user doesn't have a billToAddress and have multiple new addresses with is_billing_address = ture
            //this would only happen from bad data entry in admin console
            if (newAddressesForSite[0].is_billing_address === true && newAddressesForSite[1].is_billing_address === true) {
                logger.info("Cannot create more than 1 new jde billing address for profile: " + id + ". Will only process the first bill to address");
                newAddressesForSite.splice(1);
            }
        }
        if (newAddressesForSite.length > 1 && billToAddress !== undefined) {
            //this means it is processing multiple new shipping addresses and jde can only add 1 shipping address at a time
            logger.info("Cannot create more than 1 new jde shipping address for profile: " + id + ". Will only process the first ship to address");
            newAddressesForSite.splice(1);
        }
        if (newAddressesForSite.length > 2 && billToAddress === undefined) {
            //this means it is processing 2+ addresses and the user does not have a bill to account setup
            //jde can process 2 addreses if the first is a billToAddress and the 2nd is a shipping addresses
            //remove any other shipping addresses from being processed
            logger.info("Removing additional shipping addresses from being processed for profile: " + id + ". Will process the additional shipping addresses on the next update call");
            newAddressesForSite.splice(2);
        }
    }

    function findBillToAddress(secondaryAddresses) {
        const billToAddress = secondaryAddresses.find(function(address) {
            return address.is_billing_address === true && address.jde_customer_number !== null && address.jde_customer_number !== "";
        });
        return billToAddress;
    }

    function sortAddressesByBillTo(secondaryAddresses) {
        try {
            secondaryAddresses.sort(function(a1, a2) {
                if (a1.is_billing_address && a2.is_billing_address) {
                    return 0;
                } else if (a1.is_billing_address) {
                    return -1;
                } else if (a2.is_billing_address) {
                    return 1;
                } else {
                    return 0;
                }
            });
        } catch (e) {
            console.log(e);
        }
    }

    function transformOCCAccountAddressToJDEFormat(orgnaization, billToAddress, newAddressesForSite, logger) {
        const createJDEAccountPayload = { Address: [] };
        let billToCustomerNumber = 0;
        if (billToAddress) {
            billToCustomerNumber = billToAddress.jde_customer_number;
        }
        console.log("new addresses length: " + newAddressesForSite.length);
        newAddressesForSite.forEach(address => {
            let jdeCustomerNumber = billToCustomerNumber;
            const createJDEAccountAddress = {
                siteID: address.fs_site_id,
                FirstName: address.jde_first_name_originator,
                LastName: address.jde_last_name_originator,
                CompanyName: address.companyName,
                Address1: address.address1,
                Address2: address.address2,
                City: address.city,
                StateProvince: address.state,
                County: '',
                Country: address.country,
                ZipPostalCode: address.postalCode,
                PhoneNumber: address.phoneNumber,
                PhoneExtension: address.fs_extension !== null ? address.fs_extension : '',
                EmailAddress: address.jde_email_originator,
                Branch: address.jde_is_branch,
                JDECustomerNumber: jdeCustomerNumber,
                Company: addressCompany,
                AddressID: parseInt(address.repositoryId),
                IsBillingAddress: address.is_billing_address,
                IsShippingAddress: address.is_shipping_address === null ? true : address.is_shipping_address,
                JDECurrency: jdeCurrency,
                OrganizationID: orgnaization.id
            };
            let validatedAddressFields = validateRequiredAddressProperties(createJDEAccountAddress, requiredAddressFields);

            if (validatedAddressFields.isValid) {
                // Push transformed address to payload address arr
                createJDEAccountPayload.Address.push(createJDEAccountAddress);
            } else {
                // Set missingAddressFields prop
                createJDEAccountPayload.validatedAddress = validatedAddressFields;
            }
        });
        return createJDEAccountPayload;
    }

    function validateRequiredAddressProperties(address, requiredFields) {
        let validatedAddress = {
            isValid: false,
            missingAddressFields: [],
            addressId: ""
        };
        requiredFields.forEach(function(field) {
            if (!address.hasOwnProperty(field) || address[field] === '' || address[field] === null || typeof address[field] == "undefined") {
                validatedAddress.addressId = address.AddressID;
                validatedAddress.missingAddressFields.push(field);
            }
        });

        if (validatedAddress.missingAddressFields.length < 1) {
            validatedAddress.isValid = true;
        }

        return validatedAddress;
    }

    function transformJDEAccountToOCCFormat(jdeAccountAddress, logger) {
        const udpateOCCAddressPayload = {
            "jde_customer_number": jdeAccountAddress.JDECustomerNumber,
            "jde_address_type": jdeAccountAddress.JDEAddressType,
            "jde_address_sub_type": jdeAccountAddress.JDEAddressSubType,
            "jde_tax_code": jdeAccountAddress.JDETaxRateArea,
            "jde_payment_terms": jdeAccountAddress.JDEPaymentTerms,
            "jde_trade_discount_code": jdeAccountAddress.JDETradeDiscount,
            "jde_vertex_code": jdeAccountAddress.JDEVertexCode
        }
        return udpateOCCAddressPayload;
    }

};
