"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggerSepaDirectDebitReturnWebhook = exports.createSepaDirectDebitReturn = void 0;
const node_uuid_1 = __importDefault(require("node-uuid"));
const webhooks_1 = require("../helpers/webhooks");
const types_1 = require("../helpers/types");
exports.createSepaDirectDebitReturn = (person, directDebitReturn) => {
    return {
        id: node_uuid_1.default.v4(),
        creditor_iban: directDebitReturn.recipient_iban,
        creditor_name: directDebitReturn.recipient_name,
        creditor_identifier: `C_${directDebitReturn.recipient_iban}`,
        mandate_reference: node_uuid_1.default.v4(),
        amount: { ...directDebitReturn.amount },
        end_to_end_id: directDebitReturn.end_to_end_id,
        sepa_return_code: "AC06",
        description: directDebitReturn.description,
        recorded_at: new Date().toISOString(),
        customer_id: person.id,
        customer_type: "Person",
        account_id: person.account.id,
    };
};
exports.triggerSepaDirectDebitReturnWebhook = (sepaDirectDebitReturn) => webhooks_1.triggerWebhook(types_1.TransactionWebhookEvent.SEPA_DIRECT_DEBIT_RETURN, sepaDirectDebitReturn);
//# sourceMappingURL=sepaDirectDebitReturn.js.map