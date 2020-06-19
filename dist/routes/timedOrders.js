"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTimedOrder = exports.cancelTimedOrder = exports.fetchTimedOrder = exports.fetchTimedOrders = exports.confirmTimedOrder = exports.authorizeTimedOrder = exports.createTimedOrder = exports.processTimedOrders = exports.triggerTimedOrder = exports.TIMED_ORDER_CREATE = void 0;
const node_uuid_1 = __importDefault(require("node-uuid"));
const http_status_1 = __importDefault(require("http-status"));
const moment_1 = __importDefault(require("moment"));
const db_1 = require("../db");
const backoffice_1 = require("./backoffice");
const webhooks_1 = require("../helpers/webhooks");
const types_1 = require("../helpers/types");
const SOLARIS_TIMED_ORDER_STATUSES = {
    CREATED: "CREATED",
    AUTHORIZATION_REQUIRED: "AUTHORIZATION_REQUIRED",
    CONFIRMATION_REQUIRED: "CONFIRMATION_REQUIRED",
    EXECUTED: "EXECUTED",
    FAILED: "FAILED",
    SCHEDULED: "SCHEDULED",
    CANCELED: "CANCELED",
};
exports.TIMED_ORDER_CREATE = "timed_orders:create";
const mapTimedOrderToTransaction = (timedOrder) => {
    const { id: timedOrderId, executed_at: executedAt, scheduled_transaction: { id, reference, description, end_to_end_id: e2eId, recipient_iban: recipientIBAN, recipient_name: recipientName, recipient_bic: recipientBIC, amount, }, } = timedOrder;
    return {
        id,
        description,
        e2eId,
        reference,
        name: recipientName,
        amount: {
            ...amount,
            value: -amount.value,
        },
        valuta_date: executedAt,
        booking_date: executedAt,
        recipient_iban: recipientIBAN,
        recipient_name: recipientName,
        recipient_bic: recipientBIC,
        transaction_id: timedOrderId,
        status: "accepted",
        booking_type: types_1.BookingType.SEPA_CREDIT_TRANSFER,
    };
};
const shouldProcessTimedOrder = (timedOrder) => timedOrder.status === SOLARIS_TIMED_ORDER_STATUSES.SCHEDULED &&
    !timedOrder.executed_at &&
    moment_1.default(timedOrder.execute_at).isSameOrBefore(moment_1.default(), "day");
