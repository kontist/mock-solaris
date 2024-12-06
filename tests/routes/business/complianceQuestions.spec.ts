import { expect } from "chai";
import sinon from "sinon";
import { mockReq, mockRes } from "sinon-express-mock";
import * as db from "../../../src/db";
import * as complianceAPI from "../../../src/routes/business/complianceQuestions";
import {
  BusinessIdentification,
  BusinessIdentificationStatus,
  LegalIdentificationStatus,
} from "../../../src/helpers/types";
import generateID from "../../../src/helpers/id";
import * as qa from "../../../src/helpers/questionsAndAnswers";
import * as businessesAPI from "../../../src/routes/business/businesses";
import * as businessIdentAPI from "../../../src/routes/business";
import { createPerson } from "../../../src/routes/persons";

describe("Compliance Questions API", () => {
  let res: sinon.SinonSpy;
  let businessId: string;
  let businessIdentification: BusinessIdentification;
  let req: sinon.SinonSpy;
  let sandbox: sinon.SinonSandbox;
  let saveBusinessSpy: sinon.SinonSpy;

  const setupBusinessAndIdentification = async () => {
    await db.flushDb();

    res = mockRes();
    req = mockReq({
      body: {
        email: "superuser@kontist.com",
      },
      headers: {},
    });
    await createPerson(req, res);

    const personId = res.send.lastCall.args[0].id;

    await businessesAPI.createBusiness(
      {
        body: {
          name: "Test Business",
        },
      },
      res
    );
    businessId = res.send.lastCall.args[0].id;

    req = mockReq({
      params: {
        business_id: businessId,
      },
      business: {
        id: businessId,
        legalRepresentatives: [
          {
            id: "rep123",
            legal_representative_id: personId,
            identifications: [{ id: "ident123" }],
          },
        ],
      },
    });

    await businessIdentAPI.createBusinessIdentification(req, res);
    businessIdentification = res.send.lastCall.args[0];
  };

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    await setupBusinessAndIdentification();
    res = mockRes();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("listComplianceQuestions", () => {
    beforeEach(async () => {
      req = mockReq({
        businessIdentification,
        business: {
          id: businessId,
          identifications: [
            {
              ...businessIdentification,
              meta: {
                complianceQuestions: [
                  {
                    question_id: generateID(),
                    question_text: "Sample Question?",
                    legal_identification_id: "ident123",
                    business_identification_id: businessIdentification.id,
                    business_id: businessId,
                    asked_at: new Date().toISOString(),
                    answer_id: generateID(),
                    answer_text: "Answer",
                    answered_at: new Date().toISOString(),
                  },
                ],
              },
            },
          ],
        },
      });

      sandbox.stub(qa, "fetchRandomQuestion").resolves("Sample Question?");
      saveBusinessSpy = sandbox.spy(db, "saveBusiness");
      await complianceAPI.listComplianceQuestions(req, res);
    });

    it("should return generated compliance questions", () => {
      const response = res.send.lastCall.args[0];
      expect(response).to.be.an("array").with.lengthOf(1);
      expect(response[0]).to.have.property("question_text", "Sample Question?");
    });

    it("should save questions in businessIdentification meta", async () => {
      expect(saveBusinessSpy.calledOnce).to.be.true;
      expect(
        saveBusinessSpy.lastCall.args[0].identifications[0].meta
          .complianceQuestions
      )
        .to.be.an("array")
        .with.lengthOf(1);
    });
  });

  describe("answerComplianceQuestion", () => {
    let questionId: string;

    beforeEach(async () => {
      saveBusinessSpy = sandbox.spy(db, "saveBusiness");

      const identification = {
        ...businessIdentification,
        meta: {
          complianceQuestions: [
            {
              question_id: generateID(),
              question_text: "Sample Question?",
              legal_identification_id: "ident123",
              business_identification_id: businessIdentification.id,
              business_id: businessId,
              asked_at: new Date().toISOString(),
              answer_id: null,
              answer_text: null,
              answered_at: null,
            },
          ],
        },
      };

      req = mockReq({
        businessIdentification: identification,
        params: {
          question_id: identification.meta.complianceQuestions[0].question_id,
        },
        business: { id: businessId, identifications: [identification] },
        body: { text: "Sample Answer" },
      });

      questionId = req.params.question_id;
      await complianceAPI.answerComplianceQuestion(req, res);

      expect(saveBusinessSpy.calledOnce).to.be.true;
      const answer =
        saveBusinessSpy.lastCall.args[0].identifications[0].meta
          .complianceQuestions[0];

      expect(answer).to.have.property("answer_text", "Sample Answer");
      expect(answer).to.have.property("answered_at").that.is.a("string");
    });

    it("should return the answered question with answer details", () => {
      const response = res.send.lastCall.args[0];
      expect(response).to.have.property("answer_text", "Sample Answer");
      expect(response).to.have.property("answer_id").that.is.a("string");
      expect(response).to.have.property("answered_at").that.is.a("string");
    });

    it("should throw an error if question is not found", async () => {
      req = mockReq({
        businessIdentification,
        params: { question_id: "non-existent-id" },
        business: { id: businessId },
        body: { text: "Sample Answer" },
      });

      await complianceAPI.answerComplianceQuestion(req, res);
      const response = res.send.lastCall.args[0];
      expect(response.errors[0]).to.have.property("status", 404);
    });
  });

  describe("markLegalIdentificationAsReady", () => {
    beforeEach(async () => {
      saveBusinessSpy = sandbox.spy(db, "saveBusiness");

      const identification = {
        ...businessIdentification,
        meta: {
          complianceQuestions: [
            {
              question_id: generateID(),
              question_text: "Sample Question?",
              legal_identification_id: "ident123",
              business_identification_id: businessIdentification.id,
              business_id: businessId,
              asked_at: new Date().toISOString(),
              answer_id: generateID(),
              answer_text: "Answer",
              answered_at: new Date().toISOString(),
            },
          ],
        },
      };

      req = mockReq({
        businessIdentification: identification,
        business: { id: businessId, identifications: [identification] },
      });
      await complianceAPI.markLegalIdentificationAsReady(req, res);
    });

    it("should update status of business identification", () => {
      const response = res.send.lastCall.args[0];
      expect(response).to.have.property(
        "status",
        BusinessIdentificationStatus.CREATED
      );

      expect(saveBusinessSpy.calledOnce).to.be.true;
      expect(
        saveBusinessSpy.lastCall.args[0].identifications[0]
          .legal_identification_status
      ).to.equal(LegalIdentificationStatus.PENDING);
    });
  });
});
