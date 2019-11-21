export enum ReservationType {
  CARD_AUTHORIZATION = "CARD_AUTHORIZATION"
}

export enum ReservationStatus {
  OPEN = "OPEN",
  RESOLVED = "RESOLVED"
}

export enum TransactionType {
  PURCHASE = "PURCHASE",
  CASH_ATM = "CASH_ATM",
  CASH_MANUAL = "CASH_MANUAL",
  CREDIT_PRESENTMENT = "CREDIT_PRESENTMENT"
}

export enum CardType {
  VIRTUAL_VISA_BUSINESS_DEBIT = "VIRTUAL_VISA_BUSINESS_DEBIT",
  VISA_BUSINESS_DEBIT = "VISA_BUSINESS_DEBIT",
  MASTERCARD_BUSINESS_DEBIT = "MASTERCARD_BUSINESS_DEBIT",
  VIRTUAL_MASTERCARD_BUSINESS_DEBIT = "VIRTUAL_MASTERCARD_BUSINESS_DEBIT"
}

export enum CardStatus {
  PROCESSING = "PROCESSING",
  INACTIVE = "INACTIVE",
  ACTIVE = "ACTIVE",
  BLOCKED = "BLOCKED",
  BLOCKED_BY_SOLARIS = "BLOCKED_BY_SOLARIS",
  ACTIVATION_BLOCKED_BY_SOLARIS = "ACTIVATION_BLOCKED_BY_SOLARIS",
  CLOSED = "CLOSED",
  CLOSED_BY_SOLARIS = "CLOSED_BY_SOLARIS"
}

export enum ActionType {
  BOOK = "BOOK",
  CANCEL = "CANCEL",
  EXPIRE = "EXPIRE"
}

export enum FxRate {
  EUR = 1.0,
  USD = 0.904697
}

export type Card = {
  id: string;
  type: CardType;
  status: CardStatus;
  expiration_date: string | null;
  person_id: string;
  account_id: string;
  business_id: string | null;
  representation: {
    line_1: string;
    formatted_expiration_date: string;
    masked_pan: string;
  };
};

export type CardDetails = {
  pin: string;
  reference: string;
  cardNumber: string;
  token: string;
  cardPresentLimits: CardLimits;
  cardNotPresentLimits: CardLimits;
};

export type MockAccount = Account & {
  cards: Array<{ card: Card; cardDetails: CardDetails }>;
};

export type MockPerson = { id: string; account?: MockAccount };

export type SolarisAPIErrorData = {
  id: string;
  status: number;
  code: string;
  title: string;
  detail: string;
  source: {
    field: string;
    message: string;
  };
};

export type CreateCardData = {
  pin?: string;
  type: CardType;
  business_id?: string;
  reference: string;
  line_1: string;
};

type CardLimit = {
  max_amount_cents: number;
  max_transactions: number;
};

export type CardLimits = {
  daily: CardLimit;
  monthly: CardLimit;
};

export enum CardLimitType {
  PRESENT = "PRESENT",
  NOT_PRESENT = "NOT_PRESENT"
}
