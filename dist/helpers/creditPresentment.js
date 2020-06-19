"use strict";
/* eslint-disable @typescript-eslint/camelcase */
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
exports.createCreditPresentment = void 0;
const db = __importStar(require("../db"));
const moment_1 = __importDefault(require("moment"));
const reservations_1 = require("./reservations");
const transactions_1 = require("../routes/transactions");
const backoffice_1 = require("../routes/backoffice");
const types_1 = require("./types");
exports.createCreditPresentment = async ({ personId, cardId, amount, currency, type, recipient, }) => {
    const person = await db.getPerson(personId);
    const cardData = person.account.cards.find(({ card }) => card.id === cardId);
    if (!cardData) {
        throw new Error("Card not found");
    }
    const date = moment_1.default().toDate();
    const convertedAmount = Math.abs(parseInt(amount, 10));
    const metaInfo = reservations_1.generateMetaInfo({
        originalAmount: convertedAmount,
        originalCurrency: currency,
        recipient,
        cardId,
        date,
        type,
        incoming: true,
        posEntryMode: types_1.POSEntryMode.CARD_NOT_PRESENT,
    });
    const booking = transactions_1.creteBookingFromReservation(person, {
        amount: { value: Math.round(convertedAmount * types_1.FxRate[currency]) },
        description: recipient,
        meta_info: metaInfo,
    }, true);
    person.transactions.push(booking);
    await db.savePerson(person);
    await backoffice_1.triggerBookingsWebhook(person.account.id);
};
//# sourceMappingURL=creditPresentment.js.map