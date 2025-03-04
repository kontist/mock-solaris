import sinon from "sinon";
import { expect } from "chai";
import { mockReq, mockRes } from "sinon-express-mock";

import * as db from "../../src/db";

import { createPerson } from "../../src/routes/persons";
import { createBusiness } from "../../src/routes/business";
import { AccountType } from "../../src/helpers/types";
import * as webhookHelpers from "../../src/helpers/webhooks";
import { initiateAccountClosureRequest } from "../../src/routes/accountClosureRequest";

describe("Account Closure Request", () => {
  describe("for person account", () => {
    let personId: string;
    let person: any;
    let res: sinon.SinonSpy;
    let triggerWebhookStub: sinon.SinonStub;

    const subAccount = {
      id: "sub-account-id",
      iban: "DE1234567891",
      type: AccountType.CHECKING_SUBACCOUNT,
      legal_closure_date: null,
    };

    before(async () => {
      await db.flushDb();
      res = mockRes();

      triggerWebhookStub = sinon.stub(webhookHelpers, "triggerWebhook");

      await createPerson(
        {
          body: {
            first_name: "Dean",
            last_name: "Winchester",
            accounts: [subAccount],
          },
          headers: {},
        },
        res
      );

      personId = res.send.args[0][0].id;
    });

    after(() => {
      db.flushDb();
      triggerWebhookStub.restore();
    });

    describe("initiate Account Closure Request", async () => {
      const req = mockReq({
        body: {
          account_id: subAccount.id,
          closure_reason: "CUSTOMER_WISH",
        },
      });

      await initiateAccountClosureRequest(req, res);

      person = await db.getPerson(personId);

      it("should return succesfull response (201) on initial closure request", () => {
        expect(res.status.getCall(0).args[0]).to.equal(201);

        const response = res.send.args[1][0];
        expect(response.id).to.be.ok;
        expect(response.closure_reason).to.equal("CUSTOMER_WISH");
        expect(response.status).to.equal("INITIATED");
        expect(response.account_id).to.equal(subAccount.id);
        expect(response.legal_closure_date).to.be.null;
      });

      it("should update legal_closure_date on the sub account", () => {
        const account = person.accounts.find((a) => a.id === subAccount.id);

        expect(account.legal_closure_date).be.ok;
      });

      it("should have triggered the webhook", () => {
        const webhook = triggerWebhookStub.getCall(0).args[0];
        expect(webhook.type).to.equal("ACCOUNT_CLOSURE_REQUEST_UPDATE");
        expect(webhook.payload.id).to.be.ok;
        expect(webhook.payload.closure_reason).to.equal("CUSTOMER_WISH");
        expect(webhook.payload.status).to.equal("COMPLETED");
        expect(webhook.payload.account_id).to.equal(subAccount.id);
        expect(webhook.payload.legal_closure_date).to.be.ok;
      });

      it("should return successful response (200) on secondary closure request", async () => {
        await initiateAccountClosureRequest(req, res);

        expect(res.status.getCall(0).args[0]).to.equal(200);

        const response = res.send.args[1][0];
        expect(response.id).to.be.ok;
        expect(response.closure_reason).to.equal("CUSTOMER_WISH");
        expect(response.status).to.equal("COMPLETED");
        expect(response.account_id).to.equal(subAccount.id);
        expect(response.legal_closure_date).to.be.ok;
      });
    });
  });

  describe("for business account", () => {
    let businessId: string;
    let business: any;
    let res: sinon.SinonSpy;
    let triggerWebhookStub: sinon.SinonStub;

    const subAccount = {
      id: "sub-account-id",
      iban: "DE1234567891",
      type: AccountType.CHECKING_SUBACCOUNT,
      legal_closure_date: null,
    };

    before(async () => {
      await db.flushDb();
      res = mockRes();

      triggerWebhookStub = sinon.stub(webhookHelpers, "triggerWebhook");

      await createBusiness(
        {
          body: {
            name: "Dean",
            accounts: [subAccount],
          },
          headers: {},
        },
        res
      );

      businessId = res.send.args[0][0].id;
    });

    after(() => {
      db.flushDb();
      triggerWebhookStub.restore();
    });

    describe("initiate Account Closure Request", async () => {
      const req = mockReq({
        body: {
          account_id: subAccount.id,
          closure_reason: "CUSTOMER_WISH",
        },
      });

      await initiateAccountClosureRequest(req, res);

      business = await db.getBusiness(businessId);

      it("should return succesfull response (201) on initial closure request", () => {
        expect(res.status.getCall(0).args[0]).to.equal(201);

        const response = res.send.args[1][0];
        expect(response.id).to.be.ok;
        expect(response.closure_reason).to.equal("CUSTOMER_WISH");
        expect(response.status).to.equal("INITIATED");
        expect(response.account_id).to.equal(subAccount.id);
        expect(response.legal_closure_date).to.be.null;
      });

      it("should update legal_closure_date on the sub account", () => {
        const account = business.accounts.find((a) => a.id === subAccount.id);

        expect(account.legal_closure_date).be.ok;
      });

      it("should have triggered the webhook", () => {
        const webhook = triggerWebhookStub.getCall(0).args[0];
        expect(webhook.type).to.equal("ACCOUNT_CLOSURE_REQUEST_UPDATE");
        expect(webhook.payload.id).to.be.ok;
        expect(webhook.payload.closure_reason).to.equal("CUSTOMER_WISH");
        expect(webhook.payload.status).to.equal("COMPLETED");
        expect(webhook.payload.account_id).to.equal(subAccount.id);
        expect(webhook.payload.legal_closure_date).to.be.ok;
      });

      it("should return successful response (200) on secondary closure request", async () => {
        await initiateAccountClosureRequest(req, res);

        expect(res.status.getCall(0).args[0]).to.equal(200);

        const response = res.send.args[1][0];
        expect(response.id).to.be.ok;
        expect(response.closure_reason).to.equal("CUSTOMER_WISH");
        expect(response.status).to.equal("COMPLETED");
        expect(response.account_id).to.equal(subAccount.id);
        expect(response.legal_closure_date).to.be.ok;
      });
    });
  });

  describe("should throw", () => {
    describe("on missing account_id", () => {
      let res: sinon.SinonSpy;

      before(async () => {
        await db.flushDb();
        res = mockRes();

        const req = mockReq({
          body: {
            closure_reason: "CUSTOMER_WISH",
          },
        });

        await initiateAccountClosureRequest(req, res);
      });

      it("should return error response (400)", () => {
        const error = res.send.args[0][0];

        expect(res.status.getCall(0).args[0]).to.equal(400);
        expect(error.code).to.equal("validation_error");
        expect(error.detail).to.equal("missing required field");
      });
    });

    describe("on missing closure_reason", () => {
      let res: sinon.SinonSpy;

      before(async () => {
        await db.flushDb();
        res = mockRes();

        const req = mockReq({
          body: {
            account_id: "sub-account-id",
          },
        });

        await initiateAccountClosureRequest(req, res);
      });

      it("should return error response (400)", () => {
        const error = res.send.args[0][0];

        expect(res.status.getCall(0).args[0]).to.equal(400);
        expect(error.code).to.equal("validation_error");
        expect(error.detail).to.equal("missing required field");
      });
    });

    describe("on invalid closure_reason", () => {
      let res: sinon.SinonSpy;

      before(async () => {
        await db.flushDb();
        res = mockRes();

        const req = mockReq({
          body: {
            account_id: "sub-account-id",
            closure_reason: "INVALID_REASON",
          },
        });

        await initiateAccountClosureRequest(req, res);
      });

      it("should return error response (500)", () => {
        const error = res.send.args[0][0];

        expect(res.status.getCall(0).args[0]).to.equal(500);
        expect(error.code).to.equal("validation_error");
        expect(error.detail).to.equal("invalid closure reason");
      });
    });

    describe("on account not found", () => {
      let res: sinon.SinonSpy;

      before(async () => {
        await db.flushDb();
        res = mockRes();

        const req = mockReq({
          body: {
            account_id: "sub-account-id",
            closure_reason: "CUSTOMER_WISH",
          },
        });

        await initiateAccountClosureRequest(req, res);
      });

      it("should return error response (404)", () => {
        const error = res.send.args[0][0];

        expect(res.status.getCall(0).args[0]).to.equal(404);
        expect(error.code).to.equal("not_found");
        expect(error.detail).to.equal(
          "Account with id: sub-account-id not found"
        );
      });
    });
  });
});
