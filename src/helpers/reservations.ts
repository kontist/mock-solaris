/* eslint-disable @typescript-eslint/camelcase */

import uuid from "uuid";
import * as db from "../db";
import moment from "moment";
import _ from "lodash";

import { creteBookingFromReservation } from "../routes/transactions";
import { triggerWebhook } from "./webhooks";
import { triggerBookingsWebhook } from "../routes/backoffice";

import {
  ReservationType,
  ReservationStatus,
  TransactionType,
  CardStatus,
  ActionType,
  FxRate
} from "./types";

export const generateMetaInfo = ({
  originalAmount,
  originalCurrency,
  recipient,
  cardId,
  date,
  type,
  incoming
}: {
  originalAmount: number;
  originalCurrency: string;
  recipient: string;
  cardId: string;
  date: Date;
  type: TransactionType;
  incoming?: boolean;
}) => {
  return JSON.stringify({
    cards: {
      card_id: cardId,
      merchant: {
        country_code: "DE",
        category_code: "7392",
        name: recipient,
        town: "Berlin"
      },
      original_amount: {
        currency: originalCurrency,
        value: originalAmount,
        fx_rate: FxRate[originalCurrency]
      },
      pos_entry_mode: "CONTACTLESS",
      trace_id: incoming ? null : uuid.v4(),
      transaction_date: moment(date).format("YYYY-MM-DD"),
      transaction_time: incoming ? null : moment(date).toDate(),
      transaction_type: type
    }
  });
};

const mapDataToReservation = ({
  amount,
  originalAmount,
  originalCurrency,
  type,
  recipient,
  cardId
}: {
  amount: number;
  originalAmount: number;
  originalCurrency: string;
  type: TransactionType;
  recipient: string;
  cardId: string;
}) => {
  const date = moment().toDate();

  return {
    id: uuid.v4(),
    amount: {
      value: amount,
      unit: "cents",
      currency: "EUR"
    },
    reservation_type: ReservationType.CARD_AUTHORIZATION,
    reference: uuid.v4(),
    status: ReservationStatus.OPEN,
    meta_info: generateMetaInfo({
      originalAmount,
      originalCurrency,
      recipient,
      cardId,
      date,
      type
    }),
    expires_at: moment(date)
      .add(1, "month")
      .format("YYYY-MM-DD"),
    expired_at: null,
    resolved_at: null,
    description: recipient
  };
};

export const createReservation = async ({
  personId,
  cardId,
  amount,
  currency,
  type,
  recipient
}: {
  personId: string;
  cardId: string;
  amount: string;
  currency: string;
  type: TransactionType;
  recipient: string;
}) => {
  const person = await db.getPerson(personId);
  const cardData = person.account.cards.find(({ card }) => card.id === cardId);

  if (!cardData) {
    throw new Error("Card not found");
  }

  if (cardData.card.status !== CardStatus.ACTIVE) {
    throw new Error("Your card is not in active status");
  }

  if (person.account.available_balance.value < amount) {
    throw new Error("There were insufficient funds to complete this action.");
  }

  const convertedAmount = Math.abs(parseInt(amount, 10));

  const reservation = mapDataToReservation({
    amount: Math.round(convertedAmount * FxRate[currency]),
    originalAmount: convertedAmount,
    originalCurrency: currency,
    type,
    recipient,
    cardId
  });

  person.account.reservations.push(reservation);

  await db.savePerson(person);

  await triggerWebhook("CARD_AUTHORIZATION", reservation);
};

const bookReservation = async (person, reservation) => {
  const booking = creteBookingFromReservation(person, reservation);

  person.transactions.push(booking);
  person.account.reservations = person.account.reservations.filter(
    item => item.id !== reservation.id
  );

  await db.savePerson(person);

  const resolvedReservation = {
    ...reservation,
    status: ReservationStatus.RESOLVED,
    resolved_at: moment().toDate()
  };

  await triggerWebhook("CARD_AUTHORIZATION_RESOLUTION", resolvedReservation);
  await triggerBookingsWebhook(person.account.id);
};

export const updateReservation = async ({
  personId,
  reservationId,
  action
}: {
  personId: string;
  reservationId: string;
  action: ActionType;
}) => {
  const person = await db.getPerson(personId);

  const reservation = person.account.reservations.find(
    reservation => reservation.id === reservationId
  );

  if (!reservation) {
    throw new Error("Reservation ton found");
  }

  if (action === ActionType.BOOK) {
    await bookReservation(person, reservation);
  }
};
