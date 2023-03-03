/* eslint-disable @typescript-eslint/camelcase */
import _ from "lodash";
import uuid from "node-uuid";
import jose from "node-jose";
import * as express from "express";
import HttpStatusCodes from "http-status";

import * as db from "../db";
import * as log from "../logger";

import {
  Card,
  CardDetails,
  CardStatus,
  CaseResolution,
  MockChangeRequest,
} from "../helpers/types";

import * as cardHelpers from "../helpers/cards";
import getFraudWatchdog from "../helpers/fraudWatchdog";

const keyStore = jose.JWK.createKeyStore();
const changePinKeyId = uuid.v4();
keyStore.generate("RSA", 2048, {
  kid: changePinKeyId,
  alg: "RSA-OAEP-256",
  use: "enc",
});

type RequestExtendedWithCard = express.Request & {
  card: Card;
  cardDetails: CardDetails;
};

export const replaceCardHandler = async (
  req: RequestExtendedWithCard,
  res: express.Response
) => {
  try {
    const person = await db.findPersonByAccountId(req.card.account_id);

    const { card: newCard, cardDetails } = await cardHelpers.replaceCard(
      req.body,
      req.card,
      req.cardDetails
    );

    const errors = await cardHelpers.validateCardData(newCard);

    if (errors.length > 0) {
      res.status(errors[0].status).send({
        errors,
      });
      return;
    }
    newCard.representation.line_1 = newCard.representation.line_1.replace(
      /\//g,
      " "
    );

    person.account.cards = person.account.cards.map((item) => {
      if (item.card.id === newCard.id) {
        return {
          card: newCard,
          cardDetails,
        };
      }
      return item;
    });

    await db.savePerson(person);

    log.info("(replaceCardHandler) Card replaced", { newCard, cardDetails });

    res.status(HttpStatusCodes.CREATED).send({
      id: newCard.id,
      status: newCard.status,
    });
  } catch (err) {
    log.error("(replaceCardHandler) Error occurred", err);

    res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send({
      errors: [
        {
          id: uuid.v4(),
          status: 500,
          code: "generic_error",
          title: "Generic error",
          detail: `generic error.`,
        },
      ],
    });
  }
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
            detail: `Couldn't find 'Solaris::Person' for id '${personId}'.`,
          },
        ],
      });
      return;
    }

    const { card, cardDetails } = cardHelpers.createCard(req.body, person);
    const personValidationErrors = await cardHelpers.validatePersonData(person);
    const cardValidationErrors = await cardHelpers.validateCardData(
      card,
      cardDetails
    );
    const errors = personValidationErrors.concat(cardValidationErrors);

    if (errors.length > 0) {
      res.status(errors[0].status).send({
        errors,
      });
      return;
    }

    card.representation.line_1 = card.representation.line_1.replace(/\//g, " ");
    person.account.cards = person.account.cards || [];
    person.account.cards.push({ card, cardDetails, controls: [] });

    await db.saveCardReference(cardDetails.reference);
    await db.savePerson(person);

    log.info("(createCardHandler) Card created", { card, cardDetails });

    res.status(HttpStatusCodes.CREATED).send({
      id: card.id,
      status: card.status,
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
          detail: `generic error.`,
        },
      ],
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
          detail: `Couldn't find 'Solaris::Account' for id '${accountId}'.`,
        },
      ],
    });
    return;
  }

  res.status(HttpStatusCodes.OK).send(cardHelpers.getCards(person));
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
  if (
    err.message === cardHelpers.CardErrorCodes.CARD_ACTIVATION_INVALID_STATUS
  ) {
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
            message: `is in ${card.status} status`,
          },
        },
      ],
    });
    return;
  }

  if (err.message === cardHelpers.CardErrorCodes.VERIFICATION_TOKEN_TOO_LONG) {
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
            message: "must be at the most 6 characters long",
          },
        },
      ],
    });
    return;
  }

  if (err.message === cardHelpers.CardErrorCodes.INVALID_VERIFICATION_TOKEN) {
    res.status(HttpStatusCodes.BAD_REQUEST).send({
      errors: [
        {
          id: uuid.v4(),
          status: 400,
          code: cardHelpers.CardErrorCodes.INVALID_VERIFICATION_TOKEN,
          title: "Invalid Verification Token",
          detail: "Invalid Verification Token",
        },
      ],
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
    const updatedCard = await cardHelpers.activateCard(req.card);
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
          detail: `Couldn't find 'Solaris::CardAccount' for id '${cardId}'.`,
        },
      ],
    });
  }

  req.card = cardData.card;
  req.cardDetails = cardData.cardDetails;

  next();
};

