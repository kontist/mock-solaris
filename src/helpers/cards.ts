/* eslint-disable @typescript-eslint/camelcase */
import _ from "lodash";
import uuid from "uuid";
import moment from "moment";
import HttpStatusCodes from "http-status";
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
  CardWebhookEvent,
  ChangeRequestStatus,
  MockChangeRequest,
  CardSettings,
  ReplaceCardData,
} from "./types";

const CARD_HOLDER_MAX_LENGTH = 21;
const CARD_HOLDER_ALLOWED_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -/.";

const CARD_PRESENT_DAILY_MAX_NUMBER_TRANSACTIONS = 20;
const CARD_PRESENT_MONTHLY_MAX_NUMBER_TRANSACTIONS = 200;
const CARD_NOT_PRESENT_DAILY_MAX_NUMBER_TRANSACTIONS = 20;
const CARD_NOT_PRESENT_MONTHLY_MAX_NUMBER_TRANSACTIONS = 200;

const DEFAULT_CARD_PRESENT_DAILY_MAX_NUMBER_TRANSACTIONS = 10;
const DEFAULT_CARD_PRESENT_MONTHLY_MAX_NUMBER_TRANSACTIONS = 100;
const DEFAULT_CARD_NOT_PRESENT_DAILY_MAX_NUMBER_TRANSACTIONS = 10;
const DEFAULT_CARD_NOT_PRESENT_MONTHLY_MAX_NUMBER_TRANSACTIONS = 100;

const CARD_PRESENT_DAILY_MAX_AMOUNT_IN_CENTS = 10000 * 100;
const CARD_PRESENT_MONTHLY_MAX_AMOUNT_IN_CENTS = 25000 * 100;
const CARD_NOT_PRESENT_DAILY_MAX_AMOUNT_IN_CENTS = 10000 * 100;
const CARD_NOT_PRESENT_MONTHLY_MAX_AMOUNT_IN_CENTS = 25000 * 100;

const DEFAULT_CARD_PRESENT_DAILY_MAX_AMOUNT_IN_CENTS = 5000 * 100;
const DEFAULT_CARD_PRESENT_MONTHLY_MAX_AMOUNT_IN_CENTS = 10000 * 100;
const DEFAULT_CARD_NOT_PRESENT_DAILY_MAX_AMOUNT_IN_CENTS = 5000 * 100;
const DEFAULT_CARD_NOT_PRESENT_MONTHLY_MAX_AMOUNT_IN_CENTS = 10000 * 100;
const SOLARIS_HARDCODED_WALLET_PAYLOAD =
  "eyJhbGciOiJBMjU2R0NNS1ciLCJjaGFubmVsU2VjdXJpdHlDb250ZXh0IjoiU0hBUkVEX1NFQ1JFVCIsImVuYyI6IkEyNTZHQ00iLCJpYXQiOjE1ODA4MTM2NjQsIml2IjoiRm44OENLQUFlTG1KdHhNbiIsImtpZCI6IjhTTU5BWkRZTVFIQUFNNFU3S1ZZMTNDN0NlajVqdEVZbFI1MFhGRTdJd0R4RG9idE0iLCJ0YWciOiJVdGNXRTlwWWdKR1VWUDRoZFJFd3pBIiwidHlwIjoiSk9TRSJ9.Qm5IAXivznZnnDupvWt7JRg7retEIjA4CWRGRaiTpqw.AbNpQJbPzfTp3NyE.PHHBPrH44IKlnuhzdbhJ_wDAuptLP41RfYqsK26yZP8acPlm3ThNYGZbvTXZE1w7d-AKWIHS2UZo1BDEoNsrMT9JeITyWjEyPRfcLmDAe3XU7g5QE-LzwJaB-O8zBWU02LC5qjIHfSTG-zJEBrIn0QZONG7mYnEob9jB1c7WKDtfbRH4Fi0eChRQY20xzsMDRwXn2NjFTPfctGeBUj8hUIuvrWDy5SAKSW-zbEPRnyN4aKutrSarf_Gfdi_ufGlfbC2Ad-ImHzg2TOEQNgN3OUaNkfHEhFxV8-4hS5K7SPMUFSNPnHRy7Ffcg4Btc6RgSNTvykVfGrz8fAdzv5Yxmq-3aJ9BH3of5J7DN0ws6iX67lcpCHvJh6bGJ0iCl3bVE6a9BTHR3vr1lJhS16k8rTfnHyrLwJpsjQa9KfVsjLIEmw.PFLc9sbT7ljf-f3nT5knnw";

export const CHANGE_REQUEST_CHANGE_CARD_PIN = "card_pin";

export enum CardErrorCodes {
  CARD_ACTIVATION_INVALID_STATUS = "card_activation_invalid_status",
  INVALID_VERIFICATION_TOKEN = "invalid_verification_token",
  VERIFICATION_TOKEN_TOO_LONG = "verification_token_too_long",
}

