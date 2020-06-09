/* eslint-disable @typescript-eslint/camelcase */

import uuid from "node-uuid";
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
  CardTransaction,
  CardAuthorizationDeclinedStatus,
  FraudCase,
} from "./types";
import getFraudWatchdog from "./fraudWatchdog";

const fraudSuspected = (reason: CardAuthorizationDeclineReason) =>
  reason === CardAuthorizationDeclineReason.FRAUD_SUSPECTED;

const triggerCardFraudWebhook = async (
  cardAuthorizationDeclined,
  fraudCase
) => {
  await triggerWebhook(CardWebhookEvent.CARD_FRAUD_CASE_PENDING, {
    resolution: "PENDING",
    respond_until: moment(fraudCase.reservationExpiresAt).toISOString(),
    whitelisted_until: "null",
    card_transaction: cardAuthorizationDeclined,
  });
};

const triggerCardDeclinedWebhook = async (
  cardAuthorizationDeclined: CardTransaction,
  reason: CardAuthorizationDeclineReason
) => {
  await triggerWebhook(CardWebhookEvent.CARD_AUTHORIZATION_DECLINE, {
    id: uuid.v4(),
    reason,
    card_transaction: cardAuthorizationDeclined,
  });
};

export const markReservationAsFraud = async (
  reservation: Reservation,
  cardId: string,
  person: MockPerson
): Promise<FraudCase> => {
  const id = uuid.v4();
  const fraudCase = {
    id,
    reservationId: reservation.id,
    reservationExpiresAt: new Date().getTime() + 1800000,
    cardId,
  };
  person.account.fraudReservations.push(reservation);
  person.fraudCases.push(fraudCase);
  await db.savePerson(person);
  // Wait for response from customer.
  // If response does not arrive
  // within 30 minutes, block the card.
  getFraudWatchdog().watch(fraudCase);
  return fraudCase;
};

export const generateMetaInfo = ({
  originalAmount,
  originalCurrency,
  recipient,
  cardId,
  date,
  type,
  incoming,
  posEntryMode,
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
        town: "Berlin",
      },
      original_amount: {
        currency: originalCurrency,
        value: originalAmount,
        fx_rate: FxRate[originalCurrency],
      },
      pos_entry_mode: posEntryMode,
      trace_id: incoming ? null : uuid.v4(),
      transaction_date: moment(date).format("YYYY-MM-DD"),
      transaction_time: incoming ? null : moment(date).toDate(),
      transaction_type: type,
    },
  });
};

const mapDataToReservation = ({
  amount,
  originalAmount,
  originalCurrency,
  type,
  recipient,
  cardId,
  posEntryMode,
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
      currency: "EUR",
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
      posEntryMode,
    }),
    expires_at: moment(date).add(1, "month").format("YYYY-MM-DD"),
    expired_at: null,
    resolved_at: null,
    description: recipient,
  };
};

const mapDataToCardAuthorizationDeclined = ({
  amount,
  originalAmount,
  originalCurrency,
  type,
  recipient,
  cardId,
  posEntryMode,
}: {
  amount: number;
  originalAmount: number;
  originalCurrency: string;
  type: TransactionType;
  recipient: string;
  cardId: string;
  posEntryMode: POSEntryMode;
}): CardTransaction => {
  return {
    card_id: cardId,
    type,
    status: CardAuthorizationDeclinedStatus.DECLINED,
    attempted_at: moment().toDate(),
    pos_entry_mode: posEntryMode,
    merchant: {
      country_code: "DE",
      category_code: "5999",
      name: recipient,
    },
    amount: {
      currency: "EUR",
      value: amount,
      unit: "cents",
    },
    original_amount: {
      currency: originalCurrency,
      value: originalAmount,
      unit: "cents",
    },
  };
};

