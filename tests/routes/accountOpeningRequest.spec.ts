import sinon from "sinon";
import { expect } from "chai";
import { mockReq, mockRes } from "sinon-express-mock";

import * as db from "../../src/db";

import * as accountOpeningRequestAPI from "../../src/routes/accountOpeningRequest";
import { createPerson } from "../../src/routes/persons";
import * as businessesAPI from "../../src/routes/business/businesses";
import {
  AccountType,
  PersonWebhookEvent,
  MockPerson,
  CustomerType,
  MockBusiness,
  ProductType,
  MockAccount,
} from "../../src/helpers/types";
import * as webhookHelpers from "../../src/helpers/webhooks";

describe("Account Opening Request", () => {
  let personId: string;
  let businessId: string;
  let triggerWebhookStub: sinon.SinonStub;
  let res: sinon.SinonSpy;
  let person: MockPerson;
  let business: MockBusiness;

  before(async () => {
    await db.flushDb();
    res = mockRes();

    triggerWebhookStub = sinon.stub(webhookHelpers, "triggerWebhook");

    await createPerson(
      {
        body: {},
        headers: {},
      },
      res
    );

    personId = res.send.args[0][0].id;

    await businessesAPI.createBusiness(
      {
        body: {
          name: "Kontist GmbH",
        },
        headers: {},
      },
      res
    );

    businessId = res.send.args[1][0].id;
  });

  after(() => {
    db.flushDb();
    triggerWebhookStub.restore();
  });

  describe("create Account Opening Request", () => {
    before(async () => {
      const req = mockReq({
        body: {
          customer_id: personId,
          customer_type: CustomerType.PERSON,
          product_name: ProductType.CURRENT_ACCOUNT_FREELANCER_GERMANY,
          account_type: AccountType.CHECKING_SOLE_PROPRIETOR,
          account_currency: "EUR",
          account_purpose: "primary",
          account_bic: process.env.SOLARIS_BIC,
        },
      });

      await accountOpeningRequestAPI.createAccountOpeningRequest(req, res);

      person = await db.getPerson(personId);
    });

    it("should return successful response", () => {
      expect(res.status.calledWith(201)).to.be.true;
    });

    it("should create an accountOpeningRequest on Person entity", async () => {
      expect(person.accountOpeningRequests).to.have.length(1);
      expect(person.accountOpeningRequests[0]).to.be.an("object");
    });

    it("should create an account for user", async () => {
      expect(person.account).to.be.an("object");
      expect(person.account.type).to.equal(
        AccountType.CHECKING_SOLE_PROPRIETOR
      );
    });

    it("should trigger webhook", () => {
      expect(triggerWebhookStub.calledOnce).to.be.true;

      const args = triggerWebhookStub.getCall(0).args[0];
      expect(args.type).to.equal(PersonWebhookEvent.ACCOUNT_OPENING_REQUEST);
      expect(args.payload.account_id).to.be.ok;
    });
  });

  describe("create Account Opening Request (business)", () => {
    before(async () => {
      const req = mockReq({
        body: {
          customer_id: businessId,
          customer_type: CustomerType.BUSINESS,
          product_name: ProductType.CURRENT_ACCOUNT_BUSINESS_GERMANY,
          account_type: AccountType.CHECKING_BUSINESS,
          account_currency: "EUR",
          account_purpose: "primary",
          account_bic: process.env.SOLARIS_BIC,
        },
      });

      await accountOpeningRequestAPI.createAccountOpeningRequest(req, res);

      business = await db.getBusiness(businessId);
    });

    it("should return successful response", () => {
      expect(res.status.calledWith(201)).to.be.true;
    });

    it("should create an accountOpeningRequest on Business entity", async () => {
      expect(business.accountOpeningRequests).to.have.length(1);
      expect(business.accountOpeningRequests[0]).to.be.an("object");
    });

    it("should create an account for business", async () => {
      expect(business.account).to.be.an("object");
      expect(business.account.type).to.equal(AccountType.CHECKING_BUSINESS);
    });

    it("should trigger webhook", () => {
      const args = triggerWebhookStub.lastCall.args[0];
      expect(args.type).to.equal(PersonWebhookEvent.ACCOUNT_OPENING_REQUEST);
      expect(args.payload.account_id).to.be.ok;
    });
  });

  describe("create Account Opening Request (person) - account type CHECKING_SUBACCOUNT", () => {
    let account: MockAccount;

    before(async () => {
      triggerWebhookStub.resetHistory();

      const req = mockReq({
        body: {
          customer_id: personId,
          customer_type: CustomerType.PERSON,
          product_name: ProductType.CURRENT_ACCOUNT_FREELANCER_GERMANY,
          account_type: AccountType.CHECKING_SUBACCOUNT,
          account_currency: "EUR",
          account_bic: process.env.SOLARIS_BIC,
        },
      });

      await accountOpeningRequestAPI.createAccountOpeningRequest(req, res);

      person = await db.getPerson(personId);
    });

    it("should return successful response", () => {
      expect(res.status.calledWith(201)).to.be.true;
    });

    it("should create an accountOpeningRequest on Person entity", () => {
      expect(person.accountOpeningRequests).to.have.length(2);
    });

    it("should create an account for user", async () => {
      expect(person.accounts).to.have.length(1);
      account = person.accounts[0];
      expect(account.type).to.equal(AccountType.CHECKING_SUBACCOUNT);
    });

    it("should trigger webhook", () => {
      expect(triggerWebhookStub.calledOnce).to.be.true;

      const args = triggerWebhookStub.getCall(0).args[0];
      expect(args.type).to.equal(PersonWebhookEvent.ACCOUNT_OPENING_REQUEST);
      expect(args.payload.account_id).to.equal(account.id);
    });
  });

  describe("retrieve Account Opening Request", () => {
    let accountOpeningRequestId: string;

    before(async () => {
      res = mockRes();

      accountOpeningRequestId = (await db.getPerson(personId))
        .accountOpeningRequests[0].id;

      const req = mockReq({
        params: {
          id: accountOpeningRequestId,
        },
      });

      await accountOpeningRequestAPI.retrieveAccountOpeningRequest(req, res);
    });
  });

  describe("retrieve Account Opening Request (Business)", () => {
    let accountOpeningRequestId: string;

    before(async () => {
      res = mockRes();

      accountOpeningRequestId = (await db.getBusiness(businessId))
        .accountOpeningRequests[0].id;

      const req = mockReq({
        params: {
          id: accountOpeningRequestId,
        },
      });

      await accountOpeningRequestAPI.retrieveAccountOpeningRequest(req, res);
    });

    it("should return successful response", () => {
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.send.getCall(0).args[0].id).to.equal(accountOpeningRequestId);
    });
  });
});
