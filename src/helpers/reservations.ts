/* eslint-disable @typescript-eslint/camelcase */

import uuid from "uuid";
import * as db from "../db";
import moment from "moment";

import { creteBookingFromReservation } from "../routes/transactions";
import { triggerWebhook } from "./webhooks";
import { triggerBookingsWebhook } from "../routes/backoffice";

import {
  ReservationType,
  ReservationStatus,
  TransactionType,
  CardStatus,
  ActionType,
  FxRate,
  Reservation,
  CardWebhookEvent,
  CardAuthorizationDeclineReason,
  CardDetails,
  MockPerson,
  BookingType,
  POSEntryMode,
  Booking,
  CardAuthorizationDeclined,
  CardAuthorizationDeclinedStatus
} from "./types";

const triggerCardDeclinedWebhook = async (
  cardAuthorizationDeclined: CardAuthorizationDeclined,
  reason: CardAuthorizationDeclineReason
) => {
  await triggerWebhook(CardWebhookEvent.CARD_AUTHORIZATION_DECLINE, {
    reason,
    card_transaction: cardAuthorizationDeclined
  });
};

export const generateMetaInfo = ({
  originalAmount,
  originalCurrency,
  recipient,
  cardId,
  date,
  type,
  incoming,
  posEntryMode
}: {
  originalAmount: number;
  originalCurrency: string;
  recipient: string;
  cardId: string;
  date: Date;
  type: TransactionType;
  incoming?: boolean;
  posEntryMode: POSEntryMode;
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
      pos_entry_mode: posEntryMode,
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
  cardId,
  posEntryMode
}: {
  amount: number;
  originalAmount: number;
  originalCurrency: string;
  type: TransactionType;
  recipient: string;
  cardId: string;
  posEntryMode: POSEntryMode;
}): Reservation => {
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
      type,
      posEntryMode
    }),
    expires_at: moment(date)
      .add(1, "month")
      .format("YYYY-MM-DD"),
    expired_at: null,
    resolved_at: null,
    description: recipient
  };
};

const mapDataToCardAuthorizationDeclined = ({
  amount,
  originalAmount,
  originalCurrency,
  type,
  recipient,
  cardId,
  posEntryMode
}: {
  amount: number;
  originalAmount: number;
  originalCurrency: string;
  type: TransactionType;
  recipient: string;
  cardId: string;
  posEntryMode: POSEntryMode;
}): CardAuthorizationDeclined => {
  return {
    card_id: cardId,
    type,
    status: CardAuthorizationDeclinedStatus.DECLINED,
    attempted_at: moment().toDate(),
    pos_entry_mode: posEntryMode,
    merchant: {
      country_code: "DE",
      category_code: "5999",
      name: recipient
    },
    amount: {
      currency: "EUR",
      value: amount,
      unit: "cents"
    },
    original_amount: {
      currency: originalCurrency,
      value: originalAmount,
      unit: "cents"
    }
  };
};