const computeCardUsage = (person: MockPerson) => {
  const startOfToday = moment().startOf("day").toDate();
  const endOfToday = moment().endOf("day").toDate();
  const startOfMonth = moment().startOf("month").toDate();
  const endOfMonth = moment().endOf("month").toDate();

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

  const todayReservations = cardReservations.filter((entry) =>
    isBetween(entry, startOfToday, endOfToday)
  );

  const filterByCardNotPresent = (reservation) =>
    JSON.parse(reservation.meta_info).cards.pos_entry_mode ===
    POSEntryMode.CARD_NOT_PRESENT;

  const filterByCardPresent = (reservation) =>
    JSON.parse(reservation.meta_info).cards.pos_entry_mode !==
    POSEntryMode.CARD_NOT_PRESENT;

  const sumAmount = (total: number, entry: Booking | Reservation) => {
    return total + entry.amount.value;
  };

  const todayBookings = cardBookings.filter((entry) =>
    isBetween(entry, startOfToday, endOfToday)
  );

  const todayCardNotPresent = [...todayReservations, ...todayBookings].filter(
    filterByCardNotPresent
  );

  const todayCardPresent = [...todayReservations, ...todayBookings].filter(
    filterByCardPresent
  );

  const thisMonthReservations = cardReservations.filter((entry) =>
    isBetween(entry, startOfMonth, endOfMonth)
  );

  const thisMonthBookings = cardBookings.filter((entry) =>
    isBetween(entry, startOfMonth, endOfMonth)
  );

  const thisMonthCardNotPresent = [
    ...thisMonthReservations,
    ...thisMonthBookings,
  ].filter(filterByCardNotPresent);

  const thisMonthCardPresent = [
    ...thisMonthReservations,
    ...thisMonthBookings,
  ].filter(filterByCardPresent);

  return {
    cardPresent: {
      daily: {
        transactions: todayCardPresent.length,
        amount: todayCardPresent.reduce(sumAmount, 0),
      },
      monthly: {
        transactions: thisMonthCardPresent.length,
        amount: thisMonthCardPresent.reduce(sumAmount, 0),
      },
    },
    cardNotPresent: {
      daily: {
        transactions: todayCardNotPresent.length,
        amount: todayCardNotPresent.reduce(sumAmount, 0),
      },
      monthly: {
        transactions: thisMonthCardNotPresent.length,
        amount: thisMonthCardNotPresent.reduce(sumAmount, 0),
      },
    },
  };
};

