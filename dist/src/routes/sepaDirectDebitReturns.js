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
Object.defineProperty(exports, "__esModule", { value: true });
exports.listReturnNotificationsHandler = void 0;
const db_1 = require("../db");
const log = __importStar(require("../logger"));
exports.listReturnNotificationsHandler = async (req, res) => {
    const { filter: { account_id: accountId, recorded_at: { min, max }, }, page: { size, number }, } = req.query;
    const minDate = new Date(min);
    const maxDate = new Date(max);
    const sepaDirectDebitReturns = (await db_1.getSepaDirectDebitReturns())
        .filter((directDebitReturn) => directDebitReturn.account_id === accountId)
        .filter((directDebitReturn) => {
        const ddrDate = new Date(directDebitReturn.recorded_at);
        return ddrDate >= minDate && ddrDate <= maxDate;
    })
        .slice((number - 1) * size, number * size);
    log.info("(mockSolaris/listReturnNotificationsHandler) Listing sepa direct debit return notifications from Solaris", req.query, sepaDirectDebitReturns);
    res.send(sepaDirectDebitReturns);
};
//# sourceMappingURL=sepaDirectDebitReturns.js.map