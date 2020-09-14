const axios = require("axios");
const config = require("../config");

const globalAVConfig = config.get("globalAddressValidation");
const key = globalAVConfig.key;
const serviceUrl = globalAVConfig.url;

const addressErrors = {
  AE01:
    "The address could not be verified at least up to the postal code level.",
  AE02:
    "Could not match the input street to a unique street name. Either no matches or too many matches found.",
  AE03:
    "The combination of directionals (N, E, SW, etc) and the suffix (AVE, ST, BLVD) is not correct and produced multiple possible matches.",
  AE05:
    "The address was matched to multiple records. There is not enough information available in the address to break the tie between multiple records.",
  AE08:
    "An address element after the house number, in most cases the sub-premise, was not valid.",
  AE09:
    "An address element after the house number, in most cases the sub-premise, was missing.",
  AE10: "The premise (house or building) number for the address is not valid.",
  AE11: "The premise (house or building) number for the address is missing.",
  AE12:
    "The PO (Post Office Box), RR (Rural Route), or HC (Highway Contract) Box number is invalid.",
  AE13:
    "The PO (Post Office Box), RR (Rural Route), or HC (Highway Contract) Box number is missing.",
  AE14:
    "US Only. The address is a Commercial Mail Receiving Agency (CMRA) and the Private Mail Box (PMB or #) number is missing.",
  GE01:
    "The submitted postal code is not in a valid format.",
  GE02:
    "The submitted postal code coordinates were not found in the Geocode database.",
};

const transmissionErrors = {
  GE02:
    "The SOAP, JSON, or XML request record structure is empty.",
  GE03:
    "The counted records sent more than the number of records allowed per request.",
  GE04: "The License Key is empty.",
  GE05:
    "The required license string is missing or invalid.",
  GE06: "The License Key is disabled.",
  GE08: "The License Key is invalid for this product or level.",
  GE09: "The Customer ID is not in our system.",
  GE10: "The encrypted license is on the ban list.",
  GE11: "The Customer ID is disabled.",
  GE12: "The IP Address is on the global ban list.",
  GE13: "The IP Address is not on the customer's whitelist.",
  GE14:
    "The account has ran out of credits. Add more credits to continue using the service.",
};

async function verifyGlobalAddress(data, logger) {
  // Built by LucyBot. www.lucybot.com
  const address = data.address;
  const addr2 = address.addressLines[1] ? address.addressLines[1].address2 : "";
  const query = encodeURI(
    `id=${key}&a1=${address.addressLines[0].address1}&a2=${addr2}&loc=${address.cityTown}&admarea=${address.stateProvince}&postal=${address.postalCode}&ctry=${address.countryCode}&format=json`
  );
  let resp = await axios.get(`${serviceUrl}?${query}`);

  if (resp.data.TotalRecords > 0) {
    const validAddress = resp.data.Records[0];

    if (
      validAddress.Results.indexOf("AE") > -1 ||
      validAddress.Results.indexOf("GE") > -1
    ) {
      statusCodes = validAddress.Results.split(",");
      const err = buildErrorResponse(statusCodes, addressErrors);
      throw new Error(JSON.stringify(err));
    } else {
      return {
        street1: validAddress.AddressLine1,
        // street2: validAddress.AddressLine2,
        city: validAddress.Locality,
        // city_abbreviation: "S SAN FRAN",
        state: validAddress.AdministrativeArea,
        Zip5: validAddress.PostalCode,
        // Zip4: "",
        // carrier_route: "C021",
        // footnotes: "N",
        // dpv_confirmation: "N",
        // dpv_false: "N",
        // dpv_footnotes: "AAM3",
        // central_delivery_point: "N",
        zip: validAddress.PostalCode,
        countryCode: validAddress.CountryISO3166_1_Alpha2,
      };
    }
  } else {
    resultCodes = resp.data.TransmissionResults.split(",");
    const err = buildErrorResponse(resultCodes, transmissionErrors);
    throw new Error(JSON.stringify(err));
  }
}

function buildErrorResponse(responseCodes, codesLookup) {
  let errorResult = {};
  for (let idx = 0; idx < responseCodes.length; idx++) {
    const code = responseCodes[idx];
    errorResult[idx] = { Code: code, Description: codesLookup[code] };
  }
  return errorResult;
}

module.exports = {
  verifyGlobalAddress,
};