const processTimedOrder = async (person, timedOrder) => {
    const timedOrderValue = Math.abs(timedOrder.scheduled_transaction.amount.value);
    timedOrder.executed_at = new Date().toISOString();
    // if user has less money on account than timed order value, timed order fails
    if (person.account.balance.value < timedOrderValue) {
        timedOrder.status = SOLARIS_TIMED_ORDER_STATUSES.FAILED;
    }
    else {
        person.account.balance.value -= timedOrderValue;
        person.account.available_balance.value = person.account.balance.value;
        person.transactions.push(mapTimedOrderToTransaction(timedOrder));
        timedOrder.status = SOLARIS_TIMED_ORDER_STATUSES.EXECUTED;
    }
    const itemIndex = person.timedOrders.findIndex((to) => to.id === timedOrder.id);
    person.timedOrders[itemIndex] = timedOrder;
    const updatedPerson = await db_1.savePerson(person);
    await triggerTimedOrderWebhook(person, timedOrder);
    if (timedOrder.status === SOLARIS_TIMED_ORDER_STATUSES.EXECUTED) {
        await backoffice_1.triggerBookingsWebhook(person.account.id);
    }
    return updatedPerson;
};
exports.triggerTimedOrder = async (personId, timedOrderId) => {
    const person = await db_1.getPerson(personId);
    const timedOrder = person.timedOrders.find(({ id }) => id === timedOrderId);
    await processTimedOrder(person, timedOrder);
};
exports.processTimedOrders = async (personId) => {
    const person = await db_1.getPerson(personId);
    for (const timedOrder of person.timedOrders) {
        if (!shouldProcessTimedOrder(timedOrder)) {
            continue;
        }
        await processTimedOrder(person, timedOrder);
    }
};
exports.createTimedOrder = async (req, res) => {
    const { body } = req;
    const { person_id: personId } = req.params;
    const person = await db_1.getPerson(personId);
    const { execute_at: executeAt, transaction: { recipient_name: recipientName, recipient_iban: recipientIban, reference, amount, }, } = body;
    const isDataMissing = ![
        executeAt,
        recipientName,
        recipientIban,
        reference,
        amount.value,
        amount.unit,
        amount.currency,
    ].every((value) => value);
    if (isDataMissing) {
        return res.status(http_status_1.default.BAD_REQUEST).send({
            errors: [
                {
                    id: Date.now().toString(),
                    status: http_status_1.default.BAD_REQUEST,
                    code: "invalid_model",
                    title: "Invalid Model",
                    detail: "missing fields",
                },
            ],
        });
    }
    const timedOrder = exports.generateTimedOrder(body);
    person.timedOrders.push(timedOrder);
    await db_1.savePerson(person);
    res.status(http_status_1.default.CREATED).send(timedOrder);
};
exports.authorizeTimedOrder = async (req, res) => {
    const { person_id: personId, id } = req.params;
    const { delivery_method: deliveryMethod } = req.body;
    if (deliveryMethod !== "mobile_number") {
        return res.status(http_status_1.default.INTERNAL_SERVER_ERROR).send({
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
    }
    const person = await db_1.getPerson(personId);
    const timedOrder = person.timedOrders.find((order) => order.id === req.params.id);
    timedOrder.status = SOLARIS_TIMED_ORDER_STATUSES.CONFIRMATION_REQUIRED;
    person.changeRequest = {
        id,
        method: exports.TIMED_ORDER_CREATE,
        token: new Date().getTime().toString().slice(-6),
    };
    await db_1.savePerson(person);
    res.status(http_status_1.default.CREATED).send(timedOrder);
};
exports.confirmTimedOrder = async (req, res) => {
    const { person_id: personId, id } = req.params;
    const { authorization_token: token } = req.body;
    const person = await db_1.getPerson(personId);
    const changeRequest = person.changeRequest || {};
    if (id !== changeRequest.id) {
        return res.status(http_status_1.default.NOT_FOUND).send({
            errors: [
                {
                    id: node_uuid_1.default.v4(),
                    status: 404,
                    code: "model_not_found",
                    title: "Model Not Found",
                    detail: `Couldn't find 'Solaris::TimedOrder' for id '${id}'.`,
                },
            ],
        });
    }
    if (token !== changeRequest.token) {
        return res.status(http_status_1.default.FORBIDDEN).send({
            errors: [
                {
                    id: node_uuid_1.default.v4(),
                    status: 403,
                    code: "invalid_tan",
                    title: "Invalid TAN",
                    detail: `Invalid or expired TAN for Solaris::TimedOrder with uid: '${id}'`,
                },
            ],
        });
    }
    const timedOrder = person.timedOrders.find((order) => order.id === req.params.id);
    timedOrder.status = SOLARIS_TIMED_ORDER_STATUSES.SCHEDULED;
    person.changeRequest = null;
    await db_1.savePerson(person);
    return res.status(http_status_1.default.CREATED).send(timedOrder);
};
exports.fetchTimedOrders = async (req, res) => {
    const { timedOrders } = await db_1.getPerson(req.params.person_id);
    let { size: pageSize = 10 } = req.query.page || {};
    if (pageSize > 1000) {
        pageSize = 1000;
    }
    const response = timedOrders.slice(0, pageSize);
    res.send(response);
};
exports.fetchTimedOrder = async (req, res) => {
    const person = await db_1.getPerson(req.params.person_id);
    const timedOrderId = req.params.id;
    const timedOrder = person.timedOrders.find((order) => order.id === timedOrderId);
    if (!timedOrder) {
        res.status(404).send({
            errors: [
                {
                    id: node_uuid_1.default.v4(),
                    status: 404,
                    code: "model_not_found",
                    title: "Model Not Found",
                    detail: `Couldn't find 'Solaris::TimedOrder' for id '${timedOrderId}'.`,
                },
            ],
        });
    }
    res.send(timedOrder);
};
exports.cancelTimedOrder = async (req, res) => {
    const person = await db_1.getPerson(req.params.person_id);
    const timedOrder = person.timedOrders.find((order) => order.id === req.params.id);
    timedOrder.status = SOLARIS_TIMED_ORDER_STATUSES.CANCELED;
    timedOrder.scheduled_transaction.status = "canceled";
    await db_1.savePerson(person);
    res.send(timedOrder);
};
exports.generateTimedOrder = (data) => {
    const { execute_at: executeAt, transaction: { recipient_name: recipientName, recipient_iban: recipientIban, recipient_bic: recipientBIC, reference, description, end_to_end_id: e2eId, amount: { value, currency, unit }, }, } = data;
    const template = {
        id: node_uuid_1.default.v4(),
        execute_at: executeAt,
        executed_at: null,
        status: SOLARIS_TIMED_ORDER_STATUSES.AUTHORIZATION_REQUIRED,
        scheduled_transaction: {
            id: node_uuid_1.default.v4(),
            status: "scheduled",
            reference,
            description,
            recipient_iban: recipientIban,
            recipient_name: recipientName,
            recipient_bic: recipientBIC,
            end_to_end_id: e2eId,
            batch_id: null,
            created_at: new Date().toISOString(),
            amount: {
                value,
                currency,
                unit,
            },
        },
    };
    return template;
};
const triggerTimedOrderWebhook = async (person, timedOrder) => {
    const { id, status, scheduled_transaction: { reference }, } = timedOrder;
    const payload = {
        id,
        reference,
        status,
        account_id: person.account.id,
        processed_at: new Date().toISOString(),
    };
    await webhooks_1.triggerWebhook(types_1.TransactionWebhookEvent.SEPA_TIMED_ORDER, payload);
};
//# sourceMappingURL=timedOrders.js.map