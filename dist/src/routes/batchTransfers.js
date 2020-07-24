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
exports.confirmBatchTransfer = exports.createBatchTransfer = exports.saveBatchTransfer = exports.BATCH_TRANSFER_CREATE_METHOD = void 0;
/* eslint-disable camelcase */
const crypto_1 = __importDefault(require("crypto"));
const assert_1 = __importDefault(require("assert"));
const http_status_1 = __importDefault(require("http-status"));
const log = __importStar(require("../logger"));
const backoffice_1 = require("./backoffice");
const transactions_1 = require("./transactions");
const db_1 = require("../db");
exports.BATCH_TRANSFER_CREATE_METHOD = "batch_transfer:create";
const validateTransfers = (transfers) => {
    const references = [];
    for (const transfer of transfers) {
        const { recipient_name, recipient_iban, amount, reference } = transfer;
        if (references.includes(reference)) {
            log.error("validateTransfers - reference not unique");
            throw new Error("validateTransfers - reference not unique");
        }
        references.push(reference);
        if (!recipient_name || !recipient_iban || !amount || !amount.value) {
            log.error("validateTransfers - field/s missing");
            throw new Error("validateTransfers - field/s missing");
        }
    }
};
exports.saveBatchTransfer = async (personId, transfers) => {
    const person = await backoffice_1.findPersonByIdOrEmail(personId);
    person.changeRequest = {
        method: exports.BATCH_TRANSFER_CREATE_METHOD,
        id: crypto_1.default.randomBytes(16).toString("hex"),
        createdAt: new Date().toISOString(),
    };
    person.unconfirmedBatchTransfers = person.unconfirmedBatchTransfers || [];
    person.unconfirmedBatchTransfers.push({
        transfers,
        changeRequestId: person.changeRequest.id,
    });
    await db_1.savePerson(person);
    return person.changeRequest;
};
exports.createBatchTransfer = async (req, res) => {
    const { transactions: transfers } = req.body;
    const { person_id: personId } = req.params;
    validateTransfers(transfers);
    const { id, createdAt } = await exports.saveBatchTransfer(personId, transfers);
    res.status(http_status_1.default.ACCEPTED).send({
        id,
        status: "AUTHORIZATION_REQUIRED",
        updated_at: createdAt,
        url: ":env/v1/change_requests/:id/authorize",
    });
};
const findUnconfirmedBatchTransfer = (person, changeRequestId) => {
    const index = person.unconfirmedBatchTransfers.findIndex((unconfirmedBatchTransfer) => unconfirmedBatchTransfer.changeRequestId === changeRequestId);
    assert_1.default(index !== -1, `Could not find a batch transfer for the given change request id: '${changeRequestId}'`);
    const { transfers } = person.unconfirmedBatchTransfers[index];
    return {
        index,
        transfers,
    };
};
exports.confirmBatchTransfer = async (person, changeRequestId) => {
    const { transfers, index } = findUnconfirmedBatchTransfer(person, changeRequestId);
    person.unconfirmedBatchTransfers.splice(index, 1);
    const acceptedTransfers = transfers.map((transfer) => ({
        ...transfer,
        id: crypto_1.default.randomBytes(16).toString("hex"),
        status: "accepted",
    }));
    for (const transfer of acceptedTransfers) {
        const booking = transactions_1.creteBookingFromSepaCreditTransfer(transfer);
        person.queuedBookings.push(booking);
    }
    await db_1.savePerson(person);
    return {
        id: crypto_1.default.randomBytes(16).toString("hex"),
        status: "ACCEPTED",
        sepa_credit_transfers: acceptedTransfers,
    };
};
//# sourceMappingURL=batchTransfers.js.map