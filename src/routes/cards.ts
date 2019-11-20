/* eslint-disable @typescript-eslint/camelcase */
import uuid from "uuid";
import moment from "moment";
import * as express from "express";
import HttpStatusCodes from "http-status";
import * as db from "../db";
import * as log from "../logger";

import {
  Card,
  CardDetails,
  CardStatus,
  CreateCardData,
  MockPerson
} from "../helpers/types";

import {
  activateCard,
  createCardToken,
  getCards,
  getMaskedCardNumber,
  validateCardData,
  validatePersonData,
  CardErrorCodes
} from "../helpers/cards";

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
    token: createCardToken()
  };

  return {
    card,
    cardDetails
  };
};

export const createCardHandler = async (
  req: express.Request,
  res: express.Response
) => {
  const { person_id: personId, account_id: accountId } = req.params;

  try {
    const person = await db.findPersonByAccountId(accountId);

    // no user or account
    if (!person || person.id !== personId) {
      res.status(HttpStatusCodes.NOT_FOUND).send({
        errors: [
          {
            id: uuid.v4(),
            status: 404,
            code: "model_not_found",
            title: "Model Not Found",
            detail: `Couldn't find 'Solaris::Person' for id '${personId}'.`
          }
        ]
      });
      return;
    }

    const { card, cardDetails } = createCard(req.body, person);
    const personValidationErrors = await validatePersonData(person);
    const cardValidationErrors = await validateCardData(card, cardDetails);
    const errors = personValidationErrors.concat(cardValidationErrors);

    if (errors.length > 0) {
      res.status(errors[0].status).send({
        errors
      });
      return;
    }

    card.representation.line_1 = card.representation.line_1.replace(/\//g, " ");
    person.account.cards = person.account.cards || [];
    person.account.cards.push({ card, cardDetails });

    await db.saveCardReference(cardDetails.reference);
    await db.savePerson(person);

    log.info("(createCardHandler) Card created", { card, cardDetails });

    res.status(HttpStatusCodes.CREATED).send({
      id: card.id,
      status: card.status
    });
  } catch (err) {
    log.error("(createCardHandler) Error occurred", err);

    res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send({
      errors: [
        {
          id: uuid.v4(),
          status: 500,
          code: "generic_error",
          title: "Generic error",
          detail: `generic error.`
        }
      ]
    });
  }
};

export const getAccountCardsHandler = async (
  req: express.Request,
  res: express.Response
) => {
  const { account_id: accountId } = req.params;
  const person = await db.findPersonByAccountId(accountId);

  if (!person) {
    res.status(HttpStatusCodes.NOT_FOUND).send({
      errors: [
        {
          id: uuid.v4(),
          status: 404,
          code: "model_not_found",
          title: "Model Not Found",
          detail: `Couldn't find 'Solaris::Account' for id '${accountId}'.`
        }
      ]
    });
    return;
  }

  res.status(HttpStatusCodes.OK).send(getCards(person));
};

export const getCardHandler = async (
  req: express.Request,
  res: express.Response
) => {
  const { card_id: cardId } = req.params;
  const card = await db.getCard(cardId);

  if (!card) {
    res.status(HttpStatusCodes.NOT_FOUND).send({
      errors: [
        {
          id: uuid.v4(),
          status: 404,
          code: "model_not_found",
          title: "Model Not Found",
          detail: `Couldn't find 'Solaris::Card' for id '${cardId}'.`
        }
      ]
    });
    return;
  }

  res.send(card);
};

const handleCardActivationError = (
  err: Error,
  card: Card,
  res: express.Response
) => {
  if (err.message === CardErrorCodes.CARD_ACTIVATION_INVALID_STATUS) {
    res.status(HttpStatusCodes.BAD_REQUEST).send({
      errors: [
        {
          id: uuid.v4(),
          status: 400,
          code: "invalid_model",
          title: "Validation Error",
          detail: `card is in ${card.status} status`,
          source: {
            field: "card",
            message: `is in ${card.status} status`
          }
        }
      ]
    });
    return;
  }

  if (err.message === CardErrorCodes.VERIFICATION_TOKEN_TOO_LONG) {
    res.status(HttpStatusCodes.BAD_REQUEST).send({
      errors: [
        {
          id: uuid.v4(),
          status: 400,
          code: "invalid_model",
          title: "Validation Error",
          detail: "verification_token must be at the most 6 characters long",
          source: {
            field: "verification_token",
            message: "must be at the most 6 characters long"
          }
        }
      ]
    });
    return;
  }

  if (err.message === CardErrorCodes.INVALID_VERIFICATION_TOKEN) {
    res.status(HttpStatusCodes.BAD_REQUEST).send({
      errors: [
        {
          id: uuid.v4(),
          status: 400,
          code: CardErrorCodes.INVALID_VERIFICATION_TOKEN,
          title: "Invalid Verification Token",
          detail: "Invalid Verification Token"
        }
      ]
    });
    return;
  }

  throw err;
};

export const activateCardHandler = async (
  req: express.Request,
  res: express.Response
) => {
  const { card_id: cardId } = req.params;
  const card = await db.getCard(cardId);

  if (!card) {
    res.status(HttpStatusCodes.NOT_FOUND).send({
      errors: [
        {
          id: uuid.v4(),
          status: 404,
          code: "model_not_found",
          title: "Model Not Found",
          detail: `Couldn't find 'Solaris::Card' for id '${cardId}'.`
        }
      ]
    });
    return;
  }

  try {
    const updatedCard = await activateCard(card, req.body.verification_token);
    res.status(HttpStatusCodes.CREATED).send(updatedCard);
  } catch (err) {
    handleCardActivationError(err, card, res);
  }
};
/* eslint-enable @typescript-eslint/camelcase */
