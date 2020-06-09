"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.issueInterestAccruedBooking = exports.calculateOverdraftInterest = exports.changeOverdraftApplicationStatus = exports.generateEntityNotFoundPayload = exports.OVERDRAFT_LIMIT = exports.OVERDRAFT_RATE = exports.INTEREST_ACCRUAL_RATE = void 0;
const node_uuid_1 = __importDefault(require("node-uuid"));
const db_1 = require("../db");
const webhooks_1 = require("./webhooks");
const types_1 = require("../helpers/types");
const backoffice_1 = require("../routes/backoffice");
exports.INTEREST_ACCRUAL_RATE = 0.11;
exports.OVERDRAFT_RATE = 0.03;
exports.OVERDRAFT_LIMIT = {
    value: 50000,
    unit: "cents",
    currency: "EUR",
};
exports.generateEntityNotFoundPayload = (field, value) => ({
    id: node_uuid_1.default.v4(),
    status: 404,
    code: "not_found",
    title: "Not Found",
    detail: `Value: '${value}' for field: '${field}' not found`,
    source: {
        message: "not found",
        field,
    },
});
exports.changeOverdraftApplicationStatus = async ({ personId, person, applicationId, status, }) => {
    if (!person) {
        person = await db_1.getPerson(personId);
    }
    const overdraftApplication = person.account.overdraftApplications.find((app) => app.id === applicationId);
    if (overdraftApplication.status === status) {
        return overdraftApplication;
    }
    overdraftApplication.status = status;
    switch (status) {
        case types_1.OverdraftApplicationStatus.REJECTED: {
            overdraftApplication.decision = types_1.OverdraftApplicationDecision.REJECTED;
            break;
        }
        case types_1.OverdraftApplicationStatus.OFFERED: {
            overdraftApplication.limit = exports.OVERDRAFT_LIMIT;
            overdraftApplication.decision = types_1.OverdraftApplicationDecision.OFFERED;
            break;
        }
    }
    await db_1.savePerson(person);
    await webhooks_1.triggerWebhook(types_1.OverdraftApplicationWebhookEvent.OVERDRAFT_APPLICATION, overdraftApplication);
    return overdraftApplication;
};
exports.calculateOverdraftInterest = (account, balance) => {
    const daysInYear = 365;
    const interest = Math.floor((Math.abs(balance) * exports.INTEREST_ACCRUAL_RATE) / daysInYear);
    account.overdraftInterest = (account.overdraftInterest || 0) + interest;
};
exports.issueInterestAccruedBooking = async ({ personId, }) => {
    const person = await db_1.getPerson(personId);
    const booking = backoffice_1.generateBookingForPerson({
        person,
        amount: -person.account.overdraftInterest,
        purpose: "Overdraft interest accrued on the account",
        bookingType: types_1.BookingType.INTEREST_ACCRUED,
    });
    person.account.overdraftInterest = 0;
    person.transactions.push(booking);
    // we don't want to calculate interest again for this transaction
    const skipInterest = true;
    await db_1.savePerson(person, skipInterest);
    await backoffice_1.triggerBookingsWebhook(person.account.id);
};
//# sourceMappingURL=overdraft.js.map