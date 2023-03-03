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
  CardData,
  MockPerson,
  BookingType,
  POSEntryMode,
  Booking,
  CardTransaction,
  CardAuthorizationDeclinedStatus,
  FraudCase,
  DimensionType,
  CardSpendingLimitPeriod,
  CardSpendingLimitControl,
  CardAuthorizationDeclineV2Type,
} from "./types";
import getFraudWatchdog from "./fraudWatchdog";
import { proceedWithSCAChallenge } from "./scaChallenge";

const fraudSuspected = (reason: CardAuthorizationDeclineV2Type) =>
  reason === CardAuthorizationDeclineV2Type.FRAUD_SUSPECTED;

const triggerCardFraudWebhook = async (
  cardAuthorizationDeclined,
  fraudCase,
  person: MockPerson
) => {
  await triggerWebhook({
    type: CardWebhookEvent.CARD_FRAUD_CASE_PENDING,
    personId: person.id,
    payload: {
      id: fraudCase.id,
      resolution: "PENDING",
      respond_until: moment(fraudCase.reservationExpiresAt).toISOString(),
      whitelisted_until: "null",
      card_transaction: cardAuthorizationDeclined,
    },
  });
};

const triggerCardAuthorizationDeclineV2Webhook = async (
  cardAuthorizationDeclined: CardTransaction,
  type: CardAuthorizationDeclineV2Type,
  person: MockPerson
) => {
  await triggerWebhook({
    type: CardWebhookEvent.CARD_AUTHORIZATION_DECLINE_V2,
    personId: person.id,
    payload: {
      id: uuid.v4(),
      reasons: [
        {
          type,
          id: null,
          message: null,
        },
      ],
      card_transaction: cardAuthorizationDeclined,
    },
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
    expires_at: null,
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

  const filterByATM = (reservation) =>
    JSON.parse(reservation.meta_info).cards.transaction_type ===
    TransactionType.CASH_ATM;

  const filterByPurchase = (reservation) =>
    JSON.parse(reservation.meta_info).cards.transaction_type ===
    TransactionType.PURCHASE;

  const sumAmount = (total: number, entry: Booking | Reservation) => {
    return total + entry.amount.value;
  };

  const todayBookings = cardBookings.filter((entry) =>
    isBetween(entry, startOfToday, endOfToday)
  );

  const todayATMTransactions = [...todayReservations, ...todayBookings].filter(
    filterByATM
  );

  const todayPurchaseTransactions = [
    ...todayReservations,
    ...todayBookings,
  ].filter(filterByPurchase);

  const thisMonthReservations = cardReservations.filter((entry) =>
    isBetween(entry, startOfMonth, endOfMonth)
  );

  const thisMonthBookings = cardBookings.filter((entry) =>
    isBetween(entry, startOfMonth, endOfMonth)
  );

  const thisMonthATMTransactions = [
    ...thisMonthReservations,
    ...thisMonthBookings,
  ].filter(filterByATM);

  const thisMonthPurchaseTransactions = [
    ...thisMonthReservations,
    ...thisMonthBookings,
  ].filter(filterByPurchase);

  return {
    ATM: {
      daily: {
        transactions: todayATMTransactions.length,
        amount: todayATMTransactions.reduce(sumAmount, 0),
      },
      monthly: {
        transactions: thisMonthATMTransactions.length,
        amount: thisMonthATMTransactions.reduce(sumAmount, 0),
      },
    },
    PURCHASE: {
      daily: {
        transactions: todayPurchaseTransactions.length,
        amount: todayPurchaseTransactions.reduce(sumAmount, 0),
      },
      monthly: {
        transactions: thisMonthPurchaseTransactions.length,
        amount: thisMonthPurchaseTransactions.reduce(sumAmount, 0),
      },
    },
  };
};

const DEFAULT_CARD_LIMITS = {
  [DimensionType.ATM_WITHDRAWAL]: {
    [CardSpendingLimitPeriod.DAILY]: {
      amount: 100000,
      count: 10,
    },
    [CardSpendingLimitPeriod.MONTHLY]: {
      amount: 300000,
      count: 50,
    },
  },
  [DimensionType.PURCHASE]: {
    [CardSpendingLimitPeriod.DAILY]: {
      amount: 1000000,
      count: 20,
    },
    [CardSpendingLimitPeriod.MONTHLY]: {
      amount: 2000000,
      count: 200,
    },
  },
};

const getCardLimits = (
  cardControls: CardSpendingLimitControl[] = [],
  period: CardSpendingLimitPeriod,
  dimension: DimensionType
) => ({
  amount:
    cardControls.find(
      ({ limit }) =>
        limit.dimension.includes(dimension) &&
        limit.amount &&
        limit.period === period
    ) || DEFAULT_CARD_LIMITS[dimension][period].amount,
  count:
    cardControls.find(
      ({ limit }) =>
        limit.dimension.includes(dimension) &&
        limit.count &&
        limit.period === period
    ) || DEFAULT_CARD_LIMITS[dimension][period].count,
});

export const validateCardLimits = async (
  currentCardUsage,
  cardData: CardData,
  cardAuthorizationDeclined: CardTransaction,
  person: MockPerson
) => {
  const { amount: dailyATMLimitAmount, count: dailyATMLimitCount } =
    getCardLimits(
      cardData.controls,
      CardSpendingLimitPeriod.DAILY,
      DimensionType.ATM_WITHDRAWAL
    );

  const { amount: monthlyATMLimitAmount, count: monthlyATMLimitCount } =
    getCardLimits(
      cardData.controls,
      CardSpendingLimitPeriod.MONTHLY,
      DimensionType.ATM_WITHDRAWAL
    );

  const { amount: dailyPurchaseLimitAmount, count: dailyPurchaseLimitCount } =
    getCardLimits(
      cardData.controls,
      CardSpendingLimitPeriod.DAILY,
      DimensionType.PURCHASE
    );

  const {
    amount: monthlyPurchaseLimitAmount,
    count: monthlyPurchaseLimitCount,
  } = getCardLimits(
    cardData.controls,
    CardSpendingLimitPeriod.MONTHLY,
    DimensionType.PURCHASE
  );

  if (
    currentCardUsage.ATM.daily.amount > dailyATMLimitAmount ||
    currentCardUsage.ATM.daily.count > dailyATMLimitCount ||
    currentCardUsage.ATM.monthly.amount > monthlyATMLimitAmount ||
    currentCardUsage.ATM.monthly.count > monthlyATMLimitCount ||
    currentCardUsage.PURCHASE.daily.amount > dailyPurchaseLimitAmount ||
    currentCardUsage.PURCHASE.daily.count > dailyPurchaseLimitCount ||
    currentCardUsage.PURCHASE.monthly.amount > monthlyPurchaseLimitAmount ||
    currentCardUsage.PURCHASE.monthly.count > monthlyPurchaseLimitCount
  ) {
    await triggerCardAuthorizationDeclineV2Webhook(
      cardAuthorizationDeclined,
      CardAuthorizationDeclineV2Type.SPENDING_LIMIT,
      person
    );
    throw new Error(`Card limit exceeded`);
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
  declineReason?: CardAuthorizationDeclineV2Type;
  posEntryMode?: POSEntryMode;
}) => {
  const person = (await db.getPerson(personId)) as MockPerson;
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
    await triggerCardAuthorizationDeclineV2Webhook(
      cardAuthorizationDeclined,
      CardAuthorizationDeclineV2Type.CARD_BLOCKED,
      person
    );
    throw new Error("Your card is blocked");
  }

  if (cardData.card.status === CardStatus.INACTIVE) {
    await triggerCardAuthorizationDeclineV2Webhook(
      cardAuthorizationDeclined,
      CardAuthorizationDeclineV2Type.CARD_INACTIVE,
      person
    );
    throw new Error("Your card is in inactive status");
  }

  if (cardData.card.status !== CardStatus.ACTIVE) {
    throw new Error("Your card is not in active status");
  }

  if (person.account.available_balance.value < parseInt(amount, 10)) {
    await triggerCardAuthorizationDeclineV2Webhook(
      cardAuthorizationDeclined,
      CardAuthorizationDeclineV2Type.INSUFFICIENT_FUNDS,
      person
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
      return triggerCardFraudWebhook(
        cardAuthorizationDeclined,
        fraudCase,
        person
      );
    } else {
      return triggerCardAuthorizationDeclineV2Webhook(
        cardAuthorizationDeclined,
        declineReason,
        person
      );
    }
  }

  if (posEntryMode === POSEntryMode.CARD_NOT_PRESENT) {
    return proceedWithSCAChallenge(person, reservation);
  }

  person.account.reservations.push(reservation);

  const currentCardUsages = computeCardUsage(person);
  await validateCardLimits(
    currentCardUsages,
    cardData,
    cardAuthorizationDeclined,
    person
  );

  await db.savePerson(person);

  await triggerWebhook({
    type: CardWebhookEvent.CARD_AUTHORIZATION,
    payload: reservation,
    personId: person.id,
  });

  return reservation;
};

const resolveReservation = async (reservation, person: MockPerson) => {
  const resolvedReservation = {
    ...reservation,
    status: ReservationStatus.RESOLVED,
    resolved_at: moment().toDate(),
  };

  await triggerWebhook({
    type: CardWebhookEvent.CARD_AUTHORIZATION_RESOLUTION,
    payload: resolvedReservation,
    personId: person.id,
  });
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

  await resolveReservation(reservation, person);

  await triggerBookingsWebhook(person);
};

const expireReservation = async (person: MockPerson, reservation) => {
  person.account.reservations = person.account.reservations.filter(
    (item) => item.id !== reservation.id
  );

  reservation.status = ReservationStatus.EXPIRED;

  await db.savePerson(person);

  await triggerWebhook({
    type: CardWebhookEvent.CARD_AUTHORIZATION_RESOLUTION,
    payload: reservation,
    personId: person.id,
  });
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
      return resolveReservation(reservation, person);
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
