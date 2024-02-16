import sinon from "sinon";
import { expect } from "chai";
import { mockReq, mockRes } from "sinon-express-mock";

import * as db from "../../src/db";
import * as webhooks from "../../src/helpers/webhooks";
import {
  CustomerVettingStatus,
  PersonWebhookEvent,
} from "../../src/helpers/types";
import { answerQuestion, listQuestions } from "../../src/routes/questions";

describe("Question Set Routes", () => {
  let savePersonStub: sinon.SinonStub;
  let triggerWebhookStub: sinon.SinonStub;
  let sandbox: sinon.SinonSandbox;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    sandbox.stub(db, "getPersonIdByQuestionSetId").resolves("personId");
    sandbox.stub(db, "getPerson").resolves({
      id: "personId",
      questionSet: {
        id: "questionSetId",
        questions: [
          {
            id: "questionId",
            answer: null,
          },
        ],
      },
      customer_vetting_status: CustomerVettingStatus.CUSTOMER_UNRESPONSIVE,
    });
    savePersonStub = sandbox.stub(db, "savePerson").resolves();
    triggerWebhookStub = sandbox.stub(webhooks, "triggerWebhook").resolves();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("listQuestions", () => {
    it("should list questions for a given question set", async () => {
      const req = mockReq({
        params: { question_set_id: "questionSetId" },
      });
      const res = mockRes();

      await listQuestions(req, res);

      expect(res.json.calledOnce).to.be.true;
      const responseArg = res.json.firstCall.args[0];
      expect(responseArg.id).to.equal("questionSetId");
    });
  });

  describe("answerQuestion", () => {
    it("should save an answer for a given question and set customer vetting status if all questions are answered", async () => {
      const req = mockReq({
        params: { question_set_id: "questionSetId" },
        body: {
          question_id: "questionId",
          response: "Answer",
          partner_notes: "Notes",
          attachments: ["attachment"],
          ready_for_review: true,
        },
      });
      const res = mockRes();

      await answerQuestion(req, res);

      expect(savePersonStub.calledOnce).to.be.true;
      expect(triggerWebhookStub.lastCall.args[0].type).to.equal(
        PersonWebhookEvent.PERSON_CHANGED
      );
      const responseArg = res.json.firstCall.args[0];
      expect(responseArg.answer.response).to.equal("Answer");
    });
  });
});