const computeCardUsage = (person: MockPerson) => {
  const startOfToday = moment()
    .startOf("day")
    .toDate();
  const endOfToday = moment()
    .endOf("day")
    .toDate();
  const startOfMonth = moment()
    .startOf("month")
    .toDate();
  const endOfMonth = moment()
    .endOf("month")
    .toDate();

  const cardReservations = person.account.reservations.filter(
    ({ reservation_type: reservationType }) =>
      reservationType === ReservationType.CARD_AUTHORIZATION
  );
  const cardBookings = person.transactions.filter(
    ({ booking_type: bookingType }) =>
      bookingType === BookingType.CARD_TRANSACTION
  );

  const isBetween = (
    entry: Booking | Reservation,
    startDate: Date,
    endDate: Date
  ) => {
    return moment(JSON.parse(entry.meta_info).cards.transaction_date).isBetween(
      startDate,
      endDate,
      undefined,
      "[]"
    );
  };

  const todayReservations = cardReservations.filter(entry =>
    isBetween(entry, startOfToday, endOfToday)
  );

  const filterByCardNotPresent = reservation =>
    JSON.parse(reservation.meta_info).cards.pos_entry_mode ===
    POSEntryMode.CARD_NOT_PRESENT;

  const filterByCardPresent = reservation =>
    JSON.parse(reservation.meta_info).cards.pos_entry_mode !==
    POSEntryMode.CARD_NOT_PRESENT;

  const sumAmount = (total: number, entry: Booking | Reservation) => {
    return total + entry.amount.value;
  };

  const todayBookings = cardBookings.filter(entry =>
    isBetween(entry, startOfToday, endOfToday)
  );

  const todayCardNotPresent = [...todayReservations, ...todayBookings].filter(
    filterByCardNotPresent
  );

  const todayCardPresent = [...todayReservations, ...todayBookings].filter(
    filterByCardPresent
  );

  const thisMonthReservations = cardReservations.filter(entry =>
    isBetween(entry, startOfMonth, endOfMonth)
  );

  const thisMonthBookings = cardBookings.filter(entry =>
    isBetween(entry, startOfMonth, endOfMonth)
  );

  const thisMonthCardNotPresent = [
    ...thisMonthReservations,
    ...thisMonthBookings
  ].filter(filterByCardNotPresent);

  const thisMonthCardPresent = [
    ...thisMonthReservations,
    ...thisMonthBookings
  ].filter(filterByCardPresent);

  return {
    cardPresent: {
      daily: {
        transactions: todayCardPresent.length,
        amount: todayCardPresent.reduce(sumAmount, 0)
      },
      monthly: {
        transactions: thisMonthCardPresent.length,
        amount: thisMonthCardPresent.reduce(sumAmount, 0)
      }
    },
    cardNotPresent: {
      daily: {
        transactions: todayCardNotPresent.length,
        amount: todayCardNotPresent.reduce(sumAmount, 0)
      },
      monthly: {
        transactions: thisMonthCardNotPresent.length,
        amount: thisMonthCardNotPresent.reduce(sumAmount, 0)
      }
    }
  };
};

export const validateCardLimits = async (
  currentCardUsage,
  cardDetails: CardDetails,
  cardAuthorizationDeclined: CardAuthorizationDeclined
) => {
  if (
    currentCardUsage.cardPresent.daily.amount >
    cardDetails.cardPresentLimits.daily.max_amount_cents
  ) {
    await triggerCardDeclinedWebhook(
      cardAuthorizationDeclined,
      CardAuthorizationDeclineReason.CARD_PRESENT_AMOUNT_LIMIT_REACHED_DAILY
    );
    throw new Error("Daily card_present amount limit exceeded");
  }

  if (
    currentCardUsage.cardPresent.daily.transactions >
    cardDetails.cardPresentLimits.daily.max_transactions
  ) {
    await triggerCardDeclinedWebhook(
      cardAuthorizationDeclined,
      CardAuthorizationDeclineReason.CARD_PRESENT_USE_LIMIT_REACHED_DAILY
    );
    throw new Error("Daily card_present transaction number limit exceeded");
  }

  if (
    currentCardUsage.cardNotPresent.daily.amount >
    cardDetails.cardNotPresentLimits.daily.max_amount_cents
  ) {
    await triggerCardDeclinedWebhook(
      cardAuthorizationDeclined,
      CardAuthorizationDeclineReason.CARD_NOT_PRESENT_AMOUNT_LIMIT_REACHED_DAILY
    );
    throw new Error("Daily card_not_present amount limit exceeded");
  }

  if (
    currentCardUsage.cardNotPresent.daily.transactions >
    cardDetails.cardNotPresentLimits.daily.max_transactions
  ) {
    await triggerCardDeclinedWebhook(
      cardAuthorizationDeclined,
      CardAuthorizationDeclineReason.CARD_NOT_PRESENT_USE_LIMIT_REACHED_DAILY
    );
    throw new Error("Daily card_not_present transaction number limit exceeded");
  }

  if (
    currentCardUsage.cardPresent.monthly.amount >
    cardDetails.cardPresentLimits.monthly.max_amount_cents
  ) {
    await triggerCardDeclinedWebhook(
      cardAuthorizationDeclined,
      CardAuthorizationDeclineReason.CARD_PRESENT_AMOUNT_LIMIT_REACHED_MONTHLY
    );
    throw new Error("Monthly card_present amount limit exceeded");
  }

  if (
    currentCardUsage.cardPresent.monthly.transactions >
    cardDetails.cardPresentLimits.monthly.max_transactions
  ) {
    await triggerCardDeclinedWebhook(
      cardAuthorizationDeclined,
      CardAuthorizationDeclineReason.CARD_PRESENT_USE_LIMIT_REACHED_MONTHLY
    );
    throw new Error("Monthly card_present transaction number limit exceeded");
  }

  if (
    currentCardUsage.cardNotPresent.monthly.amount >
    cardDetails.cardNotPresentLimits.monthly.max_amount_cents
  ) {
    await triggerCardDeclinedWebhook(
      cardAuthorizationDeclined,
      CardAuthorizationDeclineReason.CARD_NOT_PRESENT_AMOUNT_LIMIT_REACHED_MONTHLY
    );
    throw new Error("Monthly card_not_present amount limit exceeded");
  }

  if (
    currentCardUsage.cardNotPresent.monthly.transactions >
    cardDetails.cardNotPresentLimits.monthly.max_transactions
  ) {
    await triggerCardDeclinedWebhook(
      cardAuthorizationDeclined,
      CardAuthorizationDeclineReason.CARD_NOT_PRESENT_USE_LIMIT_REACHED_MONTHLY
    );
    throw new Error(
      "Monthly card_not_present transaction number limit exceeded"
    );
  }
};

