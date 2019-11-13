import uuid from "uuid";
import moment from "moment";
import HttpStatusCodes from "http-status";
import * as db from "../db";
import * as log from "../logger";

import {
  CARD_STATUS,
  createCardToken,
  getCards,
  getMaskedCardNumber,
  validateCardData,
  validatePersonData
} from "../helpers/cards";

export const createCard = (cardData, person) => {
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
    status: CARD_STATUS.INACTIVE,
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

export const createCardHandler = async (req, res) => {
  const { person_id: personId, account_id: accountId } = req.params;

  try {
    const person = await db.findPersonByAccountId(accountId);

    // no user or account
    if (!person || person.id !== personId) {
      return res.status(HttpStatusCodes.NOT_FOUND).send({
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
    }

    const { card, cardDetails } = createCard(req.body, person);
    const personValidationErrors = await validatePersonData(person);
    const cardValidationErrors = await validateCardData(card, cardDetails);
    const errors = personValidationErrors.concat(cardValidationErrors);

    if (errors.length > 0) {
      return res.status(errors[0].status).send({
        errors
      });
    }

    card.representation.line_1 = card.representation.line_1.replace(/\//g, " ");
    person.account.cards = person.account.cards || [];
    person.account.cards.push({ card, cardDetails });

    await db.saveCardReference(cardDetails.reference);
    await db.savePerson(person);

    log.info("(createCardHandler) Card created", { card, cardDetails });

    res.status(HttpStatusCodes.CREATED).send({
      id: card.id,
      status: CARD_STATUS.PROCESSING
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

export const getAccountCardsHandler = async (req, res) => {
  const { account_id: accountId } = req.params;
  const person = await db.findPersonByAccountId(accountId);

  if (!person) {
    return res.status(HttpStatusCodes.NOT_FOUND).send({
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
  }

  res.status(HttpStatusCodes.OK).send(getCards(person));
};