export const validateCardLimits = async (
  currentCardUsage,
  cardDetails: CardDetails,
  cardAuthorizationDeclined: CardTransaction
) => {
  const isCardNotPresentAuthorization =
    cardAuthorizationDeclined.pos_entry_mode === POSEntryMode.CARD_NOT_PRESENT;

  if (isCardNotPresentAuthorization) {
    const dailyLimitAfterAuthorization =
      currentCardUsage.cardNotPresent.daily.amount;
    const monthlyLimitAfterAuthorization =
      currentCardUsage.cardNotPresent.monthly.amount;

    if (
      dailyLimitAfterAuthorization >
      cardDetails.cardNotPresentLimits.daily.max_amount_cents
    ) {
      await triggerCardDeclinedWebhook(
        cardAuthorizationDeclined,
        CardAuthorizationDeclineReason.CARD_NOT_PRESENT_AMOUNT_LIMIT_REACHED_DAILY
      );
      throw new Error(
        `Daily card_not_present amount limit exceeded (${dailyLimitAfterAuthorization} > ${cardDetails.cardNotPresentLimits.daily.max_amount_cents})`
      );
    }

    if (
      currentCardUsage.cardNotPresent.daily.transactions >
      cardDetails.cardNotPresentLimits.daily.max_transactions
    ) {
      await triggerCardDeclinedWebhook(
        cardAuthorizationDeclined,
        CardAuthorizationDeclineReason.CARD_NOT_PRESENT_USE_LIMIT_REACHED_DAILY
      );
      throw new Error(
        "Daily card_not_present transaction number limit exceeded"
      );
    }

    if (
      monthlyLimitAfterAuthorization >
      cardDetails.cardNotPresentLimits.monthly.max_amount_cents
    ) {
      await triggerCardDeclinedWebhook(
        cardAuthorizationDeclined,
        CardAuthorizationDeclineReason.CARD_NOT_PRESENT_AMOUNT_LIMIT_REACHED_MONTHLY
      );
      throw new Error(
        `Monthly card_not_present amount limit exceeded (${monthlyLimitAfterAuthorization} > ${cardDetails.cardNotPresentLimits.monthly.max_amount_cents})`
      );
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
  } else {
    const dailyLimitAfterAuthorization =
      currentCardUsage.cardPresent.daily.amount;
    const monthlyLimitAfterAuthorization =
      currentCardUsage.cardPresent.monthly.amount;

    if (
      dailyLimitAfterAuthorization >
      cardDetails.cardPresentLimits.daily.max_amount_cents
    ) {
      await triggerCardDeclinedWebhook(
        cardAuthorizationDeclined,
        CardAuthorizationDeclineReason.CARD_PRESENT_AMOUNT_LIMIT_REACHED_DAILY
      );
      throw new Error(
        `Daily card_present amount limit exceeded (${dailyLimitAfterAuthorization} > ${cardDetails.cardPresentLimits.daily.max_amount_cents})`
      );
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
      monthlyLimitAfterAuthorization >
      cardDetails.cardPresentLimits.monthly.max_amount_cents
    ) {
      await triggerCardDeclinedWebhook(
        cardAuthorizationDeclined,
        CardAuthorizationDeclineReason.CARD_PRESENT_AMOUNT_LIMIT_REACHED_MONTHLY
      );
      throw new Error(
        `Monthly card_present amount limit exceeded (${monthlyLimitAfterAuthorization} > ${cardDetails.cardPresentLimits.monthly.max_amount_cents})`
      );
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
  posEntryMode = POSEntryMode.CONTACTLESS,
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
    posEntryMode,
  };

  const reservation = mapDataToReservation(cardAuthorizationPayload);
  const cardAuthorizationDeclined = mapDataToCardAuthorizationDeclined(
    cardAuthorizationPayload
  );

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

  if (
    [POSEntryMode.CONTACTLESS, POSEntryMode.PHONE].includes(posEntryMode) &&
    !cardData.cardDetails.settings.contactless_enabled
  ) {
    throw new Error(`Card has contactless transactions disabled`);
  }

  if (person.account.available_balance.value < amount) {
    await triggerCardDeclinedWebhook(
      cardAuthorizationDeclined,
      CardAuthorizationDeclineReason.INSUFFICIENT_FUNDS
    );
    throw new Error("There were insufficient funds to complete this action.");
  }

  if (declineReason) {
    if (fraudSuspected(declineReason)) {
      const fraudCase = await markReservationAsFraud(
        reservation,
        cardId,
        person
      );
      await triggerCardFraudWebhook(cardAuthorizationDeclined, fraudCase);
    } else {
      await triggerCardDeclinedWebhook(
        cardAuthorizationDeclined,
        declineReason
      );
    }
    return;
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

const resolveReservation = async (reservation) => {
  const resolvedReservation = {
    ...reservation,
    status: ReservationStatus.RESOLVED,
    resolved_at: moment().toDate(),
  };

  await triggerWebhook(
    CardWebhookEvent.CARD_AUTHORIZATION_RESOLUTION,
    resolvedReservation
  );
};

const bookReservation = async (person, reservation, increaseAmount) => {
  let additionalAmount = 0;

  if (increaseAmount) {
    const availableBalance = person.account.available_balance.value;
    additionalAmount =
      1 +
      Math.floor(
        Math.random() * ((availableBalance - reservation.amount.value) / 20)
      );
  }

  const booking = creteBookingFromReservation(person, {
    ...reservation,
    amount: {
      ...reservation.amount,
      value: reservation.amount.value + additionalAmount,
    },
  });

  person.transactions.push(booking);

  person.account.reservations = person.account.reservations.filter(
    (item) => item.id !== reservation.id
  );

  await db.savePerson(person);

  await resolveReservation(reservation);

  await triggerBookingsWebhook(person.account.id);
};

const expireReservation = async (person, reservation) => {
  person.account.reservations = person.account.reservations.filter(
    (item) => item.id !== reservation.id
  );

  reservation.status = ReservationStatus.EXPIRED;

  await db.savePerson(person);

  await triggerWebhook(
    CardWebhookEvent.CARD_AUTHORIZATION_RESOLUTION,
    reservation
  );
};

export const updateReservation = async ({
  personId,
  reservationId,
  action,
  increaseAmount,
}: {
  personId: string;
  reservationId: string;
  action: ActionType;
  increaseAmount?: boolean;
}) => {
  const person = await db.getPerson(personId);

  const reservation = person.account.reservations.find(
    (r) => r.id === reservationId
  );

  if (!reservation) {
    throw new Error("Reservation not found");
  }

  switch (action) {
    case ActionType.RESOLVE: {
      return resolveReservation(reservation);
    }
    case ActionType.BOOK: {
      return bookReservation(person, reservation, increaseAmount);
    }
    case ActionType.EXPIRE: {
      return expireReservation(person, reservation);
    }
    default:
      throw new Error("Unknown action type");
  }
};
