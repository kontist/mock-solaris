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
exports.confirmStandingOrderCancelation = exports.cancelStandingOrder = exports.cancelStandingOrderRequestHandler = exports.confirmStandingOrderUpdate = exports.updateStandingOrder = exports.updateStandingOrderRequestHandler = exports.confirmStandingOrderCreation = exports.triggerStandingOrderRequestHandler = exports.generateStandingOrderForPerson = exports.createStandingOrder = exports.createStandingOrderRequestHandler = exports.showStandingOrderRequestHandler = exports.STANDING_ORDER_CANCEL_METHOD = exports.STANDING_ORDER_UPDATE_METHOD = exports.STANDING_ORDER_CREATE_METHOD = void 0;
const crypto_1 = __importDefault(require("crypto"));
const assert_1 = __importDefault(require("assert"));
const moment_1 = __importDefault(require("moment"));
const node_uuid_1 = __importDefault(require("node-uuid"));
const lodash_1 = __importDefault(require("lodash"));
const db_1 = require("../db");
const webhooks_1 = require("../helpers/webhooks");
const log = __importStar(require("../logger"));
const backoffice_1 = require("./backoffice");
const types_1 = require("../helpers/types");
const STANDING_ORDER_PAYMENT_FREQUENCY = {
    MONTHLY: "MONTHLY",
    QUARTERLY: "QUARTERLY",
    EVERYSIXMONTHS: "EVERY_SIX_MONTHS",
    YEARLY: "ANNUALLY",
};
const STANDING_ORDER_PAYMENT_STATUSES = {
    EXECUTED: "EXECUTED",
    DECLINED: "DECLINED",
};
exports.STANDING_ORDER_CREATE_METHOD = "standing_order:create";
exports.STANDING_ORDER_UPDATE_METHOD = "standing_order:update";
exports.STANDING_ORDER_CANCEL_METHOD = "standing_order:cancel";
const STANDING_ORDER_EDITABLE_ATTRIBUTES = [
    "amount",
    "description",
    "end_to_end_id",
    "last_execution_date",
    "reoccurrence",
];
exports.showStandingOrderRequestHandler = async (req, res) => {
    const { person_id: personId, id: standingOrderId } = req.params;
    const { standingOrder } = await getPersonWithStandingOrder(personId, standingOrderId);
    res.status(200).send(standingOrder);
};
exports.createStandingOrderRequestHandler = async (req, res) => {
    const { person_id: personId } = req.params;
    log.info("createStandingOrderRequestHandler()", {
        reqBody: req.body,
        reqParams: req.params,
    });
    const { recipient_name: recipient, recipient_iban: iban, amount, description, end_to_end_id: endToEndId, first_execution_date: firstExecutionDate, last_execution_date: lastExecutionDate, reoccurrence, } = req.body;
    try {
        const { id, createdAt } = await exports.createStandingOrder({
            personId,
            recipient,
            iban,
            amount,
            description,
            endToEndId,
            firstExecutionDate,
            lastExecutionDate,
            reoccurrence,
        });
        return res.status(202).send({
            id,
            status: "AUTHORIZATION_REQUIRED",
            updated_at: createdAt,
            url: ":env/v1/change_requests/:id/authorize",
        });
    }
    catch (err) {
        log.error("createStandingOrderRequestHandler() Creating Standing Order failed", err);
        res.status(500).send({
            reason: err.message,
            status: "Creating Standing Order failed!",
        });
    }
};
/**
 * Saves the standing order to the Person's StandingOrders array.
 * Returns the standing order.
 * @param {Object} standingOrderData
 */
