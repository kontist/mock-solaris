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
exports.createWebhookHandler = exports.indexWebhooksHandler = void 0;
const node_uuid_1 = __importDefault(require("node-uuid"));
const db_1 = require("../db");
const log = __importStar(require("../logger"));
exports.indexWebhooksHandler = async (req, res) => {
    const { page: { size = 10, number = 1 } = {} } = req.query;
    const webhooks = await db_1.getWebhooks();
    const response = webhooks.slice((number - 1) * size, size * number);
    res.send(response);
};
const createWebhook = async (newWebhook) => {
    const webhooks = await db_1.getWebhooks();
    const webhookExists = webhooks.find((webhook) => {
        return (webhook.url === newWebhook.url &&
            webhook.event_type === newWebhook.event_type);
    });
    if (webhookExists) {
        return false;
    }
    await db_1.saveWebhook(newWebhook);
    return true;
};
exports.createWebhookHandler = async (req, res) => {
    const newWebhook = {
        id: node_uuid_1.default.v4(),
        ...req.body,
    };
    log.info("createWebhook", { newWebhook });
    const wasWebhookCreated = await createWebhook(newWebhook);
    if (wasWebhookCreated) {
        res.status(201).send(newWebhook);
    }
    else {
        res.status(400).send("Webhook already exists");
    }
};
//# sourceMappingURL=webhooks.js.map