export const createReservation = async ({
  personId,
  cardId,
  amount,
  currency,
  type,
  recipient,
  declineReason,
  posEntryMode = POSEntryMode.CONTACTLESS
}: {
  personId: string;
  cardId: string;
  amount: string;
  currency: string;
  type: TransactionType;
  recipient: string;
  declineReason?: CardAuthorizationDeclineReason;
  posEntryMode?: POSEntryMode;
}) => {
  const person = await db.getPerson(personId);
  const cardData = person.account.cards.find(({ card }) => card.id === cardId);
  const convertedAmount = Math.abs(parseInt(amount, 10));
  const cardAuthorizationPayload = {
    amount: Math.round(convertedAmount * FxRate[currency]),
    originalAmount: convertedAmount,
    originalCurrency: currency,
    type,
    recipient,
    cardId,
    posEntryMode
  };

  const reservation = mapDataToReservation(cardAuthorizationPayload);
  const cardAuthorizationDeclined = mapDataToCardAuthorizationDeclined(
    cardAuthorizationPayload
  );

  if (declineReason) {
    await triggerCardDeclinedWebhook(cardAuthorizationDeclined, declineReason);
    return;
  }

  if (!cardData) {
    throw new Error("Card not found");
  }

  if (
    [CardStatus.BLOCKED, CardStatus.BLOCKED_BY_SOLARIS].includes(
      cardData.card.status
    )
  ) {
    await triggerCardDeclinedWebhook(
      cardAuthorizationDeclined,
      CardAuthorizationDeclineReason.CARD_BLOCKED
    );
    throw new Error("Your card is blocked");
  }

  if (cardData.card.status === CardStatus.INACTIVE) {
    await triggerCardDeclinedWebhook(
      cardAuthorizationDeclined,
      CardAuthorizationDeclineReason.CARD_INACTIVE
    );
    throw new Error("Your card is in inactive status");
  }

  if (cardData.card.status !== CardStatus.ACTIVE) {
    throw new Error("Your card is not in active status");
  }

  if (person.account.available_balance.value < amount) {
    await triggerCardDeclinedWebhook(
      cardAuthorizationDeclined,
      CardAuthorizationDeclineReason.INSUFFICIENT_FUNDS
    );
    throw new Error("There were insufficient funds to complete this action.");
  }

  person.account.reservations.push(reservation);

  const currentCardUsages = computeCardUsage(person);
  await validateCardLimits(
    currentCardUsages,
    cardData.cardDetails,
    cardAuthorizationDeclined
  );

  await db.savePerson(person);

  await triggerWebhook(CardWebhookEvent.CARD_AUTHORIZATION, reservation);
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

  await triggerWebhook(
    CardWebhookEvent.CARD_AUTHORIZATION_RESOLUTION,
    resolvedReservation
  );
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
