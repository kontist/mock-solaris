import { expect } from "chai";
import sinon from "sinon";
import { mockReq, mockRes } from "sinon-express-mock";

import { generateOAuth2Token } from "../../src/routes/oauth";

describe("generateOAuth2Token", () => {
  let clock;
  let clientId;
  let clientSecret;

  before(() => {
    clock = sinon.useFakeTimers(new Date("2023-01-01T00:00:00.000Z").getTime());
    clientId = process.env.SOLARIS_CLIENT_ID_OAUTH2;
    clientSecret = process.env.SOLARIS_CLIENT_SECRET_OAUTH2;
  });

  after(() => {
    clock.restore();
    process.env.SOLARIS_CLIENT_ID_OAUTH2 = clientId;
    process.env.SOLARIS_CLIENT_SECRET_OAUTH2 = clientSecret;
  });

  describe("for request with valid credentials", () => {
    it("should return 201", async () => {
      // Arrange
      process.env.SOLARIS_CLIENT_ID_OAUTH2 = "123pZW50aWRjbGllbnRpZAo";
      process.env.SOLARIS_CLIENT_SECRET_OAUTH2 = "d0VjcmV0c2VjsmV0c2VjcmV0Cv";
      const auth = `Basic ${Buffer.from(
        `${process.env.SOLARIS_CLIENT_ID_OAUTH2}:${process.env.SOLARIS_CLIENT_SECRET_OAUTH2}`
      ).toString("base64")}`;
      const headers = {
        "content-type": "application/x-www-form-urlencoded",
        authorization: auth,
      };
      const req = mockReq({
        headers,
        body: new URLSearchParams({
          grant_type: "client_credentials",
          scope: "partners",
        }),
      });
      req.get = (header: string) => headers[header.toLowerCase()];

      const res = mockRes();

      // Act
      await generateOAuth2Token(req, res);

      // Assert
      expect(res.status.args[0][0]).to.equal(201);
      expect(res.send.args[0][0]).to.deep.equal({
        token_type: "bearer",
        expires_in: 1672534799000,
        scope: "partners",
        access_token: "MTY3MjUzMTIwMDAwMDoxNjcyNTM0Nzk5MDAw",
      });
    });
  });

  describe("for request with invalid credentials", () => {
    it("should return 401", async () => {
      const auth = `Basic ${Buffer.from(`abc:def`).toString("base64")}`;

      // Arrange
      const headers = {
        "content-type": "application/x-www-form-urlencoded",
        authorization: auth,
      };
      const req = mockReq({
        headers,
        body: new URLSearchParams({
          grant_type: "client_credentials",
          scope: "partners",
        }),
      });
      req.get = (header: string) => headers[header.toLowerCase()];

      const res = mockRes();

      // Act
      await generateOAuth2Token(req, res);

      // Assert
      expect(res.status.args[0][0]).to.equal(401);
      expect(res.send.args[0][0]).to.equal("Unauthorized");
    });
  });
});
