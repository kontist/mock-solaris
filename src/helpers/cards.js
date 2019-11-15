import _ from "lodash";
import uuid from "uuid";
import * as db from "../db";
import { triggerWebhook } from "./webhooks";

export const CARD_STATUS = {
  PROCESSING: "PROCESSING",
  INACTIVE: "INACTIVE",
  ACTIVE: "ACTIVE",
  BLOCKED: "BLOCKED",
  BLOCKED_BY_SOLARIS: "BLOCKED_BY_SOLARIS",
  ACTIVATION_BLOCKED_BY_SOLARIS: "ACTIVATION_BLOCKED_BY_SOLARIS",
  CLOSED: "CLOSED",
  CLOSED_BY_SOLARIS: "CLOSED_BY_SOLARIS"
};

export const CARD_TYPE = {
  VIRTUAL_VISA_BUSINESS_DEBIT: "VIRTUAL_VISA_BUSINESS_DEBIT",
  VISA_BUSINESS_DEBIT: "VISA_BUSINESS_DEBIT",
  MASTERCARD_BUSINESS_DEBIT: "MASTERCARD_BUSINESS_DEBIT",
  VIRTUAL_MASTERCARD_BUSINESS_DEBIT: "VIRTUAL_MASTERCARD_BUSINESS_DEBIT"
};

const CARD_HOLDER_MAX_LENGTH = 21;
const CARD_HOLDER_ALLOWED_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -/.";

export const validateCardData = async (cardData, cardDetails) => {
  const errors = [];

  if (!CARD_TYPE[cardData.type]) {
    errors.push({
      id: uuid.v4(),
      status: 400,
      code: "validation_error",
      title: "Validation Error",
      detail: "type does not have a valid value",
      source: {
        field: "type",
        message: "does not have a valid value"
      }
    });
  }

  const cardHolder = cardData.representation && cardData.representation.line_1;

  if (!cardHolder) {
    errors.push({
      id: uuid.v4(),
      status: 400,
      code: "validation_error",
      title: "Validation Error",
      detail: "line_1 is missing, is empty, is invalid",
      source: {
        field: "line_1",
        message: "is missing, is empty, is invalid"
      }
    });
  } else if (cardHolder.length > CARD_HOLDER_MAX_LENGTH) {
    errors.push({
      id: uuid.v4(),
      status: 400,
      code: "validation_error",
      title: "Validation Error",
      detail: `line_1 is longer than ${CARD_HOLDER_MAX_LENGTH} characters, is invalid`,
      source: {
        field: "line_1",
        message: `is longer than ${CARD_HOLDER_MAX_LENGTH} characters, is invalid`
      }
    });
  } else {
    const hasValidChars = cardHolder
      .split("")
      .every(char => CARD_HOLDER_ALLOWED_CHARS.includes(char));

    const [firstName, lastName, ...rest] = cardHolder.split("/");

    if (!hasValidChars || !firstName || !lastName || rest.length > 0) {
      errors.push({
        id: uuid.v4(),
        status: 400,
        code: "validation_error",
        title: "Validation Error",
        detail: "line_1 is invalid",
        source: {
          field: "line_1",
          message: "is invalid"
        }
      });
    }
  }

  // check reference uniqueness
  if (await db.hasCardReference(cardDetails.reference)) {
    errors.push({
      id: uuid.v4(),
      status: 400,
      code: "validation_error",
      title: "Validation Error",
      detail: "card reference is not unique",
      source: {
        field: "reference",
        message: "card reference is not unique"
      }
    });
  }

  return errors;
};

export const validatePersonData = async person => {
  const errors = [];

  const mobileNumber = await db.getMobileNumber(person.id);
  const hasValidMobileNumber = mobileNumber && mobileNumber.verified;
  if (!hasValidMobileNumber) {
    errors.push({
      id: uuid.v4(),
      status: 400,
      code: "validation_error",
      title: "Validation Error",
      detail: "user does not have verified mobile_number",
      source: {
        field: "mobile_number",
        message: "does not have verified mobile_number"
      }
    });
  }

  return errors;
};

export const getMaskedCardNumber = number =>
  `${number.slice(0, 4)}********${number.slice(-4)}`;

export const createCardToken = () =>
  _.times(12, () => _.random(35).toString(36))
    .join("")
    .toUpperCase();

export const getCards = person => {
  return ((person.account && person.account.cards) || []).map(
    ({ card }) => card
  );
};

export const changeCardStatus = async (
  { personId, accountId },
  cardId,
  newCardStatus
) => {
  let person;

  if (personId) {
    person = await db.getPerson(personId);
  } else if (accountId) {
    person = db.findPersonByAccountId(accountId);
  } else {
    throw new Error("You have to provide personId or accountId");
  }

  if (!cardId) {
    throw new Error("You have to provide cardId");
  }

  const cardData = person.account.cards.find(({ card }) => card.id === cardId);

  if (!cardData) {
    throw new Error("Card not found");
  }

  if (cardData.card.status === newCardStatus) {
    return cardData.card;
  }

  cardData.card.status = newCardStatus;

  await db.savePerson(person);
  await triggerWebhook("CARD_LIFECYCLE_EVENT", cardData.card);

  return cardData.card;
};
