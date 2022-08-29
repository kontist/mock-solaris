import { expect } from "chai";
import { getWebhookUrl } from "../../src/helpers/webhooks";

describe("webhook helpers", () => {
  describe("getWebhookUrl", () => {
    const webhookUrl = "http://localhost:4000/api/webhook/card";

    describe("when origin is not provided", () => {
      it("should return not modified webhookUrl", () => {
        expect(getWebhookUrl(webhookUrl)).to.equal(webhookUrl);
      });
    });

    describe("when origin is provided", () => {
      it("should return modified webhookUrl", () => {
        const origin = "https://test-server.com/";
        const expectedUrl = "https://test-server.com/api/webhook/card";
        expect(getWebhookUrl(webhookUrl, origin)).to.equal(expectedUrl);
      });
    });
  });
});
