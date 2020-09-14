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

//last part of query with addres2 is a conditional in mustache
//can add "and jde_customer_number eq null" to both quireies if we don't want to resuse a shipping address with the same address that already has a jde customer number
const profileAddressQuery = `/ccadmin/v1/profiles/{{profileId}}/addresses?q=address1 eq "{{address1}}" and city eq "{{city}}" and state eq "{{state}}" and postalCode eq "{{postalCode}}" and fs_site_id eq "{{fs_site_id}}" and is_shipping_address eq true and address2 eq {{#address2}} "{{address2}}" {{/address2}} {{^address2}}null{{/address2}}`;
const organizationAddressQuery = `/ccadmin/v1/addresses?orgId={{orgId}}&includeCustomProperties=true&q=address1 eq "{{address1}}" and city eq "{{city}}" and state eq "{{state}}" and postalCode eq "{{postalCode}}" and fs_site_id eq "{{fs_site_id}}" and is_shipping_address eq true and address2 eq {{#address2}} "{{address2}}" {{/address2}} {{^address2}}null{{/address2}}`;

    async function syncProfile(req, res, accountUpdate) {
        try {
            res.locals.logger.info("POST /v1/syncProfile");
            res.type('application/json'); // set content-type
            //res.locals.logger.debug("REQUEST PAYLOAD: " + JSON.stringify(req.body));

            let createAccountDetails = {};
            var respData = {
                "Message": "",
                "AccountsCreated": []
            };
            createAccountDetails = req.body.profile;
            createAccountDetails.source = req.body.type;
            const siteId = req.body.siteId;

            const secondaryAddresses = JSONPath("$.secondaryAddresses[*]", createAccountDetails);

            //filter list of addresses for the site where the address was added
            let addressesBySite = filterAddressesForSite(siteId, secondaryAddresses);

            let billToAddress = findBillToAddress(addressesBySite);

            //filter addresses that do not contain a jde number
            let newAddressesForSite = filterNewAddresses(addressesBySite);

            //sort addresses so billTo address is first
            sortAddressesByBillTo(newAddressesForSite);

            if (billToAddress) {
                //if user already has a billToAddress, remove addresses that try to create another billToAccount. User's can
                //only have 1 billTo account
                newAddressesForSite = filterSecondaryBillToAddresses(newAddressesForSite);
            }

            //remove any addresses that have is_shipping_address set to null that aren't billing addresses
            newAddressesForSite = filterNullShipToAddresses(newAddressesForSite);

            if(accountUpdate) {
                newAddressesForSite= filterNewShippingAddresses(newAddressesForSite);
            } 

            if (newAddressesForSite.length > 0) {
                jdeRulesFilter(createAccountDetails.id, billToAddress, newAddressesForSite, res.locals.logger);
            }

            if(!accountUpdate) {
                //this means it's a new profile being created
                if (newAddressesForSite.length > 0) {
                    if (newAddressesForSite.length == 1) {
                        newAddressesForSite[0].isDefaultBillingAddress = true;
                        newAddressesForSite[0].isDefaultShippingAddress = true;
                    } else {
                        newAddressesForSite[0].isDefaultBillingAddress = true;
                        newAddressesForSite[0].isDefaultShippingAddress = false;
                        newAddressesForSite[1].isDefaultBillingAddress = false;
                        newAddressesForSite[1].isDefaultShippingAddress = true;
                    }
                }
            }

            // Call func to construct jde request payload
            let jdeCreateAccountRequestPayload = transformOCCProfileAddressToJDEFormat(createAccountDetails, billToAddress, newAddressesForSite, res.locals.logger);
            res.locals.logger.info("JDE SYNC PROFILE REQUEST PAYLOAD: " + JSON.stringify(jdeCreateAccountRequestPayload));

            // Return if no new accounts to create
            if (jdeCreateAccountRequestPayload.Address.length < 1) {
                res.statusCode = 200;
                respData.Message = "No new accounts to be created";
                res.locals.logger.info(respData.Message);
                res.json(respData);
                return;
            }

            // If address is not valid then log missing fields and return
            if (jdeCreateAccountRequestPayload.hasOwnProperty("validatedAddress")) {
                res.statusCode = 200;
                respData.Message = "PROFILE NOT CREATED - MISSING REQUIRED ADDRESS FIELDS: " + JSON.stringify(jdeCreateAccountRequestPayload.validatedAddress);
                res.locals.logger.info(respData.Message);
                res.json(respData);
                return;
            }

            // Call func to call create jde account service
            let createJDEAccountResponse = {};
            await createJDEAccount(jdeCreateAccountRequestPayload, res.locals.logger)
                .then((response) =>
                    createJDEAccountResponse = response);

            // Call to update occ org address
            (async function() {
                if (createJDEAccountResponse !== undefined && createJDEAccountResponse.Address !== undefined && createJDEAccountResponse.Address.length > 0) {
                    for (let [idx, jdeAccountAddress] of createJDEAccountResponse.Address.entries()) {
                        let occProfileAddress = JSONPath("$.secondaryAddresses..[?(@.repositoryId == " + jdeAccountAddress.AddressID + ")]", createAccountDetails);

                        // Get derived billing address so that it can be passed to func

                        await updateOCCProfileAddressFromJDEAccount(req.body.profileId, occProfileAddress[0], billToAddress, jdeAccountAddress, res.locals.logger)
                            .then(response => {
                                console.log(response);
                                respData.AccountsCreated.push(response);
                                res.statusCode = 200;
                                res.json(respData);
                            })
                            .catch(err => {
                                res.statusCode = 400;
                                respData.Message = "ERROR UPDATING OCC PROFILE: " + err.message;
                            });
                    }
                } else {
                    res.statusCode = 400;
                    res.json(createJDEAccountResponse);
                }
            })();
        } catch (e) {
            res.statusCode = 400;
            res.locals.logger.error("Error: " + e.message);
            res.json("{'ErrorMessage': '" + e.message + "'}");
            return;
        }
    }

    // Create account route handler
    async function syncAccount(req, res, accountUpdate) {
        try {
            let createAccountDetails = req.body.organization;
            const createAccountAddresses = JSONPath("$.secondaryAddresses[*].address", createAccountDetails);

            var respData = {
                "Message": "",
                "AccountsCreated": []
            };

            res.locals.logger.info("POST /v1/syncAccount");
            res.type('application/json'); // set content-type
            //res.locals.logger.debug("REQUEST PAYLOAD: " + JSON.stringify(createAccountAddresses));

            const sites = JSONPath("$.siteOrganizationProperties[*].site.siteId", createAccountDetails);
            let addressBySite = {};
            sites.forEach(site => {
                const result = filterAddressesForSite(site, createAccountAddresses);
                addressBySite[site] = result;
            });
            //console.log("addresses by site: " + JSON.stringify(addressBySite));
            let jdeCreateAccountRequestPayload = null;
            let billToAddress = null;
            //console.log("site ids: " + JSON.stringify(sites));
            for (const [siteId, secondaryAddresses] of Object.entries(addressBySite)) {

                billToAddress = findBillToAddress(secondaryAddresses);

                //filter addresses that do not contain a jde number
                let newAddressesForSite = filterNewAddresses(secondaryAddresses);

                //filter any address that don't have the required b2b fields
                newAddressesForSite = filterRequiredB2BFields(newAddressesForSite);
                

                //sort addresses so billTo address is first
                sortAddressesByBillTo(newAddressesForSite);

                if (billToAddress) {
                    //if user already has a billToAddress, remove addresses that try to create another billToAccount. User's can
                    //only have 1 billTo account
                    newAddressesForSite = filterSecondaryBillToAddresses(newAddressesForSite);
                }

                //remove any addresses that have is_shipping_address set to null that aren't billing addresses
                newAddressesForSite = filterNullShipToAddresses(newAddressesForSite);

                if (newAddressesForSite.length > 0) {
                    jdeRulesFilter(createAccountDetails.id, billToAddress, newAddressesForSite, res.locals.logger);
                }

                if(!createAccountDetails.shippingAddress) {
                    //this means it's a new org being created
                    if (newAddressesForSite.length > 0) {
                        if (newAddressesForSite.length === 1) {
                            console.log("1 address setting default shipping address ");
                            newAddressesForSite[0].isDefaultShippingAddress = true;
                        } else {
                            console.log("2 addresses setting 2nd to default shipping address ");
                            newAddressesForSite[1].isDefaultBillingAddress = false;
                            newAddressesForSite[1].isDefaultShippingAddress = true;
                        }
                    }
                }

                if(!createAccountDetails.billingAddress) {
                    //this means it's a new org being created
                    if (newAddressesForSite.length > 0) {
                        console.log("1 setting default billing address ");
                        newAddressesForSite[0].isDefaultBillingAddress = true;
                    }
                }

                if (newAddressesForSite.length > 0) {
                    res.locals.logger.info("PAYLOAD ADDRESSES: " + JSON.stringify(newAddressesForSite));
                    jdeCreateAccountRequestPayload = transformOCCAccountAddressToJDEFormat(createAccountDetails, billToAddress, newAddressesForSite, res.locals.logger);
                    res.locals.logger.info("JDE ACCOUNT REQUEST PAYLOAD: " + JSON.stringify(jdeCreateAccountRequestPayload));
                    if (jdeCreateAccountRequestPayload.Address.length > 0) {
                        break;
                    }
                }
            }

            if (jdeCreateAccountRequestPayload === null || jdeCreateAccountRequestPayload.Address.length < 1) {
                res.statusCode = 200;
                respData.Message = "No new accounts to be created";
                res.locals.logger.info(respData.Message);
                res.json(respData);
                return;
            }

            // If address is not valid then log missing fields and return
            if (jdeCreateAccountRequestPayload.hasOwnProperty("validatedAddress")) {
                res.statusCode = 200;
                respData.Message = "ACCOUNT NOT CREATED - MISSING REQUIRED ADDRESS FIELDS: " + JSON.stringify(jdeCreateAccountRequestPayload.validatedAddress);
                res.locals.logger.info(respData.Message);
                res.json(respData);
                return;
            }

            // Call func to call create jde account service
            let createJDEAccountResponse = {};
            await createJDEAccount(jdeCreateAccountRequestPayload, res.locals.logger)
                .then((response) => createJDEAccountResponse = response);

            // Call to update occ org address
            (async function() {
                if (createJDEAccountResponse !== undefined && createJDEAccountResponse.Address !== undefined && createJDEAccountResponse.Address.length > 0) {
                    // Loop over accounts created in jde and execute update occ func
                    for (let [idx, jdeAccountAddress] of createJDEAccountResponse.Address.entries()) {
                        let occOrgAddress = JSONPath("$.secondaryAddresses..[?(@.repositoryId == " + jdeAccountAddress.AddressID + ")]", createAccountDetails)[0];


                        await updateOCCOrgAddressFromJDE(createAccountDetails, billToAddress, occOrgAddress, jdeAccountAddress, res.locals.logger)
                            .then(response => {
                                respData.AccountsCreated.push(response);
                            })
                            .catch(err => {
                                res.statusCode = 400;
                                respData.Message = "ERROR UPDATE OCC ACCOUNT: " + err.message;
                                res.locals.logger.error(respData.Message);
                                res.locals.logger.error(err);
                            });
                    }
                    res.statusCode = 200;
                    res.json(respData);
                } else {
                    res.statusCode = 400;
                    res.json(createJDEAccountResponse);
                }
            })();

        } catch (e) {
            res.statusCode = 400;
            console.log(e);
            res.locals.logger.error("Error: " + e.message);
            res.json("{'ErrorMessage': '" + e.message + "'}");
            return;
        }
    }

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

    async function updateOrderShippingAddress(profile, address, logger) { }

    async function updateOCCProfileAddress(profileId, addressId, occProfileAddress, logger) {

        const endpoint = Mustache.render(updateAddressForProfileEndPoint, { "profileId": profileId, "addressId": addressId });

        return new Promise((resolve, reject) => {
            let result = {};
            const urlOptions = {
                url: endpoint,
                headers: {
                    "x-ccasset-language": "en",
                    "Content-Type": "application/json"
                },
                data: occProfileAddress,
                callback: (err, response) => {
                    if (err) {
                        logger.error(err);
                        result = err;
                    } else {
                        logger.debug("PROFILE ADDRESS UPDATE RESPONSE: " + JSON.stringify(response));
                        result.AccountCreated = occProfileAddress;
                    }
                    resolve(result);
                }
            };
            sdk.put(urlOptions);
        });

    }

    async function updateOCCProfileAddressFromJDEAccount(profileId, occProfileAddress, occBillingAddress, jdeAccountAddress, logger) {
        // Render endpoint
        
        const endpoint = Mustache.render(updateAddressForProfileEndPoint, { "profileId": profileId, "addressId": jdeAccountAddress.AddressID });

        // Convert create account resp payload to occ api compliant payload
        //let updateAddressRequest = transformJDEAccountToOCCFormat(jdeAccountAddress);
        updateAddressWithJDEProperties(occProfileAddress,jdeAccountAddress,logger);

        logger.debug("OCC Update Profile Request: " + JSON.stringify(occProfileAddress));

        return new Promise((resolve, reject) => {
            let result = {};
            const urlOptions = {
                url: endpoint,
                headers: {
                    "x-ccasset-language": "en"
                },
                data: {
                    address: occProfileAddress
                },
                callback: (err, response) => {
                    if (err) {
                        logger.error("Error Updating OCC Profile");
                        logger.error(err);
                        result = err;
                    } else {
                        logger.info("PROFILE ADDRESS UPDATE RESPONSE: " + JSON.stringify(response));
                        result.AccountCreated = occProfileAddress;
                    }
                    resolve(result);
                }
            };
            sdk.put(urlOptions);
        });

    }

    async function updateOCCOrgAddress(orgId, addressId, occOrgAddress, logger) {
        
        const endpoint = Mustache.render(updateAddressForOrganizationEndPoint, { "orgId": orgId, "addressId": addressId });
        return new Promise((resolve, reject) => {
            let result = {};
            const urlOptions = {
                url: endpoint,
                headers: {
                    "Content-Type": "application/json"
                },
                data: occOrgAddress,
                callback: (err, response) => {
                    if (err) {
                        logger.error(err);
                        result = err;
                    } else {
                        logger.debug("ORG ADDRESS UPDATE RESPONSE: " + JSON.stringify(response));
                        result.AccountCreated = response;
                    }
                    resolve(result);
                }
            };
            sdk.put(urlOptions);
        });
    }

    async function updateOCCOrgAddressFromJDE(createAccountDetails, occDerivedBillingAddress, occOrgAddress, jdeAccountAddress, logger) {
        const endpoint = Mustache.render(updateAddressForOrganizationEndPoint, { "orgId": createAccountDetails.id, "addressId": jdeAccountAddress.AddressID });

        // Convert create account resp from JDE to OCC update format
        //let updateAddressRequest = transformJDEAccountToOCCFormat(jdeAccountAddress);
        updateAddressWithJDEProperties(occOrgAddress,jdeAccountAddress,logger);

        

        if (occOrgAddress.is_billing_address) {
            let updateOrgRequest = {};
            updateOrgRequest.paymentMethods = ['generic'];

            // Update organization payment methods if payment terms is ccp
            if (occOrgAddress.jde_payment_terms === "CCP") {
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
        logger.debug("UpdateOCCOrgAddress request: " + JSON.stringify(occOrgAddress));
        return new Promise((resolve, reject) => {
            let result = {};
            const urlOptions = {
                url: endpoint,
                headers: {
                    "Content-Type": "application/json"
                },
                data: {
                    address: occOrgAddress
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

    async function findOCCProfileAddress(profileId, address, logger) {
        address.profileId = profileId;
        if (address.address2 === null || address.address2 === "") {
            address.address2 = null;
        }
        let endpoint = Mustache.render(profileAddressQuery, address);

        endpoint = encodeURI(
            endpoint
        );

        //console.log("findAddress query after: " + endpoint);

        return new Promise((resolve, reject) => {
            let result = {};

            const urlOptions = {
                url: endpoint,
                headers: {
                    "Content-Type": "application/json",
                    "x-ccsite": address.fs_site_id
                },
                callback: (err, response) => {
                    if (err) {
                        logger.error(err);
                        result = err;
                    } else {
                        //logger.info("found profile address: " + JSON.stringify(response));
                        result = response;
                    }
                    resolve(result);
                }
            };
            sdk.get(urlOptions);
        });

    }

    async function findOCCOrganizationAddress(orgId, address, logger) {
        address.orgId = orgId;
        if (address.address2 === null || address.address2 === "") {
            address.address2 = null;
        }
        let endpoint = Mustache.render(organizationAddressQuery, address);

        endpoint = encodeURI(
            endpoint
        );

        //console.log("findAddress query after: " + endpoint);

        return new Promise((resolve, reject) => {
            let result = {};

            const urlOptions = {
                url: endpoint,
                headers: {
                    "Content-Type": "application/json",
                    "x-ccsite": address.fs_site_id
                },
                callback: (err, response) => {
                    if (err) {
                        logger.error(err);
                        result = err;
                    } else {
                        //logger.info("found profile address: " + JSON.stringify(response));
                        result = response;
                    }
                    resolve(result);
                }
            };
            sdk.get(urlOptions);
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

    function filterNewShippingAddresses(secondaryAddresses) {
        const addressBySite = secondaryAddresses.filter(function(address) {
            return address.is_billing_address === true;
        });
        return addressBySite;
    }

    function filterRequiredB2BFields(secondaryAddresses) {
        const addressBySite = secondaryAddresses.filter(function(address) {
            const isValid = address.jde_first_name_originator !== null && address.jde_last_name_originator !== null && address.jde_email_originator !== null;
            if(!isValid) {
                console.log("B2B first_name_originator or jde_last_name_originator or jde_email_originator was not set so address will not be created for addressId: " + address.repositoryId);
            }
            return isValid;
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

    function transformOCCShippingAddressToJDEFormat(orgId, jdeCustomerNumber, address, logger) {
        const createJDEAccountPayload = { Address: [] };
        let billToCustomerNumber = 0;

        const createJDEAccountAddress = {
            siteID: address.fs_site_id,
            FirstName: address.firstName,
            LastName: address.lastName,
            // TAT - x_b2cOrganization
            // CompanyName: address.companyName,
            CompanyName: address.companyName,
            Address1: address.address1,
            Address2: address.address2,
            City: address.city,
            StateProvince: address.state,
            County: "",
            Country: address.country,
            ZipPostalCode: address.postalCode,
            PhoneNumber: address.phoneNumber,
            PhoneExtension:
                address.fs_extension !== null ? address.fs_extension : "",
            EmailAddress: address.email,
            Branch: address.jde_is_branch,
            JDECustomerNumber: jdeCustomerNumber,
            Company: addressCompany,
            AddressID: parseInt(address.repositoryId),
            IsBillingAddress: false,
            IsShippingAddress: true,
            JDECurrency: jdeCurrency,
            OrganizationID: orgId,
        };
        let validatedAddressFields = validateRequiredAddressProperties(createJDEAccountAddress, requiredAddressFields);

        if (validatedAddressFields.isValid) {
            // Push transformed address to payload address arr
            createJDEAccountPayload.Address.push(createJDEAccountAddress);
        } else {
            // Set missingAddressFields prop
            createJDEAccountPayload.validatedAddress = validatedAddressFields;
        }
        return createJDEAccountPayload;
    }

    function transformOCCProfileAddressToJDEFormat(profile, billToAddress, newAddressesForSite, logger) {
        const createJDEAccountPayload = { Address: [] };
        let billToCustomerNumber = 0;
        if (billToAddress) {
            billToCustomerNumber = billToAddress.jde_customer_number;
        }

        newAddressesForSite.forEach(address => {
            let jdeCustomerNumber = billToCustomerNumber;
            const createJDEAccountAddress = {
              siteID: address.fs_site_id,
              FirstName: address.firstName,
              LastName: address.lastName,
              CompanyName: address.companyName,
              Address1: address.address1,
              Address2: address.address2,
              City: address.city,
              StateProvince: address.state,
              County: "",
              Country: address.country,
              ZipPostalCode: address.postalCode,
              PhoneNumber: address.phoneNumber,
              PhoneExtension:
                address.fs_extension !== null ? address.fs_extension : "",
              EmailAddress: profile.email,
              Branch: address.jde_is_branch,
              JDECustomerNumber: jdeCustomerNumber,
              Company: addressCompany,
              AddressID: parseInt(address.repositoryId),
              IsBillingAddress: address.is_billing_address,
              IsShippingAddress:
                address.is_shipping_address === null
                  ? true
                  : address.is_shipping_address,
              JDECurrency: jdeCurrency,
              OrganizationID: profile.id,
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

    function updateAddressWithJDEProperties(address, jdeAccount, logger) {
        let jdeProperties = transformJDEAccountToOCCFormat(jdeAccount, logger);
        //copy jde properties to shippingAddress
        address = Object.assign(address, jdeProperties);
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
        };
        return udpateOCCAddressPayload;
    }


module.exports = {
    findOCCProfileAddress,
    transformOCCShippingAddressToJDEFormat,
    createJDEAccount,
    transformJDEAccountToOCCFormat,
    updateOCCProfileAddress,
    findOCCOrganizationAddress,
    updateOCCOrgAddress,
    syncProfile,
    syncAccount
};