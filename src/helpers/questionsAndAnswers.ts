import moment from "moment";
import _ from "lodash";

import generateID from "./id";

export const fetchRandomQuestion = async () => {
  const getQuestion = async () => {
    try {
      const response = await fetch(
        "https://the-trivia-api.com/v2/questions?limit=1"
      );
      const data = await response.json();
      const answers = _.shuffle([
        data[0].correctAnswer,
        ...data[0].incorrectAnswers,
      ]);

      // return single line with question and available options, but with number prefix based on comment structure
      const questionText = `${data[0].question.text}\n${answers
        .map((answer, index) => `${index + 1}. ${answer}`)
        .join("\n")}`;

      return questionText;
    } catch (err) {
      return "SAMPLE QUESTION";
    }
  };

  const result = (await Promise.race([
    getQuestion(),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ])) as string;

  return result;
};

export const createQuestionSet = async (personId: string) => {
  // remove time
  const deadline = moment().add(10, "days").toISOString().split("T")[0];
  const questions = [
    {
      id: generateID(),
      question: await fetchRandomQuestion(),
      answer_type: "TEXT_ONLY",
      deadline,
      allowed_document_types: ["KYC_REPORT", "ACCOUNT_STATEMENT"],
    },
    {
      id: generateID(),
      question: await fetchRandomQuestion(),
      answer_type: "TEXT_AND_FILES",
      deadline,
      allowed_document_types: ["ACCOUNT_STATEMENT", "KYC_REPORT"],
    },
  ];

  return {
    id: generateID(),
    entity_id: personId,
    context_id: generateID(),
    description: "Very fancy description",
    deadline,
    questions,
    recipient: {
      recipient_id: personId,
      recipient_type: "CUSTOMER",
    },
  };
};
