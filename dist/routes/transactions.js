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
exports.creteBookingFromReservation = exports.creteBookingFromSepaCreditTransfer = exports.confirmTransaction = exports.authorizeTransaction = exports.createSepaCreditTransfer = exports.createSepaDirectDebit = void 0;
/* eslint-disable camelcase */
const node_uuid_1 = __importDefault(require("node-uuid"));
const moment_1 = __importDefault(require("moment"));
const log = __importStar(require("../logger"));
const db_1 = require("../db");
const types_1 = require("../helpers/types");
const SOLARIS_CARDS_ACCOUNT = {
    NAME: "Visa_Solarisbank",
    IBAN: "DE95110101000018501000",
};
const serializeTransfer = (transfer) => ({
    ...transfer,
    amount: {
        ...transfer.amount,
        value: Math.abs(transfer.amount.value),
        currency: transfer.amount.currency || "EUR",
    },
});
exports.createSepaDirectDebit = async (req, res) => {
    const { amount, description, 
    // eslint-disable-next-line camelcase
    collection_date, mandate, end_to_end_id: e2eId, } = req.body;
    log.debug("createSepaDirectDebit", {
        body: req.body,
        params: req.params,
    });
    const { debtor_iban: iban } = mandate;
    const person = await db_1.findPersonByAccountIBAN(iban);
    const technicalPerson = await db_1.getTechnicalUserPerson();
    const queuedBooking = {
        amount: {
            ...amount,
            value: amount.value,
            currency: amount.currency || "EUR",
        },
        description: description,
        collection_date: collection_date,
        end_to_end_id: e2eId || null,
        id: node_uuid_1.default.v4(),
        mandate,
        booking_type: types_1.BookingType.DIRECT_DEBIT,
        sender_iban: description.includes("Neuversuch")
            ? process.env.KONTIST_IBAN
            : process.env.KONTIST_DD_BILLING_IBAN,
        // for simplicity we set it to current date so we don't have to wait 3+ days for DD to be visible on account statements
        booking_date: moment_1.default().format("YYYY-MM-DD"),
        valuta_date: moment_1.default().format("YYYY-MM-DD"),
        recipient_iban: mandate.debtor_iban,
        sender_name: "Kontist GmbH",
        recipient_name: mandate.debtor_name,
    };
    person.queuedBookings.push(queuedBooking);
    technicalPerson.transactions.push(queuedBooking);
    person.account.balance.value -= Math.abs(amount.value);
    person.account.available_balance = person.account.available_balance || {};
    person.account.available_balance.value = person.account.balance.value;
    log.debug("Person account balance after update", {
        balance: person.account.balance.value,
        bookingAmount: amount.value,
    });
    if (person.account.balance.value < 0) {
        const directDebitReturn = {
            ...queuedBooking,
            booking_type: types_1.BookingType.SEPA_DIRECT_DEBIT_RETURN,
        };
        person.queuedBookings.push(directDebitReturn);
        technicalPerson.transactions.push(directDebitReturn);
    }
    await db_1.savePerson(person);
    await db_1.savePerson(technicalPerson);
    res.status(200).send({
        ...queuedBooking,
        amount: {
            ...queuedBooking.amount,
            value: Math.abs(queuedBooking.amount.value),
        },
    });
};
exports.createSepaCreditTransfer = async (req, res) => {
    const { person_id: personId } = req.params;
    const transfer = req.body;
    log.debug("createSepaCreditTransfer", {
        body: req.body,
        params: req.params,
    });
    const person = await db_1.getPerson(personId);
    const queuedBooking = exports.creteBookingFromSepaCreditTransfer(transfer);
    person.queuedBookings.push(queuedBooking);
    await db_1.savePerson(person);
    log.debug("booking pushed to list of pending transfers", { queuedBooking });
    res.status(200).send(serializeTransfer(queuedBooking));
};
exports.authorizeTransaction = async (req, res) => {
    const { person_id: personId, transfer_id: transferId } = req.params;
    log.debug("authorizeTransaction", {
        body: req.body,
        params: req.params,
    });
    const person = await db_1.getPerson(personId);
    const transfer = person.queuedBookings.find((queuedBooking) => queuedBooking.id === transferId);
    transfer.status = "confirmation_required";
    const token = new Date().getTime().toString().slice(-6);
    person.changeRequest = {
        token,
        id: transferId,
        method: "wiretransfer",
    };
    await db_1.savePerson(person);
    log.info("authorized transfer", { transfer, token });
    res.status(200).send(serializeTransfer(transfer));
};
exports.confirmTransaction = async (req, res) => {
    const { person_id: personId, transfer_id: transferId } = req.params;
    const { authorization_token: token } = req.body;
    const person = await db_1.getPerson(personId);
    const changeRequest = person.changeRequest || {};
    const transfer = person.queuedBookings.find((queuedBooking) => queuedBooking.id === transferId);
    log.info("confirmTransaction", {
        body: req.body,
        params: req.params,
        changeRequest,
    });
    if (transferId !== changeRequest.id || !transfer) {
        return res.status(404).send({
            errors: [
                {
                    id: node_uuid_1.default.v4(),
                    status: 404,
                    code: "model_not_found",
                    title: "Model Not Found",
                    detail: `Couldn't find 'Solaris::WireTransfer' for id '${transferId}'.`,
                },
            ],
        });
    }
    if (token !== changeRequest.token) {
        return res.status(403).send({
            errors: [
                {
                    id: node_uuid_1.default.v4(),
                    status: 403,
                    code: "invalid_tan",
                    title: "Invalid TAN",
                    detail: `Invalid or expired TAN for Solaris::WireTransfer with id: '${transferId}'`,
                },
            ],
        });
    }
    const today = moment_1.default().format("YYYY-MM-DD");
    Object.assign(transfer, {
        transaction_id: transfer.id,
        booking_date: today,
        valuta_date: today,
        name: `bank-mock-transaction-${Math.random()}`,
        status: "accepted",
    });
    person.changeRequest = null;
    await db_1.savePerson(person);
    log.debug("transfer confirmed", { transfer });
    res.status(200).send(serializeTransfer(transfer));
};
exports.creteBookingFromSepaCreditTransfer = ({ id, amount, description = "", end_to_end_id = null, recipient_iban, recipient_name, reference, status, }) => ({
    id: node_uuid_1.default.v4(),
    booking_type: types_1.BookingType.SEPA_CREDIT_TRANSFER,
    amount: {
        ...amount,
        value: -amount.value,
        currency: amount.currency || "EUR",
    },
    description: description,
    end_to_end_id,
    recipient_bic: null,
    recipient_iban,
    recipient_name,
    reference,
    status,
    transaction_id: id,
    booking_date: moment_1.default().format("YYYY-MM-DD"),
    valuta_date: moment_1.default().format("YYYY-MM-DD"),
    meta_info: null,
});
const changeAmountSign = (metaInfo) => {
    const parsedMetaInfo = JSON.parse(metaInfo);
    return JSON.stringify({
        cards: {
            ...parsedMetaInfo.cards,
            original_amount: {
                ...parsedMetaInfo.cards.original_amount,
                // value for booking should be negative
                value: -parsedMetaInfo.cards.original_amount.value,
            },
        },
    });
};
exports.creteBookingFromReservation = (person, reservation, incoming) => {
    const amount = incoming
        ? reservation.amount.value
        : -reservation.amount.value;
    const metaInfo = incoming
        ? reservation.meta_info
        : changeAmountSign(reservation.meta_info);
    return {
        id: node_uuid_1.default.v4(),
        booking_type: types_1.BookingType.CARD_TRANSACTION,
        amount: {
            unit: "cents",
            currency: "EUR",
            value: amount,
        },
        description: reservation.description,
        recipient_bic: person.account.bic,
        recipient_iban: person.account.iban,
        recipient_name: `${person.first_name} ${person.last_name}`,
        sender_bic: process.env.SOLARIS_BIC,
        sender_name: SOLARIS_CARDS_ACCOUNT.NAME,
        sender_iban: SOLARIS_CARDS_ACCOUNT.IBAN,
        booking_date: moment_1.default().format("YYYY-MM-DD"),
        valuta_date: moment_1.default().format("YYYY-MM-DD"),
        meta_info: metaInfo,
    };
};
//# sourceMappingURL=transactions.js.map