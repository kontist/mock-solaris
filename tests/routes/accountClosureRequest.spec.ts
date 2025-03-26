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
    };
    const subAccountTwo = {
      id: "sub-account-id-2",
      iban: "DE1234567892",
      type: AccountType.CHECKING_SUBACCOUNT,
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
            accounts: [subAccount, subAccountTwo],
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

        expect(account.status).to.equal("INACTIVE");
      });

      it("should still have one active subaccount", () => {
        const account = person.accounts.find((a) => a.id === subAccountTwo.id);

        expect(account).to.be.ok;
      });

      it("should have triggered the webhooks", () => {
        const webhookOne = triggerWebhookStub.getCall(0).args[0];
        expect(webhookOne.type).to.equal("ACCOUNT_CLOSURE_REQUEST_UPDATE");
        expect(webhookOne.payload.id).to.be.ok;
        expect(webhookOne.payload.closure_reason).to.equal("CUSTOMER_WISH");
        expect(webhookOne.payload.status).to.equal("COMPLETED");
        expect(webhookOne.payload.account_id).to.equal(subAccount.id);
        expect(webhookOne.payload.legal_closure_date).to.be.ok;

        const webhookTwo = triggerWebhookStub.getCall(1).args[0];
        expect(webhookTwo.type).to.equal("ACCOUNT_CLOSURE");
        expect(webhookTwo.payload.account_id).to.equal(subAccount.id);
        expect(webhookTwo.payload.iban).to.equal(subAccount.iban);
        expect(webhookTwo.payload.person_id).to.equal(personId);
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

        expect(account.status).to.equal("INACTIVE");
      });

      it("should have triggered the webhook", () => {
        const webhookOne = triggerWebhookStub.getCall(0).args[0];
        expect(webhookOne.type).to.equal("ACCOUNT_CLOSURE_REQUEST_UPDATE");
        expect(webhookOne.payload.id).to.be.ok;
        expect(webhookOne.payload.closure_reason).to.equal("CUSTOMER_WISH");
        expect(webhookOne.payload.status).to.equal("COMPLETED");
        expect(webhookOne.payload.account_id).to.equal(subAccount.id);
        expect(webhookOne.payload.legal_closure_date).to.be.ok;

        const webhookTwo = triggerWebhookStub.getCall(1).args[0];
        expect(webhookTwo.type).to.equal("ACCOUNT_CLOSURE");
        expect(webhookTwo.payload.account_id).to.equal(subAccount.id);
        expect(webhookTwo.payload.iban).to.equal(subAccount.iban);
        expect(webhookTwo.payload.business_id).to.equal(businessId);
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
