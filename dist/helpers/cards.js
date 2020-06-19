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
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCardSettings = exports.confirmChangeCardPIN = exports.changePIN = exports.validatePIN = exports.enableGooglePay = exports.updateCardLimits = exports.validateCardLimits = exports.activateCard = exports.changeCardStatus = exports.getCards = exports.replaceCard = exports.createCard = exports.createCardToken = exports.getMaskedCardNumber = exports.validatePersonData = exports.validateCardData = exports.CardErrorCodes = exports.CHANGE_REQUEST_CHANGE_CARD_PIN = void 0;
/* eslint-disable @typescript-eslint/camelcase */
const lodash_1 = __importDefault(require("lodash"));
const node_uuid_1 = __importDefault(require("node-uuid"));
const moment_1 = __importDefault(require("moment"));
const http_status_1 = __importDefault(require("http-status"));
const db = __importStar(require("../db"));
const webhooks_1 = require("./webhooks");
const types_1 = require("./types");
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
const SOLARIS_HARDCODED_WALLET_PAYLOAD = "eyJhbGciOiJBMjU2R0NNS1ciLCJjaGFubmVsU2VjdXJpdHlDb250ZXh0IjoiU0hBUkVEX1NFQ1JFVCIsImVuYyI6IkEyNTZHQ00iLCJpYXQiOjE1ODA4MTM2NjQsIml2IjoiRm44OENLQUFlTG1KdHhNbiIsImtpZCI6IjhTTU5BWkRZTVFIQUFNNFU3S1ZZMTNDN0NlajVqdEVZbFI1MFhGRTdJd0R4RG9idE0iLCJ0YWciOiJVdGNXRTlwWWdKR1VWUDRoZFJFd3pBIiwidHlwIjoiSk9TRSJ9.Qm5IAXivznZnnDupvWt7JRg7retEIjA4CWRGRaiTpqw.AbNpQJbPzfTp3NyE.PHHBPrH44IKlnuhzdbhJ_wDAuptLP41RfYqsK26yZP8acPlm3ThNYGZbvTXZE1w7d-AKWIHS2UZo1BDEoNsrMT9JeITyWjEyPRfcLmDAe3XU7g5QE-LzwJaB-O8zBWU02LC5qjIHfSTG-zJEBrIn0QZONG7mYnEob9jB1c7WKDtfbRH4Fi0eChRQY20xzsMDRwXn2NjFTPfctGeBUj8hUIuvrWDy5SAKSW-zbEPRnyN4aKutrSarf_Gfdi_ufGlfbC2Ad-ImHzg2TOEQNgN3OUaNkfHEhFxV8-4hS5K7SPMUFSNPnHRy7Ffcg4Btc6RgSNTvykVfGrz8fAdzv5Yxmq-3aJ9BH3of5J7DN0ws6iX67lcpCHvJh6bGJ0iCl3bVE6a9BTHR3vr1lJhS16k8rTfnHyrLwJpsjQa9KfVsjLIEmw.PFLc9sbT7ljf-f3nT5knnw";
exports.CHANGE_REQUEST_CHANGE_CARD_PIN = "card_pin";
var CardErrorCodes;
(function (CardErrorCodes) {
    CardErrorCodes["CARD_ACTIVATION_INVALID_STATUS"] = "card_activation_invalid_status";
    CardErrorCodes["INVALID_VERIFICATION_TOKEN"] = "invalid_verification_token";
    CardErrorCodes["VERIFICATION_TOKEN_TOO_LONG"] = "verification_token_too_long";
})(CardErrorCodes = exports.CardErrorCodes || (exports.CardErrorCodes = {}));
exports.validateCardData = async (cardData, cardDetails) => {
    const errors = [];
    if (!types_1.CardType[cardData.type]) {
        errors.push({
            id: node_uuid_1.default.v4(),
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
            id: node_uuid_1.default.v4(),
            status: 400,
            code: "validation_error",
            title: "Validation Error",
            detail: "line_1 is missing, is empty, is invalid",
            source: {
                field: "line_1",
                message: "is missing, is empty, is invalid",
            },
        });
    }
    else if (cardHolder.length > CARD_HOLDER_MAX_LENGTH) {
        errors.push({
            id: node_uuid_1.default.v4(),
            status: 400,
            code: "validation_error",
            title: "Validation Error",
            detail: `line_1 is longer than ${CARD_HOLDER_MAX_LENGTH} characters, is invalid`,
            source: {
                field: "line_1",
                message: `is longer than ${CARD_HOLDER_MAX_LENGTH} characters, is invalid`,
            },
        });
    }
    else {
        const hasValidChars = cardHolder
            .split("")
            .every((char) => CARD_HOLDER_ALLOWED_CHARS.includes(char));
        const [firstName, lastName, ...rest] = cardHolder.split("/");
        if (!hasValidChars || !firstName || !lastName || rest.length > 0) {
            errors.push({
                id: node_uuid_1.default.v4(),
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
                id: node_uuid_1.default.v4(),
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
exports.validatePersonData = async (person) => {
    const errors = [];
    const mobileNumber = await db.getMobileNumber(person.id);
    const hasValidMobileNumber = mobileNumber && mobileNumber.verified;
    if (!hasValidMobileNumber) {
        errors.push({
            id: node_uuid_1.default.v4(),
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
exports.getMaskedCardNumber = (cardNumber) => `${cardNumber.slice(0, 4)}********${cardNumber.slice(-4)}`;
exports.createCardToken = () => lodash_1.default.times(12, () => lodash_1.default.random(35).toString(36))
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
    token: exports.createCardToken(),
    cardPresentLimits: getDefaultCardPresentLimits(),
    cardNotPresentLimits: getDefaultCardNotPresentLimits(),
    cvv: Math.random().toString().substr(-3),
    settings: {
        contactless_enabled: true,
    },
});
exports.createCard = (cardData, person) => {
    const { pin, type, business_id: businessId = null, reference, line_1: cardHolder, } = cardData;
    const id = node_uuid_1.default.v4().replace(/-/g, "");
    const expirationDate = moment_1.default().add(3, "years");
    const cardNumber = Math.random()
        .toString()
        .substr(2)
        .padEnd(16, "0")
        .substr(0, 16);
    const card = {
        id,
        type,
        status: types_1.CardStatus.PROCESSING,
        expiration_date: expirationDate.format("YYYY-MM-DD"),
        person_id: person.id,
        account_id: person.account.id,
        business_id: businessId,
        representation: {
            line_1: cardHolder,
            formatted_expiration_date: expirationDate.format("MM/YY"),
            masked_pan: exports.getMaskedCardNumber(cardNumber),
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
exports.replaceCard = (cardData, card, cardDetails) => {
    const newCard = {
        ...card,
        representation: {
            ...card.representation,
            line_1: cardData.line_1 || card.representation.line_1,
        },
        status: types_1.CardStatus.PROCESSING,
    };
    const newCardDetails = {
        ...cardDetails,
        pin: cardData.pin || cardDetails.pin,
        ...getDefaultCardDetails(),
    };
    return { card: newCard, cardDetails: newCardDetails };
};
exports.getCards = (person) => {
    return ((person.account && person.account.cards) || []).map(({ card }) => card);
};
exports.changeCardStatus = async ({ personId, accountId }, cardId, newCardStatus) => {
    let person;
    if (personId) {
        person = await db.getPerson(personId);
    }
    else if (accountId) {
        person = db.findPersonByAccountId(accountId);
    }
    else {
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
    await webhooks_1.triggerWebhook(types_1.CardWebhookEvent.CARD_LIFECYCLE_EVENT, cardData.card);
    return cardData.card;
};
exports.activateCard = async (cardForActivation, verificationToken) => {
    if (cardForActivation.type === types_1.CardType.VIRTUAL_VISA_FREELANCE_DEBIT) {
        return cardForActivation;
    }
    if (cardForActivation.status !== types_1.CardStatus.INACTIVE) {
        throw new Error(CardErrorCodes.CARD_ACTIVATION_INVALID_STATUS);
    }
    const person = await db.getPerson(cardForActivation.person_id);
    const cardIndex = person.account.cards.findIndex(({ card }) => card.id === cardForActivation.id);
    if (verificationToken.length > 6) {
        throw new Error(CardErrorCodes.VERIFICATION_TOKEN_TOO_LONG);
    }
    const isValidToken = person.account.cards[cardIndex].cardDetails.token.substr(0, 6) ===
        verificationToken;
    if (!isValidToken) {
        throw new Error(CardErrorCodes.INVALID_VERIFICATION_TOKEN);
    }
    cardForActivation.status = types_1.CardStatus.ACTIVE;
    person.account.cards[cardIndex].card = cardForActivation;
    await db.savePerson(person);
    await webhooks_1.triggerWebhook(types_1.CardWebhookEvent.CARD_LIFECYCLE_EVENT, cardForActivation);
    return cardForActivation;
};
exports.validateCardLimits = (cardLimits, limitType) => {
    const errors = [];
    const maxDailyNumberOfTransactions = limitType === types_1.CardLimitType.PRESENT
        ? CARD_PRESENT_DAILY_MAX_NUMBER_TRANSACTIONS
        : CARD_NOT_PRESENT_DAILY_MAX_NUMBER_TRANSACTIONS;
    const maxDailyAmountInCents = limitType === types_1.CardLimitType.PRESENT
        ? CARD_PRESENT_DAILY_MAX_AMOUNT_IN_CENTS
        : CARD_NOT_PRESENT_DAILY_MAX_AMOUNT_IN_CENTS;
    const maxMonthlyNumberOfTransactions = limitType === types_1.CardLimitType.PRESENT
        ? CARD_PRESENT_MONTHLY_MAX_NUMBER_TRANSACTIONS
        : CARD_NOT_PRESENT_MONTHLY_MAX_NUMBER_TRANSACTIONS;
    const maxMonthlyAmountInCents = limitType === types_1.CardLimitType.PRESENT
        ? CARD_PRESENT_MONTHLY_MAX_AMOUNT_IN_CENTS
        : CARD_NOT_PRESENT_MONTHLY_MAX_AMOUNT_IN_CENTS;
    if (cardLimits.daily.max_transactions > maxDailyNumberOfTransactions ||
        cardLimits.daily.max_amount_cents > maxDailyAmountInCents) {
        errors.push(`limit too high. Max DAILY transactions amount: ${maxDailyNumberOfTransactions} and Max DAILY amount in cents: ${maxDailyAmountInCents}`);
    }
    if (cardLimits.monthly.max_transactions > maxMonthlyNumberOfTransactions ||
        cardLimits.monthly.max_amount_cents > maxMonthlyAmountInCents) {
        errors.push(`limit too high. Max MONTHLY transactions amount: ${maxMonthlyNumberOfTransactions} and Max MONTHLY amount in cents: ${maxMonthlyAmountInCents}`);
    }
    if (cardLimits.daily.max_transactions < 0 ||
        cardLimits.daily.max_amount_cents < 0) {
        errors.push(`limit negative. DAILY values cannot be negative, negative.`);
    }
    if (cardLimits.monthly.max_transactions < 0 ||
        cardLimits.monthly.max_amount_cents < 0) {
        errors.push(`limit negative. MONTHLY values cannot be negative, negative.`);
    }
    if (errors.length) {
        return errors.join(". ");
    }
    return null;
};
exports.updateCardLimits = async (card, cardLimitType, newLimits) => {
    const person = await db.getPerson(card.person_id);
    const cardIndex = person.account.cards.findIndex((cardData) => cardData.card.id === card.id);
    person.account.cards[cardIndex].cardDetails[cardLimitType === types_1.CardLimitType.PRESENT
        ? "cardPresentLimits"
        : "cardNotPresentLimits"] = newLimits;
    await db.savePerson(person);
    return newLimits;
};
exports.enableGooglePay = async (card) => {
    const person = await db.getPerson(card.person_id);
    const cardIndex = person.account.cards.findIndex((cardData) => cardData.card.id === card.id);
    person.account.cards[cardIndex].cardDetails.walletPayload = SOLARIS_HARDCODED_WALLET_PAYLOAD;
    await db.savePerson(person);
    return SOLARIS_HARDCODED_WALLET_PAYLOAD;
};
const hasAtLeast3UniqueDigits = (pin) => lodash_1.default.uniq(pin.split("")).length >= 3;
const isSequence = (pin) => {
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
exports.validatePIN = (pin) => {
    const errors = [];
    if (isSequence(pin)) {
        errors.push([
            {
                id: node_uuid_1.default.v4(),
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
                id: node_uuid_1.default.v4(),
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
exports.changePIN = async (card, pin) => {
    const person = await db.getPerson(card.person_id);
    const changeRequestId = node_uuid_1.default.v4();
    person.changeRequest = {
        pin,
        changeRequestId,
        cardId: card.id,
        method: exports.CHANGE_REQUEST_CHANGE_CARD_PIN,
    };
    await db.savePerson(person);
    return {
        id: changeRequestId,
        status: "AUTHORIZATION_REQUIRED",
        updated_at: new Date().toISOString(),
        url: `:env/v1/change_requests/${changeRequestId}/authorize`,
    };
};
exports.confirmChangeCardPIN = async (person, changeRequest) => {
    const cardIndex = person.account.cards.findIndex(({ card }) => card.id === changeRequest.cardId);
    person.account.cards[cardIndex].cardDetails.pin = changeRequest.pin;
    person.changeRequest = null;
    await db.savePerson(person);
    return {
        id: changeRequest.changeRequestId,
        status: types_1.ChangeRequestStatus.COMPLETED,
        updated_at: new Date().toISOString(),
        response_body: "Accepted",
        response_code: http_status_1.default.ACCEPTED,
    };
};
exports.updateCardSettings = async (cardId, person, settings) => {
    const cardIndex = person.account.cards.findIndex(({ card }) => card.id === cardId);
    if (typeof settings.contactless_enabled !== "boolean") {
        return person.account.cards[cardIndex].cardDetails.settings;
    }
    person.account.cards[cardIndex].cardDetails.settings = settings;
    await db.savePerson(person);
    return settings;
};
/* eslint-enable @typescript-eslint/camelcase */
//# sourceMappingURL=cards.js.map