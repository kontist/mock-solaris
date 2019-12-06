/* eslint-disable @typescript-eslint/camelcase */
import {
  Reservation,
  CardAuthorizationDeclinedStatus,
  CardTransaction
} from "./types";

export const mapReservationToCardAuthorization = (
  reservation: Reservation
): CardTransaction => {
  const meta = JSON.parse(reservation.meta_info).cards;

  return {
    card_id: meta.card_id,
    type: meta.transaction_type,
    status: CardAuthorizationDeclinedStatus.DECLINED,
    attempted_at: meta.transaction_time,
    pos_entry_mode: meta.pos_entry_mode,
    merchant: meta.merchant,
    amount: reservation.amount,
    original_amount: meta.original_amount
  };
};

/* eslint-enable @typescript-eslint/camelcase */
