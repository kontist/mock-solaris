"use strict";
/* eslint-disable @typescript-eslint/camelcase */
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
exports.updateReservation = exports.createReservation = exports.validateCardLimits = exports.generateMetaInfo = exports.markReservationAsFraud = void 0;
const node_uuid_1 = __importDefault(require("node-uuid"));
const db = __importStar(require("../db"));
const moment_1 = __importDefault(require("moment"));
const transactions_1 = require("../routes/transactions");
const webhooks_1 = require("./webhooks");
const backoffice_1 = require("../routes/backoffice");
const types_1 = require("./types");
const fraudWatchdog_1 = __importDefault(require("./fraudWatchdog"));
const fraudSuspected = (reason) => reason === types_1.CardAuthorizationDeclineReason.FRAUD_SUSPECTED;
const triggerCardFraudWebhook = async (cardAuthorizationDeclined, fraudCase) => {
    await webhooks_1.triggerWebhook(types_1.CardWebhookEvent.CARD_FRAUD_CASE_PENDING, {
        resolution: "PENDING",
        respond_until: moment_1.default(fraudCase.reservationExpiresAt).toISOString(),
        whitelisted_until: "null",
        card_transaction: cardAuthorizationDeclined,
    });
};
const triggerCardDeclinedWebhook = async (cardAuthorizationDeclined, reason) => {
    await webhooks_1.triggerWebhook(types_1.CardWebhookEvent.CARD_AUTHORIZATION_DECLINE, {
        id: node_uuid_1.default.v4(),
        reason,
        card_transaction: cardAuthorizationDeclined,
    });
};
exports.markReservationAsFraud = async (reservation, cardId, person) => {
    const id = node_uuid_1.default.v4();
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
    fraudWatchdog_1.default().watch(fraudCase);
    return fraudCase;
};
exports.generateMetaInfo = ({ originalAmount, originalCurrency, recipient, cardId, date, type, incoming, posEntryMode, }) => {
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
                fx_rate: types_1.FxRate[originalCurrency],
            },
            pos_entry_mode: posEntryMode,
            trace_id: incoming ? null : node_uuid_1.default.v4(),
            transaction_date: moment_1.default(date).format("YYYY-MM-DD"),
            transaction_time: incoming ? null : moment_1.default(date).toDate(),
            transaction_type: type,
        },
    });
};
const mapDataToReservation = ({ amount, originalAmount, originalCurrency, type, recipient, cardId, posEntryMode, }) => {
    const date = moment_1.default().toDate();
    return {
        id: node_uuid_1.default.v4(),
        amount: {
            value: amount,
            unit: "cents",
            currency: "EUR",
        },
        reservation_type: types_1.ReservationType.CARD_AUTHORIZATION,
        reference: node_uuid_1.default.v4(),
        status: types_1.ReservationStatus.OPEN,
        meta_info: exports.generateMetaInfo({
            originalAmount,
            originalCurrency,
            recipient,
            cardId,
            date,
            type,
            posEntryMode,
        }),
        expires_at: moment_1.default(date).add(1, "month").format("YYYY-MM-DD"),
        expired_at: null,
        resolved_at: null,
        description: recipient,
    };
};
const mapDataToCardAuthorizationDeclined = ({ amount, originalAmount, originalCurrency, type, recipient, cardId, posEntryMode, }) => {
    return {
        card_id: cardId,
        type,
        status: types_1.CardAuthorizationDeclinedStatus.DECLINED,
        attempted_at: moment_1.default().toDate(),
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
const computeCardUsage = (person) => {
    const startOfToday = moment_1.default().startOf("day").toDate();
    const endOfToday = moment_1.default().endOf("day").toDate();
    const startOfMonth = moment_1.default().startOf("month").toDate();
    const endOfMonth = moment_1.default().endOf("month").toDate();
    const cardReservations = person.account.reservations.filter(({ reservation_type: reservationType }) => reservationType === types_1.ReservationType.CARD_AUTHORIZATION);
    const cardBookings = person.transactions.filter(({ booking_type: bookingType }) => bookingType === types_1.BookingType.CARD_TRANSACTION);
    const isBetween = (entry, startDate, endDate) => {
        return moment_1.default(JSON.parse(entry.meta_info).cards.transaction_date).isBetween(startDate, endDate, undefined, "[]");
    };
    const todayReservations = cardReservations.filter((entry) => isBetween(entry, startOfToday, endOfToday));
    const filterByCardNotPresent = (reservation) => JSON.parse(reservation.meta_info).cards.pos_entry_mode ===
        types_1.POSEntryMode.CARD_NOT_PRESENT;
    const filterByCardPresent = (reservation) => JSON.parse(reservation.meta_info).cards.pos_entry_mode !==
        types_1.POSEntryMode.CARD_NOT_PRESENT;
    const sumAmount = (total, entry) => {
        return total + entry.amount.value;
    };
    const todayBookings = cardBookings.filter((entry) => isBetween(entry, startOfToday, endOfToday));
    const todayCardNotPresent = [...todayReservations, ...todayBookings].filter(filterByCardNotPresent);
    const todayCardPresent = [...todayReservations, ...todayBookings].filter(filterByCardPresent);
    const thisMonthReservations = cardReservations.filter((entry) => isBetween(entry, startOfMonth, endOfMonth));
    const thisMonthBookings = cardBookings.filter((entry) => isBetween(entry, startOfMonth, endOfMonth));
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
exports.validateCardLimits = async (currentCardUsage, cardDetails, cardAuthorizationDeclined) => {
    const isCardNotPresentAuthorization = cardAuthorizationDeclined.pos_entry_mode === types_1.POSEntryMode.CARD_NOT_PRESENT;
    if (isCardNotPresentAuthorization) {
        const dailyLimitAfterAuthorization = currentCardUsage.cardNotPresent.daily.amount;
        const monthlyLimitAfterAuthorization = currentCardUsage.cardNotPresent.monthly.amount;
        if (dailyLimitAfterAuthorization >
            cardDetails.cardNotPresentLimits.daily.max_amount_cents) {
            await triggerCardDeclinedWebhook(cardAuthorizationDeclined, types_1.CardAuthorizationDeclineReason.CARD_NOT_PRESENT_AMOUNT_LIMIT_REACHED_DAILY);
            throw new Error(`Daily card_not_present amount limit exceeded (${dailyLimitAfterAuthorization} > ${cardDetails.cardNotPresentLimits.daily.max_amount_cents})`);
        }
        if (currentCardUsage.cardNotPresent.daily.transactions >
            cardDetails.cardNotPresentLimits.daily.max_transactions) {
            await triggerCardDeclinedWebhook(cardAuthorizationDeclined, types_1.CardAuthorizationDeclineReason.CARD_NOT_PRESENT_USE_LIMIT_REACHED_DAILY);
            throw new Error("Daily card_not_present transaction number limit exceeded");
        }
        if (monthlyLimitAfterAuthorization >
            cardDetails.cardNotPresentLimits.monthly.max_amount_cents) {
            await triggerCardDeclinedWebhook(cardAuthorizationDeclined, types_1.CardAuthorizationDeclineReason.CARD_NOT_PRESENT_AMOUNT_LIMIT_REACHED_MONTHLY);
            throw new Error(`Monthly card_not_present amount limit exceeded (${monthlyLimitAfterAuthorization} > ${cardDetails.cardNotPresentLimits.monthly.max_amount_cents})`);
        }
        if (currentCardUsage.cardNotPresent.monthly.transactions >
            cardDetails.cardNotPresentLimits.monthly.max_transactions) {
            await triggerCardDeclinedWebhook(cardAuthorizationDeclined, types_1.CardAuthorizationDeclineReason.CARD_NOT_PRESENT_USE_LIMIT_REACHED_MONTHLY);
            throw new Error("Monthly card_not_present transaction number limit exceeded");
        }
    }
    else {
        const dailyLimitAfterAuthorization = currentCardUsage.cardPresent.daily.amount;
        const monthlyLimitAfterAuthorization = currentCardUsage.cardPresent.monthly.amount;
        if (dailyLimitAfterAuthorization >
            cardDetails.cardPresentLimits.daily.max_amount_cents) {
            await triggerCardDeclinedWebhook(cardAuthorizationDeclined, types_1.CardAuthorizationDeclineReason.CARD_PRESENT_AMOUNT_LIMIT_REACHED_DAILY);
            throw new Error(`Daily card_present amount limit exceeded (${dailyLimitAfterAuthorization} > ${cardDetails.cardPresentLimits.daily.max_amount_cents})`);
        }
        if (currentCardUsage.cardPresent.daily.transactions >
            cardDetails.cardPresentLimits.daily.max_transactions) {
            await triggerCardDeclinedWebhook(cardAuthorizationDeclined, types_1.CardAuthorizationDeclineReason.CARD_PRESENT_USE_LIMIT_REACHED_DAILY);
            throw new Error("Daily card_present transaction number limit exceeded");
        }
        if (monthlyLimitAfterAuthorization >
            cardDetails.cardPresentLimits.monthly.max_amount_cents) {
            await triggerCardDeclinedWebhook(cardAuthorizationDeclined, types_1.CardAuthorizationDeclineReason.CARD_PRESENT_AMOUNT_LIMIT_REACHED_MONTHLY);
            throw new Error(`Monthly card_present amount limit exceeded (${monthlyLimitAfterAuthorization} > ${cardDetails.cardPresentLimits.monthly.max_amount_cents})`);
        }
        if (currentCardUsage.cardPresent.monthly.transactions >
            cardDetails.cardPresentLimits.monthly.max_transactions) {
            await triggerCardDeclinedWebhook(cardAuthorizationDeclined, types_1.CardAuthorizationDeclineReason.CARD_PRESENT_USE_LIMIT_REACHED_MONTHLY);
            throw new Error("Monthly card_present transaction number limit exceeded");
        }
    }
};
exports.createReservation = async ({ personId, cardId, amount, currency, type, recipient, declineReason, posEntryMode = types_1.POSEntryMode.CONTACTLESS, }) => {
    const person = await db.getPerson(personId);
    const cardData = person.account.cards.find(({ card }) => card.id === cardId);
    const convertedAmount = Math.abs(parseInt(amount, 10));
    const cardAuthorizationPayload = {
        amount: Math.round(convertedAmount * types_1.FxRate[currency]),
        originalAmount: convertedAmount,
        originalCurrency: currency,
        type,
        recipient,
        cardId,
        posEntryMode,
    };
    const reservation = mapDataToReservation(cardAuthorizationPayload);
    const cardAuthorizationDeclined = mapDataToCardAuthorizationDeclined(cardAuthorizationPayload);
    if (!cardData) {
        throw new Error("Card not found");
    }
    if ([types_1.CardStatus.BLOCKED, types_1.CardStatus.BLOCKED_BY_SOLARIS].includes(cardData.card.status)) {
        await triggerCardDeclinedWebhook(cardAuthorizationDeclined, types_1.CardAuthorizationDeclineReason.CARD_BLOCKED);
        throw new Error("Your card is blocked");
    }
    if (cardData.card.status === types_1.CardStatus.INACTIVE) {
        await triggerCardDeclinedWebhook(cardAuthorizationDeclined, types_1.CardAuthorizationDeclineReason.CARD_INACTIVE);
        throw new Error("Your card is in inactive status");
    }
    if (cardData.card.status !== types_1.CardStatus.ACTIVE) {
        throw new Error("Your card is not in active status");
    }
    if ([types_1.POSEntryMode.CONTACTLESS, types_1.POSEntryMode.PHONE].includes(posEntryMode) &&
        !cardData.cardDetails.settings.contactless_enabled) {
        throw new Error(`Card has contactless transactions disabled`);
    }
    if (person.account.available_balance.value < amount) {
        await triggerCardDeclinedWebhook(cardAuthorizationDeclined, types_1.CardAuthorizationDeclineReason.INSUFFICIENT_FUNDS);
        throw new Error("There were insufficient funds to complete this action.");
    }
    if (declineReason) {
        if (fraudSuspected(declineReason)) {
            const fraudCase = await exports.markReservationAsFraud(reservation, cardId, person);
            await triggerCardFraudWebhook(cardAuthorizationDeclined, fraudCase);
        }
        else {
            await triggerCardDeclinedWebhook(cardAuthorizationDeclined, declineReason);
        }
        return;
    }
    person.account.reservations.push(reservation);
    const currentCardUsages = computeCardUsage(person);
    await exports.validateCardLimits(currentCardUsages, cardData.cardDetails, cardAuthorizationDeclined);
    await db.savePerson(person);
    await webhooks_1.triggerWebhook(types_1.CardWebhookEvent.CARD_AUTHORIZATION, reservation);
};
const resolveReservation = async (reservation) => {
    const resolvedReservation = {
        ...reservation,
        status: types_1.ReservationStatus.RESOLVED,
        resolved_at: moment_1.default().toDate(),
    };
    await webhooks_1.triggerWebhook(types_1.CardWebhookEvent.CARD_AUTHORIZATION_RESOLUTION, resolvedReservation);
};
const bookReservation = async (person, reservation, increaseAmount) => {
    let additionalAmount = 0;
    if (increaseAmount) {
        const availableBalance = person.account.available_balance.value;
        additionalAmount =
            1 +
                Math.floor(Math.random() * ((availableBalance - reservation.amount.value) / 20));
    }
    const booking = transactions_1.creteBookingFromReservation(person, {
        ...reservation,
        amount: {
            ...reservation.amount,
            value: reservation.amount.value + additionalAmount,
        },
    });
    person.transactions.push(booking);
    person.account.reservations = person.account.reservations.filter((item) => item.id !== reservation.id);
    await db.savePerson(person);
    await resolveReservation(reservation);
    await backoffice_1.triggerBookingsWebhook(person.account.id);
};
const expireReservation = async (person, reservation) => {
    person.account.reservations = person.account.reservations.filter((item) => item.id !== reservation.id);
    reservation.status = types_1.ReservationStatus.EXPIRED;
    await db.savePerson(person);
    await webhooks_1.triggerWebhook(types_1.CardWebhookEvent.CARD_AUTHORIZATION_RESOLUTION, reservation);
};
exports.updateReservation = async ({ personId, reservationId, action, increaseAmount, }) => {
    const person = await db.getPerson(personId);
    const reservation = person.account.reservations.find((r) => r.id === reservationId);
    if (!reservation) {
        throw new Error("Reservation not found");
    }
    switch (action) {
        case types_1.ActionType.RESOLVE: {
            return resolveReservation(reservation);
        }
        case types_1.ActionType.BOOK: {
            return bookReservation(person, reservation, increaseAmount);
        }
        case types_1.ActionType.EXPIRE: {
            return expireReservation(person, reservation);
        }
        default:
            throw new Error("Unknown action type");
    }
};
//# sourceMappingURL=reservations.js.map