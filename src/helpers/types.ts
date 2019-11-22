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

export enum CardWebhookEvent {
  "CARD_AUTHORIZATION" = "CARD_AUTHORIZATION", //	An authorization was created on the account using the card
  "CARD_BLOCK" = "CARD_BLOCK", //	Card has been blocked by solarisBank
  "CARD_FRAUD_CASE_PENDING" = "CARD_FRAUD_CASE_PENDING", //	A fraud case was recorded, that needs customers immediate respond
  "CARD_FRAUD_CASE_TIMEOUT" = "CARD_FRAUD_CASE_TIMEOUT", //	The recorded fraud case didn't received response from the customer
  "CARD_AUTHORIZATION_DECLINE" = "CARD_AUTHORIZATION_DECLINE", //	The transaction was declined. Find the complete list of reasons here
  "CARD_AUTHORIZATION_RESOLUTION" = "CARD_AUTHORIZATION_RESOLUTION", //	The reservation was cancelled, expired or booked. No push notification for the customer is required for this webhook.
  "CARD_LIFECYCLE_EVENT" = "CARD_LIFECYCLE_EVENT" //
}

export enum CardAuthorizationDeclineReason {
  "AUTHENTICATION_REQUIRED" = "AUTHENTICATION_REQUIRED", //	Failed online authentication. Please try again.
  "CARD_BLOCKED" = "CARD_BLOCKED", //	Something went wrong. Contact us for further details.
  "ACCOUNT_CLOSED" = "ACCOUNT_CLOSED", //	Something went wrong. Contact us for further details.
  "ACCOUNT_LIMIT_REACHED" = "ACCOUNT_LIMIT_REACHED", //	Account limit reached. Please contact us for further details.
  "EXPIRY_DATE_INVALID" = "EXPIRY_DATE_INVALID", //	Incorrect card details provided. Please try again.
  "CARD_INACTIVE" = "CARD_INACTIVE", //	Card not active. Please activate your card and try again.
  "CARD_NOT_PRESENT_AMOUNT_LIMIT_REACHED_DAILY" = "CARD_NOT_PRESENT_AMOUNT_LIMIT_REACHED_DAILY", //	Daily card limit exceeded. Please review the card limits and try again.
  "CARD_NOT_PRESENT_AMOUNT_LIMIT_REACHED_MONTHLY" = "CARD_NOT_PRESENT_AMOUNT_LIMIT_REACHED_MONTHLY", //	Monthly card limit exceeded. Please review the card limits and try again.
  "CARD_NOT_PRESENT_USE_LIMIT_REACHED_DAILY" = "CARD_NOT_PRESENT_USE_LIMIT_REACHED_DAILY", //	Daily card limit exceeded. Please review the card limits and try again.
  "CARD_NOT_PRESENT_USE_LIMIT_REACHED_MONTHLY" = "CARD_NOT_PRESENT_USE_LIMIT_REACHED_MONTHLY", //	Monthly card limit exceeded. Please review the card limits and try again.
  "CARD_PRESENT_AMOUNT_LIMIT_REACHED_DAILY" = "CARD_PRESENT_AMOUNT_LIMIT_REACHED_DAILY", //	Daily card limit exceeded. Please review the card limits and try again.
  "CARD_PRESENT_AMOUNT_LIMIT_REACHED_MONTHLY" = "CARD_PRESENT_AMOUNT_LIMIT_REACHED_MONTHLY", //	Monthly card limit exceeded. Please review the card limits and try again.
  "CARD_PRESENT_USE_LIMIT_REACHED_DAILY" = "CARD_PRESENT_USE_LIMIT_REACHED_DAILY", //	Daily card limit exceeded. Please review the card limits and try again.
  "CARD_PRESENT_USE_LIMIT_REACHED_MONTHLY" = "CARD_PRESENT_USE_LIMIT_REACHED_MONTHLY", //	Monthly card limit exceeded. Please review the card limits and try again.
  "CASH_ADVANCE_AMOUNT_LIMIT_REACHED_DAILY" = "CASH_ADVANCE_AMOUNT_LIMIT_REACHED_DAILY", //	Daily limit for Cash withdrawals has been reached. Contact us for further details.
  "CASH_ADVANCE_AMOUNT_LIMIT_REACHED_MONTHLY" = "CASH_ADVANCE_AMOUNT_LIMIT_REACHED_MONTHLY", //	Monthly limit for Cash withdrawals has been reached. Contact us for further details.
  "TERMINAL_ERROR" = "TERMINAL_ERROR", //	There was an issue with the merchant terminal. Please try again.
  "CVV_INCORRECT" = "CVV_INCORRECT", //	Incorrect card details provided. Please try again.
  "DUPLICATE_TRASACTION" = "DUPLICATE_TRASACTION", //	There was an issue with the merchant terminal. Please try again.
  "PIN_INCORRECT" = "PIN_INCORRECT", //	Incorrect PIN entered. Please try again.
  "INSUFFICIENT_FUNDS" = "INSUFFICIENT_FUNDS", //	Balance is too low. Top up your account and try again.
  "CONTACT_BANK" = "CONTACT_BANK", //	Something went wrong. Contact us for further details.
  "INVALID_PIN_BLOCKED" = "INVALID_PIN_BLOCKED", //	Card is blocked due to incorrect PIN attempts. Please reset the PIN and try again.
  "FRAUD_SUSPECTED" = "FRAUD_SUSPECTED", //	Something went wrong. Contact us for further details.
  "PIN_ENTRY_TIMEOUT" = "PIN_ENTRY_TIMEOUT", //	There was an issue with the merchant terminal. Please try again.
  "RETRY_WITH_CHIP_AND_PIN" = "RETRY_WITH_CHIP_AND_PIN", //	We encountered a problem while trying to approve your transaction. Please try again inserting the card in the merchant terminal.
  "3DS_FAILED" = "3DS_FAILED" // We could not approve your transaction because the merchant did not provide correct authentication information. Please try again.
}