import sinon from "sinon";
import { expect } from "chai";
import { mockReq, mockRes } from "sinon-express-mock";

import * as db from "../../src/db";

import * as accountOpeningRequestAPI from "../../src/routes/accountOpeningRequest";
import { createPerson } from "../../src/routes/persons";
import {
  AccountType,
  PersonWebhookEvent,
  MockPerson,
} from "../../src/helpers/types";
import * as webhookHelpers from "../../src/helpers/webhooks";

describe("Account Opening Request", () => {
  let personId: string;
  let triggerWebhookStub: sinon.SinonStub;
  let res: sinon.SinonSpy;
  let person: MockPerson;

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
          customer_type: "person",
          product_name: "CURRENT_ACCOUNT_FREELANCER_GERMANY",
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
    });

    it("should trigger webhook", () => {
      expect(triggerWebhookStub.calledOnce).to.be.true;

      const args = triggerWebhookStub.getCall(0).args[0];
      expect(args.type).to.equal(PersonWebhookEvent.ACCOUNT_OPENING_REQUEST);
      expect(args.payload.account_id).to.be.ok;
    });
  });

  describe("retrieve Account Opening Request", () => {
    let accountOpeningRequestId;

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

    it("should return successful response", () => {
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.send.getCall(0).args[0].id).to.equal(accountOpeningRequestId);
    });
  });
});
