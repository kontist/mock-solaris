import sinon from "sinon";
import { expect } from "chai";
import { mockReq, mockRes } from "sinon-express-mock";

import * as db from "../../src/db";
import {
  createMaps,
  queueBookingRequestHandler,
  updatePersonHandler,
} from "../../src/routes/backoffice";
import * as webhooks from "../../src/helpers/webhooks";
import * as questionHelpers from "../../src/helpers/questionsAndAnswers";
import {
  CustomerVettingStatus,
  PersonWebhookEvent,
  RiskClarificationStatus,
} from "../../src/helpers/types";

describe("Backoffice", () => {
  describe("createMaps", () => {
    let req: sinon.SinonSpy;
    let res: sinon.SinonSpy;
    const personId = "person_id";
    const accountId = "account_id";
    const deviceId = "device_id";
    const iban = "DE1234";
    const person = {
      id: personId,
      createdAt: "2020-01-01",
      account: {
        id: accountId,
        iban,
      },
    };
    const device = {
      id: deviceId,
      person_id: personId,
    };

    after(db.flushDb);
    before(async () => {
      await db.flushDb();
      await db.savePerson(person);
      await db.saveDevice(device);

      res = mockRes();
      req = mockReq({
        body: {
          devices: true,
          accounts: true,
          sortPersons: true,
        },
      });

      await createMaps(req, res);
    });

    it("should return HTTP 201", async () => {
      expect(res.status.args[0][0]).to.equal(201);
    });

    it("should set proper map values in redis", async () => {
      const devices = await db.getDevicesByPersonId(personId);
      expect(devices[0].id).to.equal(deviceId);
      const fetchedPersonById = await db.findPersonByAccount({ id: accountId });
      expect(fetchedPersonById.id).to.equal(personId);
      const fetchedPersonByIBAN = await db.findPersonByAccount({ iban });
      expect(fetchedPersonByIBAN.id).to.equal(personId);
    });
  });

  describe("queueBookingRequestHandler()", () => {
    before(async () => {
      await db.flushDb();
      await db.savePerson({
        id: "person_id",
        createdAt: "2020-01-01",
        account: {
          id: "account_id",
          iban: "iban",
        },
      });
    });
    it("Should return HTTP 201 when the input is valid, ", async () => {
      const req = mockReq({
        headers: { accept: "application/json" },
        params: {
          personId: "person_id",
        },
        body: {
          amount: 999999999,
          purpose: "purpose_9433",
          bookingType: "SEPA_CREDIT_TRANSFER",
          processed: true,
          iban: "DE17050536539501705053",
        },
      });
      const res = mockRes();
      await queueBookingRequestHandler(req, res);
      expect(res.status.args[0][0]).to.equal(201);
    });
  });

  describe("updatePersonHandler", () => {
    describe("question sets", () => {
      let sandbox: sinon.SinonSandbox;

      beforeEach(async () => {
        await db.flushDb();
        await db.savePerson({
          id: "personId",
          createdAt: "2020-01-01",
          account: {
            id: "accountId",
            iban: "iban",
          },
        });
        sandbox = sinon.createSandbox();
        sandbox.stub(db, "savePerson").resolves();
        sandbox.stub(db, "deleteMobileNumber").resolves();
        sandbox.stub(db, "saveQuestionSetIdToPersonId").resolves();
        sandbox.stub(webhooks, "triggerWebhook").resolves();
        sandbox.stub(questionHelpers, "createQuestionSet").resolves({
          id: "newQuestionSetId",
          questions: [],
        });
      });

      afterEach(async () => {
        sandbox.restore();
        await db.flushDb();
      });

      it("should create a question set if customer vetting status requires it", async () => {
        const req = mockReq({
          params: { id: "personId" },
          body: {
            customer_vetting_status:
              CustomerVettingStatus.INFORMATION_REQUESTED,
          },
        });
        const res = mockRes();

        await updatePersonHandler(req, res);

        expect(
          (questionHelpers.createQuestionSet as any).lastCall.args[0]
        ).to.eq("personId");
        expect((db.saveQuestionSetIdToPersonId as any).lastCall.args[0]).to.eq(
          "personId"
        );
        expect((db.saveQuestionSetIdToPersonId as any).lastCall.args[1]).to.eq(
          "newQuestionSetId"
        );
        expect((webhooks.triggerWebhook as any).callCount).to.equal(2);
        expect((webhooks.triggerWebhook as any).lastCall.args[0].type).to.equal(
          PersonWebhookEvent.QUESTIONS_REQUIRE_RESPONSE
        );
      });

      it("should create a question set if risk classification status requires it", async () => {
        const req = mockReq({
          params: { id: "personId" },
          body: {
            risk_classification_status:
              RiskClarificationStatus.INFORMATION_REQUESTED,
          },
        });
        const res = mockRes();

        await updatePersonHandler(req, res);

        expect(
          (questionHelpers.createQuestionSet as any).lastCall.args[0]
        ).to.eq("personId");
        expect((db.saveQuestionSetIdToPersonId as any).lastCall.args[0]).to.eq(
          "personId"
        );
        expect((db.saveQuestionSetIdToPersonId as any).lastCall.args[1]).to.eq(
          "newQuestionSetId"
        );
        expect((webhooks.triggerWebhook as any).callCount).to.equal(2);
        expect((webhooks.triggerWebhook as any).lastCall.args[0].type).to.equal(
          PersonWebhookEvent.QUESTIONS_REQUIRE_RESPONSE
        );
      });
    });
  });
});