export const validateCardData = async (
  cardData: Card,
  cardDetails?: CardDetails
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
        message: "does not have a valid value",
      },
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
        message: "is missing, is empty, is invalid",
      },
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
        message: `is longer than ${CARD_HOLDER_MAX_LENGTH} characters, is invalid`,
      },
    });
  } else {
    const hasValidChars = cardHolder
      .split("")
      .every((char) => CARD_HOLDER_ALLOWED_CHARS.includes(char));

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
          message: "is invalid",
        },
      });
    }
  }

  if (cardDetails) {
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
          message: "card reference is not unique",
        },
      });
    }
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
        message: "does not have verified mobile_number",
      },
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
    max_amount_cents: DEFAULT_CARD_NOT_PRESENT_DAILY_MAX_AMOUNT_IN_CENTS,
    max_transactions: DEFAULT_CARD_NOT_PRESENT_DAILY_MAX_NUMBER_TRANSACTIONS,
  },
  monthly: {
    max_amount_cents: DEFAULT_CARD_NOT_PRESENT_MONTHLY_MAX_AMOUNT_IN_CENTS,
    max_transactions: DEFAULT_CARD_NOT_PRESENT_MONTHLY_MAX_NUMBER_TRANSACTIONS,
  },
});

const getDefaultCardPresentLimits = () => ({
  daily: {
    max_amount_cents: DEFAULT_CARD_PRESENT_DAILY_MAX_AMOUNT_IN_CENTS,
    max_transactions: DEFAULT_CARD_PRESENT_DAILY_MAX_NUMBER_TRANSACTIONS,
  },
  monthly: {
    max_amount_cents: DEFAULT_CARD_PRESENT_MONTHLY_MAX_AMOUNT_IN_CENTS,
    max_transactions: DEFAULT_CARD_PRESENT_MONTHLY_MAX_NUMBER_TRANSACTIONS,
  },
});

const getDefaultCardDetails = () => ({
  token: createCardToken(),
  cardPresentLimits: getDefaultCardPresentLimits(),
  cardNotPresentLimits: getDefaultCardNotPresentLimits(),
  cvv: Math.random().toString().substr(-3),
  settings: {
    contactless_enabled: true,
  },
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
    line_1: cardHolder,
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
      masked_pan: getMaskedCardNumber(cardNumber),
    },
  };

  const cardDetails = {
    pin,
    reference,
    cardNumber,
    ...getDefaultCardDetails(),
  };

  return {
    card,
    cardDetails,
  };
};

export const replaceCard = (
  cardData: ReplaceCardData,
  card: Card,
  cardDetails: CardDetails
): { card: Card; cardDetails: CardDetails } => {
  const newCard: Card = {
    ...card,
    representation: {
      ...card.representation,
      line_1: cardData.line_1 || card.representation.line_1,
    },
    status: CardStatus.PROCESSING,
  };

  const newCardDetails = {
    ...cardDetails,
    pin: cardData.pin || cardDetails.pin,
    ...getDefaultCardDetails(),
  };

  return { card: newCard, cardDetails: newCardDetails };
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
  await triggerWebhook(CardWebhookEvent.CARD_LIFECYCLE_EVENT, cardData.card);

  return cardData.card;
};

