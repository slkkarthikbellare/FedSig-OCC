const { UserProfile } = require("../app/idcs/userProfile");

const TEST_USER_EMAIL = "tat-na-002@outlook.com";

describe("userProfile", () => {
  let userProfile;

  beforeAll(async () => {
    userProfile = new UserProfile();
    await userProfile.init();
  });

  it("should return a valid token", async () => {
    expect(userProfile).not.toBe(null);
    const token = await userProfile.getAccessToken();
    expect(token).not.toBe(null);
    expect(token.length > 0).toBe(true);
  });

  it("should return an existing user of email", async () => {
    const users = await userProfile.getUserByEmail("tat-na-001@outlook.com");
    expect(users).not.toBe(null);
    expect(users.totalResults).toBe(1);
  });

  it("should create a new user", async () => {
    const result = await userProfile.createUser({
      firstName: "Tat",
      lastName: "Leung",
      email: TEST_USER_EMAIL,
    });
    expect(result).not.toBe(null);
    expect(result.id).not.toBe(null);
  });

  it("should return the group details", async () => {
    const groupDetails = await userProfile.getGroupDetails("B2B");
    expect(groupDetails).not.toBe(null);
    expect(groupDetails.totalResults).toBe(1);
    // console.log(groupDetails);
  });

  it("should assign a group from user and remove it", async () => {
    let result = await userProfile.addUserToGroup(TEST_USER_EMAIL, "B2B");
    // console.log(JSON.stringify(result, null, 2));
    expect(result.displayName).toBe("B2B");

    result = await userProfile.removeUserFromGroup(TEST_USER_EMAIL, "B2B");
    // console.log(JSON.stringify(result, null, 2));
    expect(result.displayName).toBe("B2B");
  }, 60000);

  it.only("should generate a reset password request", async () => {
    const result = await userProfile.resetPassword(TEST_USER_EMAIL);
    console.log(result);
  }, 60000);
});
