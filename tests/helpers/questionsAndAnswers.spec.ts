import { expect } from "chai";
import sinon from "sinon";
import _ from "lodash";
import moment from "moment";

import {
  createQuestionSet,
  fetchRandomQuestion,
} from "../../src/helpers/questionsAndAnswers";

const globalAny: any = global;
globalAny.fetch = fetch;

describe("Question Set Tests", () => {
  beforeEach(() => {
    sinon.stub(global, "fetch");
    sinon.stub(_, "shuffle").callsFake((array) => array);
    sinon.stub(moment.prototype, "add").returns({
      toISOString: () => "2024-02-26T00:00:00.000Z",
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("fetchRandomQuestion", () => {
    it("should fetch a random question and format it correctly", async () => {
      (global.fetch as any).resolves({
        json: () =>
          Promise.resolve([
            {
              question: { text: "Sample Question?" },
              correctAnswer: "Correct",
              incorrectAnswers: ["Wrong 1", "Wrong 2"],
            },
          ]),
      });

      const question = await fetchRandomQuestion();
      expect(question).to.include("Sample Question?");
      expect(question).to.include("1. Correct");
      expect(question).to.include("2. Wrong 1");
      expect(question).to.include("3. Wrong 2");
    });
  });

  describe("createQuestionSet", () => {
    it("should create a question set with the correct structure for a given personId", async () => {
      (global.fetch as any).resolves({
        json: () =>
          Promise.resolve([
            {
              question: { text: "Another Sample Question?" },
              correctAnswer: "Right",
              incorrectAnswers: ["Incorrect 1", "Incorrect 2"],
            },
          ]),
      });

      const personId = "person-id";
      const questionSet = await createQuestionSet(personId);
      expect(questionSet).to.have.property("id");
      expect(questionSet).to.have.property("entity_id").that.equals(personId);
      expect(questionSet.questions).to.have.lengthOf(2);
      expect(questionSet.questions[0].question).to.include(
        "Another Sample Question?"
      );
      expect(questionSet.deadline).to.equal("2024-02-26");
    });
  });
});