export const activateCard = async (
  cardForActivation: Card,
  verificationToken: string
): Promise<Card> => {
  if (cardForActivation.type === CardType.VIRTUAL_VISA_FREELANCE_DEBIT) {
    return cardForActivation;
  }

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

export const validateCardLimits = (
  cardLimits: CardLimits,
  limitType: CardLimitType
): string | null => {
  const errors = [];

  const maxDailyNumberOfTransactions =
    limitType === CardLimitType.PRESENT
      ? CARD_PRESENT_DAILY_MAX_NUMBER_TRANSACTIONS
      : CARD_NOT_PRESENT_DAILY_MAX_NUMBER_TRANSACTIONS;

  const maxDailyAmountInCents =
    limitType === CardLimitType.PRESENT
      ? CARD_PRESENT_DAILY_MAX_AMOUNT_IN_CENTS
      : CARD_NOT_PRESENT_DAILY_MAX_AMOUNT_IN_CENTS;

  const maxMonthlyNumberOfTransactions =
    limitType === CardLimitType.PRESENT
      ? CARD_PRESENT_MONTHLY_MAX_NUMBER_TRANSACTIONS
      : CARD_NOT_PRESENT_MONTHLY_MAX_NUMBER_TRANSACTIONS;

  const maxMonthlyAmountInCents =
    limitType === CardLimitType.PRESENT
      ? CARD_PRESENT_MONTHLY_MAX_AMOUNT_IN_CENTS
      : CARD_NOT_PRESENT_MONTHLY_MAX_AMOUNT_IN_CENTS;

  if (
    cardLimits.daily.max_transactions > maxDailyNumberOfTransactions ||
    cardLimits.daily.max_amount_cents > maxDailyAmountInCents
  ) {
    errors.push(
      `limit too high. Max DAILY transactions amount: ${maxDailyNumberOfTransactions} and Max DAILY amount in cents: ${maxDailyAmountInCents}`
    );
  }

  if (
    cardLimits.monthly.max_transactions > maxMonthlyNumberOfTransactions ||
    cardLimits.monthly.max_amount_cents > maxMonthlyAmountInCents
  ) {
    errors.push(
      `limit too high. Max MONTHLY transactions amount: ${maxMonthlyNumberOfTransactions} and Max MONTHLY amount in cents: ${maxMonthlyAmountInCents}`
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
    (cardData) => cardData.card.id === card.id
  );

  person.account.cards[cardIndex].cardDetails[
    cardLimitType === CardLimitType.PRESENT
      ? "cardPresentLimits"
      : "cardNotPresentLimits"
  ] = newLimits;
  await db.savePerson(person);
  return newLimits;
};

export const enableGooglePay = async (card: Card): Promise<string> => {
  const person = await db.getPerson(card.person_id);
  const cardIndex = person.account.cards.findIndex(
    (cardData) => cardData.card.id === card.id
  );
  person.account.cards[
    cardIndex
  ].cardDetails.walletPayload = SOLARIS_HARDCODED_WALLET_PAYLOAD;
  await db.savePerson(person);
  return SOLARIS_HARDCODED_WALLET_PAYLOAD;
};

const hasAtLeast3UniqueDigits = (pin: string): boolean =>
  _.uniq(pin.split("")).length >= 3;

const isSequence = (pin: string): boolean => {
  const numbers = pin.split("").map((c) => parseInt(c, 10));
  const increasingSequence = numbers
    .slice(0, numbers.length - 1)
    .every((number, index) => number + 1 === numbers[index + 1]);
  if (increasingSequence) {
    return true;
  }
  const decreasingSequence = numbers
    .slice(1)
    .every((number, index) => number + 1 === numbers[index]);
  if (decreasingSequence) {
    return true;
  }
  return false;
};

export const validatePIN = (pin: string) => {
  const errors = [];

  if (isSequence(pin)) {
    errors.push([
      {
        id: uuid.v4(),
        status: 400,
        code: "validation_error",
        title: "Validation Error",
        detail: "pin must not contain sequential digits",
        source: {
          field: "pin",
          message: "must not contain sequential digits",
        },
      },
    ]);
  }

  if (!hasAtLeast3UniqueDigits(pin)) {
    errors.push([
      {
        id: uuid.v4(),
        status: 400,
        code: "validation_error",
        title: "Validation Error",
        detail: "pin must not contain three or more repeating digits",
        source: {
          field: "pin",
          message: "must not contain three or more repeating digits",
        },
      },
    ]);
  }

  return errors;
};

export const changePIN = async (card: Card, pin: string) => {
  const person = await db.getPerson(card.person_id);
  const changeRequestId = uuid.v4();
  person.changeRequest = {
    pin,
    changeRequestId,
    cardId: card.id,
    method: CHANGE_REQUEST_CHANGE_CARD_PIN,
  };

  await db.savePerson(person);

  return {
    id: changeRequestId,
    status: "AUTHORIZATION_REQUIRED",
    updated_at: new Date().toISOString(),
    url: `:env/v1/change_requests/${changeRequestId}/authorize`,
  };
};

export const confirmChangeCardPIN = async (
  person: MockPerson,
  changeRequest: MockChangeRequest
) => {
  const cardIndex = person.account.cards.findIndex(
    ({ card }) => card.id === changeRequest.cardId
  );

  person.account.cards[cardIndex].cardDetails.pin = changeRequest.pin;
  person.changeRequest = null;
  await db.savePerson(person);

  return {
    id: changeRequest.changeRequestId,
    status: ChangeRequestStatus.COMPLETED,
    updated_at: new Date().toISOString(),
    response_body: "Accepted",
    response_code: HttpStatusCodes.ACCEPTED,
  };
};

export const updateCardSettings = async (
  cardId: string,
  person: MockPerson,
  settings: CardSettings
): Promise<CardSettings> => {
  const cardIndex = person.account.cards.findIndex(
    ({ card }) => card.id === cardId
  );

  if (typeof settings.contactless_enabled !== "boolean") {
    return person.account.cards[cardIndex].cardDetails.settings;
  }

  person.account.cards[cardIndex].cardDetails.settings = settings;
  await db.savePerson(person);

  return settings;
};

/* eslint-enable @typescript-eslint/camelcase */
