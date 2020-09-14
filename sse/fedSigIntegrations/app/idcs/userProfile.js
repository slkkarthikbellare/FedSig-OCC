// @ ts-check

const axios = require("axios");
const qs = require("qs");
const config = require("../config");

class UserProfile {
  constructor(logger) {
    this.logger = logger ? logger : console;
    this.accessToken = null;
    this.idcsHost = null;
  }

  /**
   * Initalize the class by obtaining an access token from IDCS and save it
   */
  async init() {
    this.idcsHost = config.get("idcs:host");
    const clientID = config.get("idcs:clientID");
    const clientSecret = config.get("idcs:clientSecret");
    const secret = Buffer.from(`${clientID}:${clientSecret}`).toString(
      "base64"
    );
    const data = qs.stringify({
      grant_type: "client_credentials",
      scope: "urn:opc:idm:__myscopes__",
    });
    const options = {
      url: `${this.idcsHost}/oauth2/v1/token`,
      method: "POST",
      headers: {
        Authorization: `Basic ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data,
    };
    try {
      var resp = await axios(options);
      this.accessToken = resp.data.access_token;
    } catch (e) {
      this.logger.error(e);
      return null;
    }
  }

  async process(data) {
    const profile = data.profile;

    // check if user exist
    const userResp = await this.getUserByEmail(profile.email);
    let resp = {};
    if (userResp.totalResults < 1) {
      resp = await this.createUser(profile);
      if (resp.isAxiosError) {
        return resp;
      }
    }
    resp = await this.updateUser(profile);

    return resp;
  }

  async updateUser(profile) {
    var groupName = "B2C";
    if (profile.profileType === "b2b_user") {
      groupName = "B2B";
    }

    if (profile.active) {
      return await this.addUserToGroup(profile.email, groupName);
    } else {
      return await this.removeUserFromGroup(profile.email, groupName);
    }
  }

  /**
   * Return the access token if it exist.  If not, reinitialize it.
   */
  async getAccessToken() {
    if (!this.accessToken) {
      this.init();
    }
    return this.accessToken;
  }

  /**
   * Get the IDCS user detail of the given email
   * @param {*} email
   */
  async getUserByEmail(email) {
    var options = {
      method: "get",
      url: `${this.idcsHost}/admin/v1/Users?filter=userName eq "${email}"`,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    };

    const resp = await axios(options);
    return resp.data;
  }

  /**
   * Create a new of with the information in "user".
   * @param {*} user
   */
  async createUser(user) {
    const data = {
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
      name: {
        givenName: user.firstName,
        familyName: user.lastName,
      },
      userName: user.email,
      emails: [
        {
          value: user.email,
          type: "work",
          primary: true,
        },
        {
          value: user.email,
          primary: false,
          type: "recovery",
        },
      ],
    };

    const options = {
      url: `${this.idcsHost}/admin/v1/Users`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      data: JSON.stringify(data),
    };

    try {
      const resp = await axios(options);
      return resp.data;
    } catch (e) {
      this.logger.error(e.response.data);
      return e;
    }
  }

  /**
   * Retrieve the details of the group with the given groupName.
   * @param {*} groupName
   */
  async getGroupDetails(groupName) {
    var options = {
      method: "get",
      url: `${this.idcsHost}/admin/v1/Groups?filter=displayName eq "${groupName}"`,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    };

    const resp = await axios(options);
    return resp.data;
  }

  /**
   * Add the user with email to group with groupName
   * @param {*} email
   * @param {*} groupName
   */
  async addUserToGroup(email, groupName) {
    const user = await this.getUserByEmail(email);
    const group = await this.getGroupDetails(groupName);
    const data = {
      schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
      Operations: [
        {
          op: "add",
          path: "members",
          value: [
            {
              value: user.Resources[0].id,
              type: "User",
            },
          ],
        },
      ],
    };

    const options = {
      url: `${this.idcsHost}/admin/v1/Groups/${group.Resources[0].id}`,
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      data: JSON.stringify(data),
    };

    try {
      const resp = await axios(options);
      return resp.data;
    } catch (e) {
      this.logger.error(e.response.data);
      return e;
    }
  }

  /**
   * Remove user with email from group with groupName
   * @param {*} email
   * @param {*} groupName
   */
  async removeUserFromGroup(email, groupName) {
    const user = await this.getUserByEmail(email);
    const group = await this.getGroupDetails(groupName);
    const data = {
      schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
      Operations: [
        {
          op: "remove",
          path: `members[value eq "${user.Resources[0].id}"]`,
        },
      ],
    };

    const options = {
      url: `${this.idcsHost}/admin/v1/Groups/${group.Resources[0].id}`,
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      data: JSON.stringify(data),
    };

    try {
      const resp = await axios(options);
      return resp.data;
    } catch (e) {
      this.logger.error(e.response.data);
      return e;
    }
  }

  async resetPassword(email) {
    const user = await this.getUserByEmail(email);
    const data = {
      schemas: [
        "urn:ietf:params:scim:schemas:oracle:idcs:UserPasswordResetter",
      ],
    };
    const options = {
      method: "PUT",
      url: `${this.idcsHost}/admin/v1/UserPasswordResetter/${user.Resources[0].id}`,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      data: JSON.stringify(data),
    };
    try {
      const resp = await axios(options);
      return resp.data;
    } catch (e) {
      this.logger.error(e.response.data);
      return e;
    }
  }
}

module.exports = {
  UserProfile,
};