export const cardStatusMiddleware =
  (states: CardStatus[]) =>
  async (
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
            detail: `card in invalid state.`,
          },
        ],
      });
      return;
    }

    next();
  };

export const createCardSpendingLimitsHandler = async (
  req: express.Request,
  res: express.Response
) => {
  const limits = await cardHelpers.createCardSpendingLimit(req, res);
  res.status(HttpStatusCodes.CREATED).send(limits);
};

export const deleteCardSpendingLimitsHandler = async (
  req: express.Request,
  res: express.Response
) => {
  const { id } = req.params;

  await cardHelpers.deleteCardSpendingLimit(id);
  res.sendStatus(HttpStatusCodes.NO_CONTENT);
};

export const indexCardSpendingLimitsHandler = async (
  req: express.Request,
  res: express.Response
) => {
  const {
    filter: { scope, scope_id: scopeId },
  } = req.query as any;

  const spendingLimits = await cardHelpers.indexCardSpendingLimit(
    scope,
    scopeId
  );
  res.status(HttpStatusCodes.OK).send(spendingLimits);
};

export const confirmFraudHandler = async (
  req: RequestExtendedWithCard,
  res: express.Response
) => {
  const { fraud_case_id: fraudCaseId } = req.params;
  getFraudWatchdog().confirmFraud(fraudCaseId);
  const response = {
    id: fraudCaseId,
    resolution: CaseResolution.CONFIRMED,
  };
  res.status(HttpStatusCodes.OK).send(response);
};

export const whitelistCardHandler = async (
  req: RequestExtendedWithCard,
  res: express.Response
) => {
  const { fraud_case_id: fraudCaseId } = req.params;
  getFraudWatchdog().whitelistCard(fraudCaseId);
  const response = {
    id: fraudCaseId,
    resolution: CaseResolution.WHITELISTED,
    // https://docs.solarisbank.com/sbdf35fw/api/v1/#5jDUgtyQ-post-whitelist-a-card
    // Card whitelisting timespan, during which the card will not be declined,
    // should the transaction be retried. Timespan is set to 10 mins.
    whitelisted_until: new Date(
      new Date().getTime() + 10 * 60000
    ).toISOString(),
  };
  res.status(HttpStatusCodes.OK).send(response);
};

export const blockCardHandler = async (
  req: RequestExtendedWithCard,
  res: express.Response
) => {
  const {
    person_id: personId,
    account_id: accountId,
    id: cardId,
    status,
  } = req.card;

  if (![CardStatus.ACTIVE, CardStatus.BLOCKED].includes(status)) {
    res.status(HttpStatusCodes.BAD_REQUEST).send({
      errors: [
        {
          id: uuid.v4(),
          status: 400,
          code: "invalid_status",
          title: "Invalid Status",
          detail: `Expected the status for 'Solaris::PlasticCard' to be 'BLOCKED' but was '${status}'.`,
        },
      ],
    });
    return;
  }

  const updatedCard = await cardHelpers.changeCardStatus(
    { personId, accountId },
    cardId,
    CardStatus.BLOCKED
  );

  res.send(updatedCard);
};

export const unblockCardHandler = async (
  req: RequestExtendedWithCard,
  res: express.Response
) => {
  const {
    person_id: personId,
    account_id: accountId,
    id: cardId,
    status,
  } = req.card;

  // Solaris sandbox and production does not throw an error in any case.
  // When card is in different state than BLOCK, card details are simply returned.
  if (status !== CardStatus.BLOCKED) {
    res.send(req.card);
    return;
  }

  const updatedCard = await cardHelpers.changeCardStatus(
    { personId, accountId },
    cardId,
    CardStatus.ACTIVE
  );

  res.send(updatedCard);
};

