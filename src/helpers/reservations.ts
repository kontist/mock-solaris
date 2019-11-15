/* eslint-disable @typescript-eslint/camelcase */

import uuid from "uuid";
import * as db from "../db";
import moment from "moment";
import _ from "lodash";

import { creteBookingFromReservation } from "../routes/transactions";
import { triggerWebhook } from "./webhooks";

import {
  ReservationType,
  ReservationStatus,
  TransactionType,
  CardStatus
} from "./types";

const generateMetaInfo = ({
  amount,
  currency,
  recipient,
  cardId,
  date,
  type
}) => {
  return {
    cards: {
      card_id: cardId,
      merchant: {
        country_code: "DE",
        category_code: "7392",
        name: recipient,
        town: "Berlin"
      },
      original_amount: {
        currency: "EUR",
        value: amount,
        fx_rate: 1.0
      },
      pos_entry_mode: "CONTACTLESS",
      trace_id: uuid.v4(),
      transaction_date: date.format("YYYY-MM-DD"),
      transaction_time: date.toDate(),
      transaction_type: type
    }
  };
};

const mapDataToReservation = ({
  amount,
  currency,
  type,
  recipient,
  cardId
}: {
  amount: number;
  currency: string;
  type: TransactionType;
  recipient: string;
  cardId: string;
}) => {
  const date = moment();

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
    meta_info: JSON.stringify(
      generateMetaInfo({
        amount,
        currency,
        recipient,
        cardId,
        date,
        type
      })
    ),
    expires_at: date.add(1, "month").format("YYYY-MM-DD"),
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

  const reservation = mapDataToReservation({
    amount: Math.abs(parseInt(amount, 10)),
    currency,
    type,
    recipient,
    cardId
  });

  person.account.reservations.push(reservation);

  await db.savePerson(person);

  await triggerWebhook("CARD_AUTHORIZATION", reservation);
};

const resolveReservation = async (person, reservation) => {
  const booking = creteBookingFromReservation(person, reservation);

  person.transactions.push(booking);
  person.account.reservations = person.account.reservations.filter(
    item => item.id !== reservation.id
  );
  person.account.balance.value -= reservation.amount.value;

  await db.savePerson(person);

  const resolvedReservation = {
    ...reservation,
    status: ReservationStatus.RESOLVED,
    resolved_at: moment().toDate()
  };

  await triggerWebhook("CARD_AUTHORIZATION_RESOLUTION", resolvedReservation);
};

export const updateReservation = async ({
  personId,
  reservationId,
  status
}: {
  personId: string;
  reservationId: string;
  status: ReservationStatus;
}) => {
  const person = await db.getPerson(personId);

  const reservation = person.account.reservations.find(
    reservation => reservation.id === reservationId
  );

  if (!reservation) {
    throw new Error("Reservation ton found");
  }

  if (status === ReservationStatus.RESOLVED) {
    await resolveReservation(person, reservation);
  }
};
