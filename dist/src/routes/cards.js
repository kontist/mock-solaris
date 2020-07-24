"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVirtualCardDetails = exports.pushProvisioningHandler = exports.closeCardHandler = exports.changeCardSettingsHandler = exports.confirmChangeCardPINHandler = exports.changePINCardHandler = exports.unblockCardHandler = exports.blockCardHandler = exports.whitelistCardHandler = exports.confirmFraudHandler = exports.setCardNotPresentLimitsHandler = exports.setCardPresentLimitsHandler = exports.getCardNotPresentLimitsHandler = exports.getCardPresentLimitsHandler = exports.cardStatusMiddleware = exports.cardMiddleware = exports.activateCardHandler = exports.getCardHandler = exports.getAccountCardsHandler = exports.createCardHandler = exports.replaceCardHandler = void 0;
/* eslint-disable @typescript-eslint/camelcase */
const lodash_1 = __importDefault(require("lodash"));
const node_uuid_1 = __importDefault(require("node-uuid"));
const node_jose_1 = __importDefault(require("node-jose"));
const http_status_1 = __importDefault(require("http-status"));
const db = __importStar(require("../db"));
const log = __importStar(require("../logger"));
const types_1 = require("../helpers/types");
const cardHelpers = __importStar(require("../helpers/cards"));
const fraudWatchdog_1 = __importDefault(require("../helpers/fraudWatchdog"));
exports.replaceCardHandler = async (req, res) => {
    try {
        const person = await db.findPersonByAccountId(req.card.account_id);
        const { card: newCard, cardDetails } = await cardHelpers.replaceCard(req.body, req.card, req.cardDetails);
        const errors = await cardHelpers.validateCardData(newCard);
        if (errors.length > 0) {
            res.status(errors[0].status).send({
                errors,
            });
            return;
        }
        newCard.representation.line_1 = newCard.representation.line_1.replace(/\//g, " ");
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
        res.status(http_status_1.default.CREATED).send({
            id: newCard.id,
            status: newCard.status,
        });
    }
    catch (err) {
        log.error("(replaceCardHandler) Error occurred", err);
        res.status(http_status_1.default.INTERNAL_SERVER_ERROR).send({
            errors: [
                {
                    id: node_uuid_1.default.v4(),
                    status: 500,
                    code: "generic_error",
                    title: "Generic error",
                    detail: `generic error.`,
                },
            ],
        });
    }
};
exports.createCardHandler = async (req, res) => {
    const { person_id: personId, account_id: accountId } = req.params;
    try {
        const person = await db.findPersonByAccountId(accountId);
        // no user or account
        if (!person || person.id !== personId) {
            res.status(http_status_1.default.NOT_FOUND).send({
                errors: [
                    {
                        id: node_uuid_1.default.v4(),
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
        const cardValidationErrors = await cardHelpers.validateCardData(card, cardDetails);
        const errors = personValidationErrors.concat(cardValidationErrors);
        if (errors.length > 0) {
            res.status(errors[0].status).send({
                errors,
            });
            return;
        }
        card.representation.line_1 = card.representation.line_1.replace(/\//g, " ");
        person.account.cards = person.account.cards || [];
        person.account.cards.push({ card, cardDetails });
        await db.saveCardReference(cardDetails.reference);
        await db.savePerson(person);
        log.info("(createCardHandler) Card created", { card, cardDetails });
        res.status(http_status_1.default.CREATED).send({
            id: card.id,
            status: card.status,
        });
    }
    catch (err) {
        log.error("(createCardHandler) Error occurred", err);
        res.status(http_status_1.default.INTERNAL_SERVER_ERROR).send({
            errors: [
                {
                    id: node_uuid_1.default.v4(),
                    status: 500,
                    code: "generic_error",
                    title: "Generic error",
                    detail: `generic error.`,
                },
            ],
        });
    }
};
exports.getAccountCardsHandler = async (req, res) => {
    const { account_id: accountId } = req.params;
    const person = await db.findPersonByAccountId(accountId);
    if (!person) {
        res.status(http_status_1.default.NOT_FOUND).send({
            errors: [
                {
                    id: node_uuid_1.default.v4(),
                    status: 404,
                    code: "model_not_found",
                    title: "Model Not Found",
                    detail: `Couldn't find 'Solaris::Account' for id '${accountId}'.`,
                },
            ],
        });
        return;
    }
    res.status(http_status_1.default.OK).send(cardHelpers.getCards(person));
};
exports.getCardHandler = async (req, res) => {
    res.send(req.card);
};
const handleCardActivationError = (err, card, res) => {
    if (err.message === cardHelpers.CardErrorCodes.CARD_ACTIVATION_INVALID_STATUS) {
        res.status(http_status_1.default.BAD_REQUEST).send({
            errors: [
                {
                    id: node_uuid_1.default.v4(),
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
        res.status(http_status_1.default.BAD_REQUEST).send({
            errors: [
                {
                    id: node_uuid_1.default.v4(),
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
        res.status(http_status_1.default.BAD_REQUEST).send({
            errors: [
                {
                    id: node_uuid_1.default.v4(),
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
exports.activateCardHandler = async (req, res) => {
    try {
        const updatedCard = await cardHelpers.activateCard(req.card, req.body.verification_token);
        res.status(http_status_1.default.CREATED).send(updatedCard);
    }
    catch (err) {
        handleCardActivationError(err, req.card, res);
    }
};
exports.cardMiddleware = async (req, res, next) => {
    const { card_id: cardId } = req.params;
    const cardData = await db.getCardData(cardId);
    if (!cardData) {
        return res.status(http_status_1.default.NOT_FOUND).send({
            errors: [
                {
                    id: node_uuid_1.default.v4(),
                    status: http_status_1.default.NOT_FOUND,
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
exports.cardStatusMiddleware = (states) => async (req, res, next) => {
    if (!states.includes(req.card.status)) {
        // this is custom error, couldn't test it with Solaris sandbox and production
        res.status(http_status_1.default.BAD_REQUEST).send({
            errors: [
                {
                    id: node_uuid_1.default.v4(),
                    status: http_status_1.default.BAD_REQUEST,
                    detail: `card in invalid state.`,
                },
            ],
        });
        return;
    }
    next();
};
exports.getCardPresentLimitsHandler = async (req, res) => {
    res.status(http_status_1.default.OK).send(req.cardDetails.cardPresentLimits);
};
exports.getCardNotPresentLimitsHandler = async (req, res) => {
    res.status(http_status_1.default.OK).send(req.cardDetails.cardNotPresentLimits);
};
const handleSetCardLimitValidationError = (validationError, res) => {
    res.status(http_status_1.default.BAD_REQUEST).send({
        errors: [
            {
                id: node_uuid_1.default.v4(),
                status: http_status_1.default.BAD_REQUEST,
                code: "invalid_model",
                title: "Validation Error",
                detail: validationError,
                source: {
                    field: "limit",
                    message: validationError.replace(/^limit/, ""),
                },
            },
        ],
    });
};
exports.setCardPresentLimitsHandler = async (req, res) => {
    const validationError = cardHelpers.validateCardLimits(req.body, types_1.CardLimitType.PRESENT);
    if (validationError) {
        handleSetCardLimitValidationError(validationError, res);
        return;
    }
    const updatedLimits = await cardHelpers.updateCardLimits(req.card, types_1.CardLimitType.PRESENT, req.body);
    res.status(http_status_1.default.CREATED).send(updatedLimits);
};
exports.setCardNotPresentLimitsHandler = async (req, res) => {
    const validationError = cardHelpers.validateCardLimits(req.body, types_1.CardLimitType.NOT_PRESENT);
    if (validationError) {
        handleSetCardLimitValidationError(validationError, res);
        return;
    }
    const updatedLimits = await cardHelpers.updateCardLimits(req.card, types_1.CardLimitType.NOT_PRESENT, req.body);
    res.status(http_status_1.default.CREATED).send(updatedLimits);
};
exports.confirmFraudHandler = async (req, res) => {
    const { fraud_case_id: fraudCaseId } = req.params;
    fraudWatchdog_1.default().confirmFraud(fraudCaseId);
    const response = {
        id: fraudCaseId,
        resolution: types_1.CaseResolution.CONFIRMED,
    };
    res.status(http_status_1.default.OK).send(response);
};
exports.whitelistCardHandler = async (req, res) => {
    const { fraud_case_id: fraudCaseId } = req.params;
    fraudWatchdog_1.default().whitelistCard(fraudCaseId);
    const response = {
        id: fraudCaseId,
        resolution: types_1.CaseResolution.WHITELISTED,
        // https://docs.solarisbank.com/sbdf35fw/api/v1/#5jDUgtyQ-post-whitelist-a-card
        // Card whitelisting timespan, during which the card will not be declined,
        // should the transaction be retried. Timespan is set to 10 mins.
        whitelisted_until: new Date(new Date().getTime() + 10 * 60000).toISOString(),
    };
    res.status(http_status_1.default.OK).send(response);
};
exports.blockCardHandler = async (req, res) => {
    const { person_id: personId, account_id: accountId, id: cardId, status, } = req.card;
    if (![types_1.CardStatus.ACTIVE, types_1.CardStatus.BLOCKED].includes(status)) {
        res.status(http_status_1.default.BAD_REQUEST).send({
            errors: [
                {
                    id: node_uuid_1.default.v4(),
                    status: 400,
                    code: "invalid_status",
                    title: "Invalid Status",
                    detail: `Expected the status for 'Solaris::PlasticCard' to be 'BLOCKED' but was '${status}'.`,
                },
            ],
        });
        return;
    }
    const updatedCard = await cardHelpers.changeCardStatus({ personId, accountId }, cardId, types_1.CardStatus.BLOCKED);
    res.send(updatedCard);
};
exports.unblockCardHandler = async (req, res) => {
    const { person_id: personId, account_id: accountId, id: cardId, status, } = req.card;
    // Solaris sandbox and production does not throw an error in any case.
    // When card is in different state than BLOCK, card details are simply returned.
    if (status !== types_1.CardStatus.BLOCKED) {
        res.send(req.card);
        return;
    }
    const updatedCard = await cardHelpers.changeCardStatus({ personId, accountId }, cardId, types_1.CardStatus.ACTIVE);
    res.send(updatedCard);
};
exports.changePINCardHandler = async (req, res) => {
    const { pin } = req.body;
    const pinValidationErrors = cardHelpers.validatePIN(pin || "");
    if (pinValidationErrors.length) {
        res.status(http_status_1.default.BAD_REQUEST).send({
            errors: pinValidationErrors,
        });
        return;
    }
    const changeRequestResponse = await cardHelpers.changePIN(req.card, pin);
    res.status(http_status_1.default.ACCEPTED).send(changeRequestResponse);
};
exports.confirmChangeCardPINHandler = async (req, res) => {
    const { person_id: personId, tan } = req.body;
    const person = await db.getPerson(personId);
    const { change_request_id: changeRequestId } = req.params;
    const changeRequest = person.changeRequest || {};
    if (changeRequest.changeRequestId !== changeRequestId) {
        res.status(http_status_1.default.NOT_FOUND).send({
            errors: [
                {
                    id: node_uuid_1.default.v4(),
                    status: http_status_1.default.NOT_FOUND,
                    code: "model_not_found",
                    title: "Model Not Found",
                    detail: `Couldn't find 'Solaris::Changeset' for id '${changeRequestId}'.`,
                },
            ],
        });
        return;
    }
    if (changeRequest.token !== tan) {
        res.status(http_status_1.default.UNPROCESSABLE_ENTITY).send({
            errors: [
                {
                    id: node_uuid_1.default.v4(),
                    status: http_status_1.default.UNPROCESSABLE_ENTITY,
                    code: "invalid_tan",
                    title: "Invalid Tan",
                    detail: `The TAN (${tan}) is invalid`,
                },
            ],
        });
        return;
    }
    const confirmResponse = await cardHelpers.confirmChangeCardPIN(person, changeRequest);
    res.status(confirmResponse.response_code).send(confirmResponse);
};
exports.changeCardSettingsHandler = async (req, res) => {
    const person = await db.getPerson(req.card.person_id);
    const updatedSettings = await cardHelpers.updateCardSettings(req.card.id, person, req.body);
    res.send(updatedSettings);
};
exports.closeCardHandler = async (req, res) => {
    const updatedCard = await cardHelpers.changeCardStatus({ personId: req.card.person_id, accountId: req.card.account_id }, req.card.id, types_1.CardStatus.CLOSED);
    res.send(updatedCard);
};
exports.pushProvisioningHandler = async (req, res) => {
    const { card } = req;
    const { wallet_type: walletType } = req.params;
    const errors = [
        "client_wallet_account_id",
        "client_device_id",
        "client_app_id",
    ]
        .filter((fieldName) => !lodash_1.default.get(req.body, fieldName))
        .map((fieldName) => ({
        id: node_uuid_1.default.v4(),
        status: http_status_1.default.BAD_REQUEST,
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
    if (!["google", "samsung"].includes(walletType)) {
        res.status(http_status_1.default.BAD_REQUEST).send({
            errors: [
                {
                    id: node_uuid_1.default.v4(),
                    status: http_status_1.default.BAD_REQUEST,
                    code: "invalid_wallet_type_for_push_provisioning",
                    title: "Invalid Wallet Type",
                    detail: `wallet type ${walletType} is not supported`,
                },
            ],
        });
        return;
    }
    const walletPayload = await cardHelpers.enableGooglePay(card);
    res.status(http_status_1.default.CREATED).send({ wallet_payload: walletPayload });
};
exports.getVirtualCardDetails = async (req, res) => {
    const { body: { jwk, jwe: { alg, enc }, }, card, cardDetails, } = req;
    if (card.status === types_1.CardStatus.PROCESSING) {
        res.status(500).send({
            errors: [
                {
                    id: node_uuid_1.default.v4(),
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
        .filter((fieldName) => !lodash_1.default.get(req.body, fieldName))
        .map((fieldName) => ({
        id: node_uuid_1.default.v4(),
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
        const validAlgMessage = `Valid: ${SUPPORTED_ALG.map((algorithm) => `'${algorithm}'`).join(", ")}`;
        res.status(400).send({
            errors: [
                {
                    id: node_uuid_1.default.v4(),
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
        const result = await node_jose_1.default.JWE.createEncrypt({ format: "compact", enc, alg }, jwk)
            .update(Buffer.from(JSON.stringify(cardDetailsForEncryption)))
            .final();
        res.send({ data: result });
    }
    catch (err) {
        log.error("An error occurred when fetching virtual card details", err);
        res.status(500).send(err);
    }
};
/* eslint-enable @typescript-eslint/camelcase */
//# sourceMappingURL=cards.js.map