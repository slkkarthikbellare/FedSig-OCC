const { UserProfile } = require("../idcs/userProfile");

module.exports = function (app) {
  "use strict";

  app.post("/v1/userProfile", async function (req, res) {
    try {
      res.locals.logger.info("POST /v1/userProfile");

      res.type("application/json"); // set content-type

      res.locals.logger.debug(
        "/v1/userProfile request: " + JSON.stringify(req.body, null, 2)
      );

      const userProfile = new UserProfile(res.locals.logger);
      await userProfile.init();
      const response = await userProfile.process(req.body);

      res.json(response);
      res.statusCode = 200;
    } catch (e) {
      res.locals.logger.error(e);
      res.statusCode = 400;
      res.json(e);
      return;
    }
  });

  app.post("/v1/userProfile/resetPassword", async function (req, res) {
    try {
      res.locals.logger.info("POST /v1/userProfile/resetPassword");

      res.type("application/json"); // set content-type

      res.locals.logger.debug(
        "/v1/userProfile/resetPassword request: " + JSON.stringify(req.body, null, 2)
      );

      const userProfile = new UserProfile(res.locals.logger);
      await userProfile.init();
      const response = await userProfile.resetPassword(req.body.email);

      res.json(response);
      res.statusCode = 200;
    } catch (e) {
      res.locals.logger.error(e);
      res.statusCode = 400;
      res.json(e);
      return;
    }
  });
};
