const { verifyAddress } = require("../usps/uspsAddressVerification");
const {
  verifyGlobalAddress,
} = require("../globalAddressValidation/globalAddress");

module.exports = function (app) {
  "use strict";

  app.post("/v1/addressVerification", async function (req, res) {
    try {
      res.locals.logger.info("POST /v1/addressVerification");

      res.type("application/json"); // set content-type

      res.locals.logger.debug(
        "/v1/addressVerification: request: " + JSON.stringify(req.body)
      );
      let response = {};

      if (req.body.address.countryCode === "CA") {
        response = await verifyGlobalAddress(req.body, res.locals.logger);
      } else {
        response = await verifyAddress(req.body, res.locals.logger);
      }
      res.locals.logger.debug(
        "/v1/addressVerification: response: " + JSON.stringify(response)
      );
      res.json(response);
      res.statusCode = 200;
    } catch (e) {
      res.locals.logger.error("Error: " + e.message);
      res.statusCode = 422;
      res.send(e.message);
      // res.end();
      return;
    }
  });
};