export const changePINCardHandler = async (
  req: RequestExtendedWithCard,
  res: express.Response
) => {
  const { pin } = req.body;

  const pinValidationErrors = cardHelpers.validatePIN(pin || "");
  if (pinValidationErrors.length) {
    res.status(HttpStatusCodes.BAD_REQUEST).send({
      errors: pinValidationErrors,
    });
    return;
  }

  const changeRequestResponse = await cardHelpers.changePIN(req.card, pin);
  res.status(HttpStatusCodes.ACCEPTED).send(changeRequestResponse);
};

export const confirmChangeCardPINHandler = async (
  req: RequestExtendedWithCard,
  res: express.Response
) => {
  const { person_id: personId, tan } = req.body;
  const person = await db.getPerson(personId);

  const { change_request_id: changeRequestId } = req.params;
  const changeRequest: MockChangeRequest = person.changeRequest || {};

  if (changeRequest.changeRequestId !== changeRequestId) {
    res.status(HttpStatusCodes.NOT_FOUND).send({
      errors: [
        {
          id: uuid.v4(),
          status: HttpStatusCodes.NOT_FOUND,
          code: "model_not_found",
          title: "Model Not Found",
          detail: `Couldn't find 'Solaris::Changeset' for id '${changeRequestId}'.`,
        },
      ],
    });
    return;
  }

  if (changeRequest.token !== tan) {
    res.status(HttpStatusCodes.UNPROCESSABLE_ENTITY).send({
      errors: [
        {
          id: uuid.v4(),
          status: HttpStatusCodes.UNPROCESSABLE_ENTITY,
          code: "invalid_tan",
          title: "Invalid Tan",
          detail: `The TAN (${tan}) is invalid`,
        },
      ],
    });
    return;
  }

  const confirmResponse = await cardHelpers.confirmChangeCardPIN(
    person,
    changeRequest
  );
  res.status(confirmResponse.response_code).send(confirmResponse);
};

export const closeCardHandler = async (
  req: RequestExtendedWithCard,
  res: express.Response
) => {
  const updatedCard = await cardHelpers.changeCardStatus(
    { personId: req.card.person_id, accountId: req.card.account_id },
    req.card.id,
    CardStatus.CLOSED
  );
  res.send(updatedCard);
};

export const pushProvisioningHandler = async (
  req: RequestExtendedWithCard,
  res: express.Response
) => {
  const { card } = req;
  const { wallet_type: walletType } = req.params;

  if (!["google", "apple_encrypted"].includes(walletType)) {
    res.status(HttpStatusCodes.BAD_REQUEST).send({
      errors: [
        {
          id: uuid.v4(),
          status: HttpStatusCodes.BAD_REQUEST,
          code: "invalid_wallet_type_for_push_provisioning",
          title: "Invalid Wallet Type",
          detail: `wallet type ${walletType} is not supported`,
        },
      ],
    });
    return;
  }

  const requiredFields =
    walletType === "google"
      ? ["client_wallet_account_id", "client_device_id", "client_app_id"]
      : ["nonce", "nonce_signature", "certificates"];

  const handler =
    walletType === "google"
      ? cardHelpers.enableGooglePay
      : cardHelpers.enableApplePay;

  const errors = requiredFields
    .filter((fieldName) => !_.get(req.body, fieldName))
    .map((fieldName) => ({
      id: uuid.v4(),
      status: HttpStatusCodes.BAD_REQUEST,
      code: "validation_error",
      title: "Validation Error",
      detail: `${fieldName} is missing`,
      source: {
        field: `${fieldName}`,
        message: "is missing",
      },
    }));

  if (errors.length) {
    res.status(errors[0].status).send({
      errors,
    });
    return;
  }

  res
    .status(HttpStatusCodes.CREATED)
    .send({ wallet_payload: await handler(card) });
};

