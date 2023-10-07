import {
  Amount,
  CardData,
  CardSpendingLimitControl,
  CardSpendingLimitPeriod,
  CardSpendingLimitType,
  CardStatus,
  CardType,
  DimensionType,
  FraudCase,
  MockAccount,
  MockCreatePerson,
  Origin,
  PostboxItem,
  Reservation,
  ReservationStatus,
  ReservationType,
  Scope,
} from "../src/helpers/types";

/**
 * Values satisfy the requirements of types created on this project and not the actual Solaris requirements.
 * Values are to be updated as we add more tests.
 */

export const mockReservation: Reservation = {
  id: "reservation1",
  amount: { currency: "EUR", unit: "cents", value: 10000 },
  reservation_type: ReservationType.CARD_AUTHORIZATION,
  status: ReservationStatus.OPEN,
  reference: "",
  description: "",
  expired_at: "",
  expires_at: "",
  meta_info: "",
  resolved_at: "",
};

export const mockAmount: Amount = {
  unit: "cents",
  currency: "EUR",
  value: Math.pow(10, 7), // 100.000 EUR
};

export const mockAccount: MockAccount = {
  id: "account1",
  reservations: [],
  fraudReservations: [],
  pendingReservation: mockReservation,
  balance: mockAmount,
  available_balance: mockAmount,
  account_limit: mockAmount,
  iban: "DE12345678901234567890",
  locking_status: "",
  cards: [],
};

export const mockCreatePerson: MockCreatePerson = {
  email: `person@kontist.com`,
};

export const mockCardSpendingLimitControl: CardSpendingLimitControl = {
  id: "cardSpendingLimitControl1",
  idempotency_key: "",
  limit: {
    amount: 11,
    count: 1,
    dimension: [DimensionType.PURCHASE],
    period: CardSpendingLimitPeriod.DAILY,
    type: CardSpendingLimitType.TRANSACTION_TYPE,
  },
  origin: Origin.SOLARISBANK,
  scope: Scope.CARD,
  scope_id: "scope1",
};

export const mockCard: CardData = {
  cardDetails: { cardNumber: "", cvv: "", pin: "", reference: "" },
  card: {
    id: "cardId1",
    account_id: "1",
    business_id: "1",
    expiration_date: "",
    new_card_ordered: false,
    person_id: "1",
    status: CardStatus.ACTIVE,
    type: CardType.VISA_BUSINESS_DEBIT,
    representation: {
      formatted_expiration_date: "",
      line_1: "",
      masked_pan: "",
    },
  },
  controls: [],
};

export const mockFraudCase: FraudCase = {
  cardId: "cardId1",
  reservationExpiresAt: 1000,
  id: "fraudCase1",
  reservationId: "reservation1",
};

export const mockPostboxItem: PostboxItem = { id: "postboxItem1" };
