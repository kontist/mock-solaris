/* eslint-disable @typescript-eslint/camelcase */
import _ from "lodash";
import uuid from "uuid";
import moment from "moment";
import * as db from "../db";
import { triggerWebhook } from "./webhooks";
import {
  Card,
  CardDetails,
  CardStatus,
  CardType,
  MockPerson,
  CreateCardData,
  CardLimits,
  CardLimitType,
  SolarisAPIErrorData,
  CardWebhookEvent
} from "./types";

const CARD_HOLDER_MAX_LENGTH = 21;
const CARD_HOLDER_ALLOWED_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -/.";

const MAX_TRANSACTION_DAILY = 20;
const MAX_TRANSACTION_MONTHLY = MAX_TRANSACTION_DAILY * 31;
const MAX_DAILY_AMOUNT_IN_CENTS = 800000;
const MAX_MONTHLY_AMOUNT_IN_CENTS = 6000000;

export enum CardErrorCodes {
  CARD_ACTIVATION_INVALID_STATUS = "card_activation_invalid_status",
  INVALID_VERIFICATION_TOKEN = "invalid_verification_token",
  VERIFICATION_TOKEN_TOO_LONG = "verification_token_too_long"
}

export const validateCardData = async (
  cardData: Card,
  cardDetails: CardDetails
): Promise<SolarisAPIErrorData[]> => {
  const errors = [];

  if (!CardType[cardData.type]) {
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

export const validatePersonData = async (
  person: MockPerson
): Promise<SolarisAPIErrorData[]> => {
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

export const getMaskedCardNumber = (cardNumber: string): string =>
  `${cardNumber.slice(0, 4)}********${cardNumber.slice(-4)}`;

export const createCardToken = (): string =>
  _.times(12, () => _.random(35).toString(36))
    .join("")
    .toUpperCase();

const getDefaultCardNotPresentLimits = () => ({
  daily: {
    max_amount_cents: 150000,
    max_transactions: 25
  },
  monthly: {
    max_amount_cents: 1000000,
    max_transactions: 775
  }
});

const getDefaultCardPresentLimits = () => ({
  daily: {
    max_amount_cents: 450000,
    max_transactions: 15
  },
  monthly: {
    max_amount_cents: 2500000,
    max_transactions: 465
  }
});

export const createCard = (
  cardData: CreateCardData,
  person: MockPerson
): { card: Card; cardDetails: CardDetails } => {
  const {
    pin,
    type,
    business_id: businessId = null,
    reference,
    line_1: cardHolder
  } = cardData;

  const id = uuid.v4().replace(/-/g, "");
  const expirationDate = moment().add(3, "years");
  const cardNumber = Math.random()
    .toString()
    .substr(2)
    .padEnd(16, "0")
    .substr(0, 16);

  const card = {
    id,
    type,
    status: CardStatus.PROCESSING,
    expiration_date: expirationDate.format("YYYY-MM-DD"),
    person_id: person.id,
    account_id: person.account.id,
    business_id: businessId,
    representation: {
      line_1: cardHolder,
      formatted_expiration_date: expirationDate.format("MM/YY"),
      masked_pan: getMaskedCardNumber(cardNumber)
    }
  };

  const cardDetails = {
    pin,
    reference,
    cardNumber,
    token: createCardToken(),
    cardPresentLimits: getDefaultCardPresentLimits(),
    cardNotPresentLimits: getDefaultCardNotPresentLimits(),
    cvv: Math.random()
      .toString()
      .substr(-3)
  };

  return {
    card,
    cardDetails
  };
};

export const getCards = (person: MockPerson): Card[] => {
  return ((person.account && person.account.cards) || []).map(
    ({ card }) => card
  );
};

export const changeCardStatus = async (
  { personId, accountId }: { personId: string; accountId: string },
  cardId: string,
  newCardStatus: CardStatus
): Promise<Card> => {
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
  const eventName = [
    CardStatus.BLOCKED_BY_SOLARIS,
    CardStatus.ACTIVATION_BLOCKED_BY_SOLARIS
  ].includes(newCardStatus)
    ? CardWebhookEvent.CARD_BLOCK // Card has been blocked by solarisBank
    : CardWebhookEvent.CARD_LIFECYCLE_EVENT;

  await triggerWebhook(eventName, cardData.card);

  return cardData.card;
};

export const activateCard = async (
  cardForActivation: Card,
  verificationToken: string
): Promise<Card> => {
  if (cardForActivation.status !== CardStatus.INACTIVE) {
    throw new Error(CardErrorCodes.CARD_ACTIVATION_INVALID_STATUS);
  }

  const person = await db.getPerson(cardForActivation.person_id);
  const cardIndex = person.account.cards.findIndex(
    ({ card }) => card.id === cardForActivation.id
  );

  if (verificationToken.length > 6) {
    throw new Error(CardErrorCodes.VERIFICATION_TOKEN_TOO_LONG);
  }

  const isValidToken =
    person.account.cards[cardIndex].cardDetails.token.substr(0, 6) ===
    verificationToken;

  if (!isValidToken) {
    throw new Error(CardErrorCodes.INVALID_VERIFICATION_TOKEN);
  }

  cardForActivation.status = CardStatus.ACTIVE;
  person.account.cards[cardIndex].card = cardForActivation;
  await db.savePerson(person);
  await triggerWebhook(
    CardWebhookEvent.CARD_LIFECYCLE_EVENT,
    cardForActivation
  );
  return cardForActivation;
};

export const validateCardLimits = (cardLimits: CardLimits): string | null => {
  const errors = [];

  if (
    cardLimits.daily.max_transactions > MAX_TRANSACTION_DAILY ||
    cardLimits.daily.max_amount_cents > MAX_DAILY_AMOUNT_IN_CENTS
  ) {
    errors.push(
      `limit too high. Max DAILY transactions amount: ${MAX_TRANSACTION_DAILY} and Max DAILY amount in cents: ${MAX_DAILY_AMOUNT_IN_CENTS}`
    );
  }

  if (
    cardLimits.monthly.max_transactions > MAX_TRANSACTION_MONTHLY ||
    cardLimits.monthly.max_amount_cents > MAX_MONTHLY_AMOUNT_IN_CENTS
  ) {
    errors.push(
      `limit too high. Max MONTHLY transactions amount: ${MAX_TRANSACTION_MONTHLY} and Max MONTHLY amount in cents: ${MAX_MONTHLY_AMOUNT_IN_CENTS}`
    );
  }

  if (
    cardLimits.daily.max_transactions < 0 ||
    cardLimits.daily.max_amount_cents < 0
  ) {
    errors.push(`limit negative. DAILY values cannot be negative, negative.`);
  }

  if (
    cardLimits.monthly.max_transactions < 0 ||
    cardLimits.monthly.max_amount_cents < 0
  ) {
    errors.push(`limit negative. MONTHLY values cannot be negative, negative.`);
  }

  if (errors.length) {
    return errors.join(". ");
  }

  return null;
};

export const updateCardLimits = async (
  card: Card,
  cardLimitType: CardLimitType,
  newLimits: CardLimits
) => {
  const person = await db.getPerson(card.person_id);
  const cardIndex = person.account.cards.findIndex(
    cardData => cardData.card.id === card.id
  );

  person.account.cards[cardIndex].cardDetails[
    cardLimitType === CardLimitType.PRESENT
      ? "cardPresentLimits"
      : "cardNotPresentLimits"
  ] = newLimits;
  await db.savePerson(person);
  return newLimits;
};
/* eslint-enable @typescript-eslint/camelcase */
