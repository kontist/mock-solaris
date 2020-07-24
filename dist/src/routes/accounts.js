"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.showAccountBalance = exports.createAccountSnapshot = exports.createAccountRequestHandler = exports.createAccount = exports.showPersonAccounts = exports.showPersonAccount = exports.showAccountReservations = exports.showAccountBookings = void 0;
const lodash_1 = __importDefault(require("lodash"));
const node_uuid_1 = __importDefault(require("node-uuid"));
const db_1 = require("../db");
const ibankit_1 = require("ibankit");
const ACCOUNT_SNAPSHOT_SOURCE = "SOLARISBANK";
const DEFAULT_ACCOUNT = {
    id: "df478cbe801e30550f7cea9340783e6bcacc",
    iban: "DE87110101001000022513",
    bic: "SOBKDEBBXXX",
    type: "CHECKING_PERSONAL",
    balance: {
        value: 0,
        unit: "cents",
        currency: "EUR",
    },
    available_balance: {
        value: 0,
        unit: "cents",
        currency: "EUR",
    },
    locking_status: "NO_BLOCK",
    locking_reasons: [],
    account_limit: {
        value: 0,
        unit: "cents",
        currency: "EUR",
    },
    person_id: "66a692fdddc32c05ebe1c1f1c3145a3bcper",
    status: "ACTIVE",
    closure_reasons: null,
};
const requestAccountFields = [
    "id",
    "iban",
    "bic",
    "type",
    "balance",
    "available_balance",
    "locking_status",
    "locking_reasons",
    "account_limit",
    "person_id",
    "status",
    "closure_reasons",
];
exports.showAccountBookings = async (req, res) => {
    const { page: { size, number }, filter: { booking_date: { min, max }, }, } = req.query;
    const { account_id: accountId } = req.params;
    const person = await db_1.findPersonByAccountId(accountId);
    const minBookingDate = new Date(min);
    const maxBookingDate = new Date(max);
    const transactions = lodash_1.default.get(person, "transactions", [])
        .filter((booking) => {
        const bookingDate = new Date(booking.booking_date);
        return bookingDate >= minBookingDate && bookingDate <= maxBookingDate;
    })
        .slice((number - 1) * size, number * size);
    res.status(200).send(transactions);
};
exports.showAccountReservations = async (req, res) => {
    const { page: { size, number }, filter: { expires_at: { min, max }, reservation_type: reservationType, }, } = req.query;
    const { account_id: accountId } = req.params;
    const person = await db_1.findPersonByAccountId(accountId);
    const minExpiresAtDate = new Date(min);
    const maxExpiresAtDate = new Date(max);
    const reservations = lodash_1.default.get(person.account, "reservations", [])
        .filter((reservation) => {
        const expiresAtDate = new Date(reservation.expires_at);
        return (expiresAtDate >= minExpiresAtDate &&
            expiresAtDate <= maxExpiresAtDate &&
            reservation.reservation_type === reservationType);
    })
        .slice((number - 1) * size, number * size);
    res.status(200).send(reservations);
};
exports.showPersonAccount = async (req, res) => {
    const { person_id: personId } = req.params;
    const person = await db_1.getPerson(personId);
    const account = lodash_1.default.pick(person.account, requestAccountFields);
    res.status(200).send(account);
};
exports.showPersonAccounts = async (req, res) => {
    const { person_id: personId } = req.params;
    const person = await db_1.getPerson(personId);
    const accounts = person.account
        ? [lodash_1.default.pick(person.account, requestAccountFields)]
        : [];
    res.status(200).send(accounts);
};
let counter = 0;
exports.createAccount = async (personId, data) => {
    const person = await db_1.getPerson(personId);
    person.account = {
        ...DEFAULT_ACCOUNT,
        ...person.account,
        ...data,
    };
    await db_1.savePerson(person);
    return person.account;
};
exports.createAccountRequestHandler = async (req, res) => {
    const { person_id: personId } = req.params;
    counter++;
    const accountId = personId.split("").reverse().join("");
    const iban = ibankit_1.IBAN.random(ibankit_1.CountryCode.DE).toString();
    const account = await exports.createAccount(personId, {
        ...DEFAULT_ACCOUNT,
        id: accountId,
        iban,
        type: "CHECKING_BUSINESS",
        person_id: personId,
        balance: {
            value: 0,
        },
        available_balance: {
            value: 0,
        },
        sender_name: `bank-mock-${counter}`,
        locking_status: "NO_BLOCK",
    });
    res.status(201).send(account);
};
exports.createAccountSnapshot = async (req, res) => {
    const { body: { account_id: accountId, source }, } = req;
    const person = await db_1.findPersonByAccountId(accountId);
    if (!person) {
        return res.status(404).send({
            id: node_uuid_1.default.v4(),
            status: 404,
            code: "not_found",
            title: "Not Found",
            detail: `Value: ${accountId} for field: 'account_id' not found`,
            source: {
                message: "not found",
                field: "account_id",
            },
        });
    }
    if (source !== ACCOUNT_SNAPSHOT_SOURCE) {
        return res.status(400).send({
            id: node_uuid_1.default.v4(),
            status: 400,
            code: "bad_request",
            title: "Bad Request",
            detail: `/source: Invalid value for enum`,
            source: {
                message: "Invalid value for enum",
                field: "/source",
            },
        });
    }
    const snapshot = {
        status: "available",
        provider: ACCOUNT_SNAPSHOT_SOURCE,
        id: node_uuid_1.default.v4(),
        iban: person.account.iban,
        account_id: accountId,
    };
    person.account.snapshot = snapshot;
    await db_1.savePerson(person);
    return res.status(201).send({
        id: snapshot.id,
        account_id: accountId,
    });
};
exports.showAccountBalance = async (req, res) => {
    const { account_id: accountId } = req.params;
    const person = await db_1.findPersonByAccountId(accountId);
    const balance = lodash_1.default.pick(person.account, ["balance", "available_balance"]);
    res.status(200).send(balance);
};
//# sourceMappingURL=accounts.js.map