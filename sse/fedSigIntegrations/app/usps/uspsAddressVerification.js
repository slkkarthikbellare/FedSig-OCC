const USPS = require("usps-webtools-promise").default;
const config = require("../config");
const uspsSettings = config.get("usps");

const usps = new USPS({
  // This can be created by going to https://www.usps.com/business/web-tools-apis/ and registering for an id
  userId: uspsSettings.username,
  // USPS returns ALL CAPS, this boolean turns on Proper Caps for both Street lines and City. This is an optional item.
  properCase: false,
});

async function verifyAddress(req, logger) {
  //usps.configure({ userID: uspsSettings.username });

  let addressResponse = {};

  // invoke the API you need with...

  await usps
    .verify({
      street1: req.address.addressLines[0].address1,
      street2: req.address.addressLines[0].address2,
      city: req.address.cityTown,
      state: req.address.stateProvince,
      zip: req.address.postalCode,
      country: req.address.countryCode,
      firm_name: req.address.companyName,
      revision: 1,
    })
    .then((address) => {
      // console.log(address);
      addressResponse = address;
    });

  if (addressResponse[0]) {
    throw new Error(JSON.stringify(addressResponse));
  }
  return addressResponse;
}

module.exports = {
  verifyAddress,
};