exports.createStandingOrder = async (standingOrderData) => {
    const { personId, recipient, iban, amount, description, endToEndId, firstExecutionDate, lastExecutionDate, reoccurrence, } = standingOrderData;
    if (!recipient || !iban || !amount || !firstExecutionDate || !reoccurrence) {
        log.error("createStandingOrder - field/s missing");
        throw new Error("createStandingOrder - field/s missing");
    }
    const standingOrder = exports.generateStandingOrderForPerson({
        personId,
        recipient,
        iban,
        amount,
        description,
        endToEndId,
        firstExecutionDate,
        lastExecutionDate,
        reoccurrence,
    });
    const person = await backoffice_1.findPersonByIdOrEmail(personId);
    person.changeRequest = {
        method: exports.STANDING_ORDER_CREATE_METHOD,
        id: crypto_1.default.randomBytes(16).toString("hex"),
        createdAt: new Date().toISOString(),
    };
    person.unconfirmedStandingOrders = person.unconfirmedStandingOrders || [];
    person.unconfirmedStandingOrders.push({
        standingOrder,
        changeRequestId: person.changeRequest.id,
    });
    await db_1.savePerson(person);
    return person.changeRequest;
};
exports.generateStandingOrderForPerson = (standingOrderData) => {
    const { personId, description, amount, recipient, iban, endToEndId, reoccurrence, firstExecutionDate, lastExecutionDate, } = standingOrderData;
    const amountValue = Math.max(0, Math.min(10000000, amount.value));
    return {
        id: node_uuid_1.default.v4(),
        reference: personId,
        recipient_name: recipient,
        recipient_iban: iban,
        amount: {
            value: amountValue,
            unit: "cents",
            currency: "EUR",
        },
        description,
        end_to_end_id: endToEndId,
        first_execution_date: moment_1.default(firstExecutionDate).format("YYYY-MM-DD"),
        last_execution_date: lastExecutionDate
            ? moment_1.default(lastExecutionDate).format("YYYY-MM-DD")
            : null,
        month_end_execution: false,
        reoccurrence,
    };
};
/**
 * Triggers the standing order to process as a normal booking.
 */
