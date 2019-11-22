/* eslint-disable @typescript-eslint/camelcase */
import uuid from "uuid";
import * as express from "express";
import HttpStatusCodes from "http-status";

import * as db from "../db";
import * as log from "../logger";

import { Card, CardDetails, CardLimitType, CardStatus } from "../helpers/types";

import {
  createCard,
  activateCard,
  getCards,
  validateCardData,
  validatePersonData,
  CardErrorCodes,
  updateCardLimits
} from "../helpers/cards";

type RequestExtendedWithCard = express.Request & {
  card: Card;
  cardDetails: CardDetails;
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
  req: RequestExtendedWithCard,
  res: express.Response
) => {
  res.send(req.card);
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
  req: RequestExtendedWithCard,
  res: express.Response
) => {
  try {
    const updatedCard = await activateCard(
      req.card,
      req.body.verification_token
    );
    res.status(HttpStatusCodes.CREATED).send(updatedCard);
  } catch (err) {
    handleCardActivationError(err, req.card, res);
  }
};

export const cardMiddleware = async (req, res, next) => {
  const { card_id: cardId } = req.params;
  const cardData = await db.getCardData(cardId);

  if (!cardData) {
    return res.status(HttpStatusCodes.NOT_FOUND).send({
      errors: [
        {
          id: uuid.v4(),
          status: HttpStatusCodes.NOT_FOUND,
          code: "model_not_found",
          title: "Model Not Found",
          detail: `Couldn't find 'Solaris::CardAccount' for id '${cardId}'.`
        }
      ]
    });
  }

  req.card = cardData.card;
  req.cardDetails = cardData.cardDetails;

  next();
};

export const cardStatusMiddleware = (states: CardStatus[]) => async (
  req: RequestExtendedWithCard,
  res: express.Response,
  next: express.NextFunction
) => {
  if (!states.includes(req.card.status)) {
    // this is custom error, couldn't test it with Solaris sandbox and production
    res.status(HttpStatusCodes.BAD_REQUEST).send({
      errors: [
        {
          id: uuid.v4(),
          status: HttpStatusCodes.BAD_REQUEST,
          detail: `card in invalid state.`
        }
      ]
    });
    return;
  }

  next();
};

export const getCardPresentLimitsHandler = async (
  req: RequestExtendedWithCard,
  res: express.Response
) => {
  res.status(HttpStatusCodes.OK).send(req.cardDetails.cardPresentLimits);
};

export const getCardNotPresentLimitsHandler = async (
  req: RequestExtendedWithCard,
  res: express.Response
) => {
  res.status(HttpStatusCodes.OK).send(req.cardDetails.cardNotPresentLimits);
};

export const setCardPresentLimitsHandler = async (
  req: RequestExtendedWithCard,
  res: express.Response
) => {
  const updatedLimits = await updateCardLimits(
    req.card,
    CardLimitType.PRESENT,
    req.body
  );
  res.status(HttpStatusCodes.CREATED).send(updatedLimits);
};

export const setCardNotPresentLimitsHandler = async (
  req: RequestExtendedWithCard,
  res: express.Response
) => {
  const updatedLimits = await updateCardLimits(
    req.card,
    CardLimitType.NOT_PRESENT,
    req.body
  );

  res.status(HttpStatusCodes.CREATED).send(updatedLimits);
};

/* eslint-enable @typescript-eslint/camelcase */
