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
exports.triggerWebhook = void 0;
const node_uuid_1 = __importDefault(require("node-uuid"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const log = __importStar(require("../logger"));
const db_1 = require("../db");
const solarisWebhookSignature_1 = require("./solarisWebhookSignature");
const types_1 = require("./types");
const verificationSecret = {
    [types_1.OverdraftApplicationWebhookEvent.OVERDRAFT_APPLICATION]: process.env.SOLARIS_OVERDRAFT_APPLICATION_WEBHOOK_SECRET,
    [types_1.CardWebhookEvent.CARD_AUTHORIZATION]: process.env.SOLARIS_CARD_AUTHORIZATION_WEBHOOK_SECRET,
    [types_1.CardWebhookEvent.CARD_AUTHORIZATION_RESOLUTION]: process.env.SOLARIS_CARD_AUTHORIZATION_RESOLUTION_WEBHOOK_SECRET,
    [types_1.CardWebhookEvent.CARD_AUTHORIZATION_DECLINE]: process.env.SOLARIS_CARD_AUTHORIZATION_DECLINE_WEBHOOK_SECRET,
    [types_1.CardWebhookEvent.CARD_FRAUD_CASE_PENDING]: process.env.SOLARIS_CARD_FRAUD_CASE_PENDING_WEBHOOK_SECRET,
    [types_1.CardWebhookEvent.CARD_FRAUD_CASE_TIMEOUT]: process.env.SOLARIS_CARD_FRAUD_CASE_TIMEOUT_WEBHOOK_SECRET,
    [types_1.CardWebhookEvent.CARD_LIFECYCLE_EVENT]: process.env.SOLARIS_CARD_LIFECYCLE_EVENT_WEBHOOK_SECRET,
    [types_1.CardWebhookEvent.CARD_TOKEN_LIFECYCLE]: process.env.SOLARIS_CARD_TOKEN_LIFECYCLE_WEBHOOK_SECRET,
    [types_1.CardWebhookEvent.CARD_FRAUD_CASE]: process.env.SOLARIS_CARD_FRAUD_CASE_WEBHOOK_SECRET,
    [types_1.PersonWebhookEvent.IDENTIFICATION]: process.env.SOLARIS_IDENTIFICATION_WEBHOOK_SECRET,
    [types_1.PersonWebhookEvent.PERSON_SEIZURE_CREATED]: process.env.SOLARIS_PERSON_SEIZURE_CREATED_WEBHOOK_SECRET,
    [types_1.PersonWebhookEvent.PERSON_SEIZURE_DELETED]: process.env.SOLARIS_PERSON_SEIZURE_DELETED_WEBHOOK_SECRET,
    [types_1.PersonWebhookEvent.PERSON_DELETED]: process.env.SOLARIS_PERSON_DELETED_WEBHOOK_SECRET,
    [types_1.TransactionWebhookEvent.BOOKING]: process.env.SOLARIS_BOOKING_WEBHOOK_SECRET,
    [types_1.TransactionWebhookEvent.SEPA_SCHEDULED_TRANSACTION]: process.env.SOLARIS_SEPA_SCHEDULED_TRANSACTION_WEBHOOK_SECRET,
    [types_1.TransactionWebhookEvent.SEPA_TIMED_ORDER]: process.env.SOLARIS_SEPA_TIMED_ORDER_WEBHOOK_SECRET,
    [types_1.TransactionWebhookEvent.SEPA_DIRECT_DEBIT_RETURN]: process.env.SOLARIS_SEPA_DIRECT_DEBIT_RETURN_WEBHOOK_SECRET,
    [types_1.AccountWebhookEvent.ACCOUNT_BLOCK]: process.env.SOLARIS_ACCOUNT_BLOCK_WEBHOOK_SECRET,
    [types_1.AccountWebhookEvent.ACCOUNT_CLOSURE]: process.env.SOLARIS_ACCOUNT_CLOSURE_WEBHOOK_SECRET,
};
exports.triggerWebhook = async (type, payload) => {
    const webhook = await db_1.getWebhookByType(type);
    if (!webhook) {
        log.warn(`(triggerWebhook) Webhook with type "${type}" does not exist`);
        return;
    }
    let headers = { "Content-Type": "application/json" };
    if ([
        types_1.CardWebhookEvent.CARD_AUTHORIZATION,
        types_1.CardWebhookEvent.CARD_AUTHORIZATION_RESOLUTION,
        types_1.CardWebhookEvent.CARD_AUTHORIZATION_DECLINE,
        types_1.OverdraftApplicationWebhookEvent.OVERDRAFT_APPLICATION,
    ].includes(type)) {
        const solarisWebhookSignature = solarisWebhookSignature_1.generateSolarisWebhookSignature(payload, verificationSecret[type]);
        headers = {
            ...headers,
            "solaris-entity-id": payload.id || node_uuid_1.default.v4(),
            "solaris-webhook-attempt": "1",
            "solaris-webhook-event-type": type,
            "solaris-webhook-id": node_uuid_1.default.v4(),
            "solaris-webhook-signature": solarisWebhookSignature,
            "solaris-webhook-subscription-id": "STATIC-SUBSCRIPTION",
        };
    }
    await node_fetch_1.default(webhook.url, {
        method: "POST",
        body: JSON.stringify({
            id: node_uuid_1.default.v4(),
            ...payload,
        }),
        headers,
    });
};
//# sourceMappingURL=webhooks.js.map