exports.triggerStandingOrderRequestHandler = async (req, res) => {
    const { personId, standingOrderId } = req.params;
    const declineReason = await checkStandingOrderPreconditions(personId, standingOrderId);
    let booking;
    if (!declineReason) {
        booking = await backoffice_1.processQueuedBooking(personId, standingOrderId, true);
    }
    // We need to update next occurence and call webhook in all cases, even when a standing order is declined
    await updateStandingOrderNextOccurrenceDateAndStatus(personId, standingOrderId);
    await triggerSepaScheduledTransactionWebhook({
        personId,
        standingOrderId,
        booking,
        declineReason,
    });
    res.redirect("back");
};
const checkStandingOrderPreconditions = async (personId, standingOrderId) => {
    const person = await db_1.getPerson(personId);
    const { locking_status: accountLockingStatus } = person.account;
    if (!["NO_BLOCK", "CREDIT_BLOCK"].includes(accountLockingStatus)) {
        return `Expected the status for 'Solaris::Account' to be 'NO_BLOCK, CREDIT_BLOCK' but was '${accountLockingStatus}'`;
    }
    if (!(await hasFundsToExecuteStandingOrder(personId, standingOrderId))) {
        return "There were insufficient funds to complete this action.";
    }
    // All checks have been passed. Standing order is good to go!
    return null;
};
const updateStandingOrderNextOccurrenceDateAndStatus = async (personId, standingOrderId) => {
    const { person, standingOrder } = await getPersonWithStandingOrder(personId, standingOrderId);
    const nextOccurence = getNextOccurrenceDate(moment_1.default(standingOrder.next_occurrence), standingOrder.reoccurrence);
    if (standingOrder.last_execution_date &&
        nextOccurence.isAfter(standingOrder.last_execution_date)) {
        standingOrder.next_occurrence = null;
        standingOrder.status = "INACTIVE";
    }
    else {
        standingOrder.next_occurrence = nextOccurence.format("YYYY-MM-DD");
    }
    await db_1.savePerson(person);
};
const getNextOccurrenceDate = (lastDate, reoccurrence) => {
    switch (reoccurrence) {
        case STANDING_ORDER_PAYMENT_FREQUENCY.MONTHLY:
            return lastDate.add(1, "months");
        case STANDING_ORDER_PAYMENT_FREQUENCY.QUARTERLY:
            return lastDate.add(3, "months");
        case STANDING_ORDER_PAYMENT_FREQUENCY.EVERYSIXMONTHS:
            return lastDate.add(6, "months");
        case STANDING_ORDER_PAYMENT_FREQUENCY.YEARLY:
            return lastDate.add(1, "years");
        default:
            throw new Error(`Unexpected standing order reoccurrence: ${reoccurrence}`);
    }
};
exports.confirmStandingOrderCreation = async (person, changeRequestId) => {
    person.standingOrders = person.standingOrders || [];
    const { standingOrder, index } = findUnconfirmedStandingOrder(person, changeRequestId);
    person.unconfirmedStandingOrders.splice(index, 1);
    standingOrder.status = "ACTIVE";
    standingOrder.next_occurrence = standingOrder.first_execution_date;
    person.standingOrders.push(standingOrder);
    await db_1.savePerson(person);
    return standingOrder;
};
const findUnconfirmedStandingOrder = (person, chgRequestId) => {
    let result = null;
    person.unconfirmedStandingOrders.forEach(({ standingOrder, changeRequestId }, index) => {
        if (chgRequestId === changeRequestId) {
            result = { standingOrder, index };
            return;
        }
    });
    assert_1.default(result !== null, `Could not find a standing order for the given change request id: '${chgRequestId}'`);
    return result;
};
exports.updateStandingOrderRequestHandler = async (req, res) => {
    const { person_id: personId, id: standingOrderId } = req.params;
    const attributesToUpdate = lodash_1.default.pick(req.body, STANDING_ORDER_EDITABLE_ATTRIBUTES);
    log.info("updateStandingOrderRequestHandler()", {
        reqParams: req.params,
        reqBody: req.body,
        attributesToUpdate,
    });
    const changeRequestId = await exports.updateStandingOrder(personId, standingOrderId, attributesToUpdate);
    return res.status(202).send({
        id: changeRequestId,
        status: "AUTHORIZATION_REQUIRED",
        updated_at: new Date().toISOString(),
        url: `:env/v1/change_requests/${changeRequestId}/authorize`,
    });
};
exports.updateStandingOrder = async (personId, standingOrderId, attributesToUpdate) => {
    const person = await backoffice_1.findPersonByIdOrEmail(personId);
    const changeRequestId = Date.now().toString();
    person.changeRequest = {
        id: changeRequestId,
        method: exports.STANDING_ORDER_UPDATE_METHOD,
        standingOrderId,
        attributesToUpdate,
    };
    await db_1.savePerson(person);
    return changeRequestId;
};
exports.confirmStandingOrderUpdate = async (person) => {
    const { standingOrderId, attributesToUpdate } = person.changeRequest;
    const [standingOrder] = person.standingOrders.filter((item) => item.id === standingOrderId);
    lodash_1.default.merge(standingOrder, attributesToUpdate);
    await db_1.savePerson(person);
    return standingOrder;
};
exports.cancelStandingOrderRequestHandler = async (req, res) => {
    const { person_id: personId, id: standingOrderId } = req.params;
    log.info("cancelStandingOrderRequestHandler()", { reqParams: req.params });
    const changeRequestId = await exports.cancelStandingOrder(personId, standingOrderId);
    return res.status(202).send({
        id: changeRequestId,
        status: "AUTHORIZATION_REQUIRED",
        updated_at: new Date().toISOString(),
        url: `:env/v1/change_requests/${changeRequestId}/authorize`,
    });
};
exports.cancelStandingOrder = async (personId, standingOrderId) => {
    const person = await backoffice_1.findPersonByIdOrEmail(personId);
    const changeRequestId = Date.now().toString();
    person.changeRequest = {
        id: changeRequestId,
        method: exports.STANDING_ORDER_CANCEL_METHOD,
        standingOrderId,
    };
    await db_1.savePerson(person);
    return changeRequestId;
};
exports.confirmStandingOrderCancelation = async (person) => {
    const standingOrderId = person.changeRequest.standingOrderId;
    const [standingOrder] = person.standingOrders.filter((item) => item.id === standingOrderId);
    standingOrder.status = "CANCELED";
    await db_1.savePerson(person);
    return standingOrder;
};
const hasFundsToExecuteStandingOrder = async (personId, standingOrderId) => {
    const { person, standingOrder } = await getPersonWithStandingOrder(personId, standingOrderId);
    return person.account.balance.value >= standingOrder.amount.value;
};
const triggerSepaScheduledTransactionWebhook = async ({ personId, standingOrderId, booking, declineReason, }) => {
    const { person, standingOrder } = await getPersonWithStandingOrder(personId, standingOrderId);
    const payload = {
        id: standingOrder.id,
        account_id: person.account.id,
        processed_at: moment_1.default().toISOString(),
        reference: standingOrder.reference,
        source: "standing_order",
        source_id: standingOrder.id,
        status: declineReason
            ? STANDING_ORDER_PAYMENT_STATUSES.DECLINED
            : STANDING_ORDER_PAYMENT_STATUSES.EXECUTED,
        decline_reason: declineReason,
        transaction_id: booking ? booking.transaction_id : null,
    };
    await webhooks_1.triggerWebhook(types_1.TransactionWebhookEvent.SEPA_SCHEDULED_TRANSACTION, payload);
};
const getPersonWithStandingOrder = async (personId, standingOrderId) => {
    const person = await db_1.getPerson(personId);
    const standingOrder = person.standingOrders.find((standingOrder) => standingOrder.id === standingOrderId);
    if (!standingOrder) {
        throw new Error(`Person doesn't have standing order with id: ${standingOrderId}`);
    }
    return { person, standingOrder };
};
//# sourceMappingURL=standingOrders.js.map