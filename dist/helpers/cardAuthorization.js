"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapReservationToCardAuthorization = void 0;
/* eslint-disable @typescript-eslint/camelcase */
const types_1 = require("./types");
exports.mapReservationToCardAuthorization = (reservation) => {
    const meta = JSON.parse(reservation.meta_info).cards;
    return {
        card_id: meta.card_id,
        type: meta.transaction_type,
        status: types_1.CardAuthorizationDeclinedStatus.DECLINED,
        attempted_at: meta.transaction_time,
        pos_entry_mode: meta.pos_entry_mode,
        merchant: meta.merchant,
        amount: reservation.amount,
        original_amount: meta.original_amount,
    };
};
/* eslint-enable @typescript-eslint/camelcase */
//# sourceMappingURL=cardAuthorization.js.map