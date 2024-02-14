import moment from "moment";
import _ from "lodash";
import generateID from "./id";

const fetchRandomQuestion = async () => {
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

export const createQuestionSet = async (personId: string) => {
  const numberOfQuestions = Math.floor(Math.random() * 2) + 1;
  const deadline = moment().add(10, "days").toISOString();
  const questions = [];

  for (let i = 0; i < numberOfQuestions; i++) {
    questions.push({
      id: generateID(),
      question: await fetchRandomQuestion(),
      answer_type: i % 2 == 0 ? "TEXT_ONLY" : "TEXT_AND_FILES",
      deadline,
      allowed_document_types: [
        i % 2 === 0 ? "ACCOUNT_STATEMENT" : "KYC_REPORT",
      ],
    });
  }

  return {
    id: generateID(),
    entity_id: personId,
    context_id: generateID(),
    description: "some description",
    deadline,
    questions,
    recipient: {
      recipient_id: personId,
      recipient_type: "CUSTOMER",
    },
  };
};