export const getVirtualCardDetails = async (
  req: RequestExtendedWithCard,
  res: express.Response
) => {
  const {
    body: {
      jwk,
      jwe: { alg, enc },
    },
    card,
    cardDetails,
  } = req;

  if (card.status === CardStatus.PROCESSING) {
    res.status(500).send({
      errors: [
        {
          id: uuid.v4(),
          status: 500,
          code: "generic_error",
          title: "Generic Error",
          detail: "There was an error.",
        },
      ],
    });
    return;
  }

  const errors = [
    "device_id",
    "signature",
    "jwk",
    "jwk[kty]",
    "jwk[n]",
    "jwk[e]",
    "jwe",
    "jwe[alg]",
    "jwe[enc]",
  ]
    .filter((fieldName) => !_.get(req.body, fieldName))
    .map((fieldName) => ({
      id: uuid.v4(),
      status: 400,
      code: "validation_error",
      title: "Validation Error",
      detail: `${fieldName} is missing`,
      source: {
        field: `${fieldName}`,
        message: "is missing",
      },
    }));

  if (errors.length) {
    res.status(errors[0].status).send({
      errors,
    });
    return;
  }

  const SUPPORTED_ALG = ["RSA1_5", "RSA_OAEP_256", "RSA_OAEP_256_ANDROID"];

  if (!SUPPORTED_ALG.includes(alg)) {
    const validAlgMessage = `Valid: ${SUPPORTED_ALG.map(
      (algorithm) => `'${algorithm}'`
    ).join(", ")}`;
    res.status(400).send({
      errors: [
        {
          id: uuid.v4(),
          status: 400,
          code: "validation_error",
          title: "Validation Error",
          detail: `jwe[alg] is not valid. ${validAlgMessage}`,
          source: {
            field: "jwe[alg]",
            message: `is not valid. ${validAlgMessage}`,
          },
        },
      ],
    });
    return;
  }

  const cardDetailsForEncryption = {
    pan: cardDetails.cardNumber,
    cvc: cardDetails.cvv,
    expires_at: card.expiration_date,
    line_1: card.representation.line_1,
  };

  try {
    const result = await jose.JWE.createEncrypt(
      { format: "compact", enc, alg },
      jwk
    )
      .update(Buffer.from(JSON.stringify(cardDetailsForEncryption)))
      .final();
    res.send({ data: result });
  } catch (err) {
    log.error("An error occurred when fetching virtual card details", err);
    res.status(500).send(err);
  }
};

export const getCardLatestPINKeyHandler = async (
  req: RequestExtendedWithCard,
  res: express.Response
) => {
  const key = keyStore.get(changePinKeyId);
  res.send(key.toJSON());
};

export const createCardPINUpdateRequestHandler = async (
  req: RequestExtendedWithCard,
  res: express.Response
) => {
  const decryptedData = await jose.JWE.createDecrypt(keyStore).decrypt(
    req.body.encrypted_pin
  );
  const { pin } = JSON.parse(decryptedData.payload.toString());

  const pinValidationErrors = cardHelpers.validatePIN(pin || "");
  if (pinValidationErrors.length) {
    res.status(HttpStatusCodes.BAD_REQUEST).send({
      errors: pinValidationErrors,
    });
    return;
  }

  const person = await db.getPerson(req.card.person_id);
  const cardIndex = person.account.cards.findIndex(
    ({ card }) => card.id === req.card.id
  );
  person.account.cards[cardIndex].cardDetails.pin = pin;
  await db.savePerson(person);

  res.send({});
};

export const changeCardPINWithChangeRequestHandler = async (
  req: RequestExtendedWithCard,
  res: express.Response
) => {
  const decryptedData = await jose.JWE.createDecrypt(keyStore).decrypt(
    req.body.encrypted_pin
  );
  const { pin } = JSON.parse(decryptedData.payload.toString());

  const pinValidationErrors = cardHelpers.validatePIN(pin || "");
  if (pinValidationErrors.length) {
    res.status(HttpStatusCodes.BAD_REQUEST).send({
      errors: pinValidationErrors,
    });
    return;
  }

  const changeRequestResponse = await cardHelpers.changePIN(req.card, pin);
  res.status(HttpStatusCodes.ACCEPTED).send(changeRequestResponse);
};

/* eslint-enable @typescript-eslint/camelcase */
