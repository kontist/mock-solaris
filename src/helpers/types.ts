export enum ReservationType {
  CARD_AUTHORIZATION = "CARD_AUTHORIZATION",
}

export enum ReservationStatus {
  OPEN = "OPEN",
  RESOLVED = "RESOLVED",
  ROLLBACK = "ROLLBACK",
  EXPIRED = "EXPIRED",
}

export enum TransactionType {
  PURCHASE = "PURCHASE",
  CASH_ATM = "CASH_ATM",
  CASH_MANUAL = "CASH_MANUAL",
  CREDIT_PRESENTMENT = "CREDIT_PRESENTMENT",
  CASH_ATM_REVERSAL = "CASH_ATM_REVERSAL",
  CASH_MANUAL_REVERSAL = "CASH_MANUAL_REVERSAL",
  PURCHASE_REVERSAL = "PURCHASE_REVERSAL",
  OCT = "OCT",
  FORCE_POST_TRANSACTION = "FORCE_POST_TRANSACTION",
  DEBIT_PRESENTMENT = "DEBIT_PRESENTMENT",
  DISPUTE_TRANSACTION = "DISPUTE_TRANSACTION",
  AFT = "AFT",
}

export enum CardType {
  VIRTUAL_VISA_BUSINESS_DEBIT = "VIRTUAL_VISA_BUSINESS_DEBIT",
  VISA_BUSINESS_DEBIT = "VISA_BUSINESS_DEBIT",
  VISA_BUSINESS_DEBIT_2 = "VISA_BUSINESS_DEBIT_2",
  MASTERCARD_BUSINESS_DEBIT = "MASTERCARD_BUSINESS_DEBIT",
  VIRTUAL_MASTERCARD_BUSINESS_DEBIT = "VIRTUAL_MASTERCARD_BUSINESS_DEBIT",
  VIRTUAL_VISA_FREELANCE_DEBIT = "VIRTUAL_VISA_FREELANCE_DEBIT",
}

export enum CardStatus {
  PROCESSING = "PROCESSING",
  INACTIVE = "INACTIVE",
  ACTIVE = "ACTIVE",
  BLOCKED = "BLOCKED",
  BLOCKED_BY_SOLARIS = "BLOCKED_BY_SOLARIS",
  ACTIVATION_BLOCKED_BY_SOLARIS = "ACTIVATION_BLOCKED_BY_SOLARIS",
  CLOSED = "CLOSED",
  CLOSED_BY_SOLARIS = "CLOSED_BY_SOLARIS",
}

export enum ProvisioningTokenStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  DEACTIVATED = "DEACTIVATED",
  SUSPENDED = "SUSPENDED",
}

export type ProvisioningTokenStatusChangePayload = {
  card_id: string;
  token_reference_id: string;
  client_wallet_account_id: string;
  wallet_type?: string;
  token_status?: ProvisioningTokenStatus;
  event_type?: string;
  message_reason?: string;
};

export enum ActionType {
  RESOLVE = "RESOLVE",
  BOOK = "BOOK",
  EXPIRE = "EXPIRE",
}

export enum FxRate {
  EUR = 1.0,
  USD = 0.904697,
}

export type Card = {
  id: string;
  type: CardType;
  status: CardStatus;
  expiration_date: string | null;
  person_id: string;
  account_id: string;
  business_id: string | null;
  new_card_ordered: boolean;
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
  cvv: string;
};

export type AccountSnapshot = {
  status: string;
  provider: string;
  id: string;
  iban: string;
  account_id: string;
};

export enum Scope {
  CARD = "CARD",
}

export enum Origin {
  SOLARISBANK = "SOLARISBANK",
}

export type CardSpendingLimitControl = {
  id: string;
  scope: Scope;
  scope_id: string;
  origin: Origin;
  idempotency_key: string;
  limit: CardSpendingLimit;
};

export type CardData = {
  card: Card;
  cardDetails: CardDetails;
  provisioningToken?: ProvisioningTokenStatusChangePayload;
  controls: CardSpendingLimitControl[];
};

export type MockAccount = {
  id: string;
  cards: CardData[];
  reservations: Reservation[];
  fraudReservations: Reservation[];
  pendingReservation: Reservation;
  snapshot?: AccountSnapshot;
  overdraftApplications?: OverdraftApplication[];
  overdraft?: Overdraft;
  overdraftInterest?: number;
  balance: Amount;
  account_limit?: Amount;
  locking_status: string;
  iban: string;
  available_balance?: Amount;
};

export type MockChangeRequest = {
  cardId?: string;
  pin?: string;
  changeRequestId?: string;
  token?: string;
  declineChangeRequestId?: string;
  authenticateChangeRequestId?: string;
  method?: string;
  createdAt: string;
  delta?: Record<string, unknown>;
  transfer?: Record<string, any>;
};

export interface StandingOrder {
  id: string;
  amount: Amount;
  reference: string;
  next_occurrence?: string;
  status: string;
  last_execution_date?: string;
  reoccurrence?: string;
}

export type MockPerson = {
  id: string;
  fraudCases?: FraudCase[];
  account?: MockAccount;
  transactions: Booking[];
  changeRequest?: MockChangeRequest;
  origin?: string;
  queuedBookings?: Record<string, unknown>[];
  seizure?: Record<string, unknown>;
  postboxItems?: Record<string, unknown>[];
};

export type FraudCase = {
  id: string;
  reservationId: string;
  cardId: string;
  reservationExpiresAt: number;
};

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

export enum CardSpendingLimitType {
  TRANSACTION_TYPE = "TRANSACTION_TYPE",
}

export enum CardSpendingLimitPeriod {
  DAILY = "DAILY",
  MONTHLY = "MONTHLY",
}

export enum DimensionType {
  PURCHASE = "PURCHASE",
  ATM_WITHDRAWAL = "ATM_WITHDRAWAL",
}

export type CardSpendingLimit = {
  type: CardSpendingLimitType;
  dimension: DimensionType[];
  period: CardSpendingLimitPeriod;
  amount?: number;
  count?: number;
};

export type ReplaceCardData = {
  pin?: string;
  line_1?: string;
};

type CardLimit = {
  max_amount_cents: number;
  max_transactions: number;
};

export enum CaseResolution {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  WHITELISTED = "WHITELISTED",
  TIMED_OUT = "TIMED_OUT",
  TIMEOUT = "TIMEOUT",
}

export enum TransactionWebhookEvent {
  "BOOKING" = "BOOKING",
  "SEPA_SCHEDULED_TRANSACTION" = "SEPA_SCHEDULED_TRANSACTION",
  "SEPA_TIMED_ORDER" = "SEPA_TIMED_ORDER",
  "SEPA_DIRECT_DEBIT_RETURN" = "SEPA_DIRECT_DEBIT_RETURN",
}

export enum PersonWebhookEvent {
  "IDENTIFICATION" = "IDENTIFICATION",
  "PERSON_SEIZURE_CREATED" = "PERSON_SEIZURE_CREATED",
  "PERSON_SEIZURE_DELETED" = "PERSON_SEIZURE_DELETED",
  "PERSON_DELETED" = "PERSON_DELETED",
  "PERSON_CHANGED" = "PERSON_CHANGED",
}

export enum AccountWebhookEvent {
  "ACCOUNT_BLOCK" = "ACCOUNT_BLOCK",
  "ACCOUNT_CLOSURE" = "ACCOUNT_CLOSURE",
  "ACCOUNT_LIMIT_CHANGE" = "ACCOUNT_LIMIT_CHANGE",
}

export enum ProvisioningTokenEventType {
  TOKEN_CREATED = "TOKEN_CREATED",
  TOKEN_STATUS_UPDATED = "TOKEN_STATUS_UPDATED",
}

export enum ProvisioningTokenMessageReason {
  TOKEN_CREATED = "TOKEN_CREATED",
  LUK_REPLENISHMENT = "LUK_REPLENISHMENT",
  DEVICE_PROVISIONING_RESULT = "DEVICE_PROVISIONING_RESULT",
  OTP_VERIFICATION_RESULT = "OTP_VERIFICATION_RESULT",
}

export enum CardWebhookEvent {
  "CARD_AUTHORIZATION" = "CARD_AUTHORIZATION", // 	An authorization was created on the account using the card
  "CARD_FRAUD_CASE_PENDING" = "CARD_FRAUD_CASE_PENDING", // 	A fraud case was recorded, that needs customers immediate respond
  "CARD_FRAUD_CASE_TIMEOUT" = "CARD_FRAUD_CASE_TIMEOUT", // 	The recorded fraud case didn't received response from the customer
  "CARD_AUTHORIZATION_DECLINE_V2" = "CARD_AUTHORIZATION_DECLINE_V2", // A customer's card transaction was declined
  "CARD_AUTHORIZATION_RESOLUTION" = "CARD_AUTHORIZATION_RESOLUTION", // 	The reservation was cancelled, expired or booked. No push notification for the customer is required for this webhook.
  "CARD_LIFECYCLE_EVENT" = "CARD_LIFECYCLE_EVENT", // The status of the card is changed.
  "CARD_TOKEN_LIFECYCLE" = "CARD_TOKEN_LIFECYCLE", // Push provisioning token is created or updated.
  "SCA_CHALLENGE" = "SCA_CHALLENGE", // payment through browser was created
}

export enum OverdraftApplicationWebhookEvent {
  "OVERDRAFT_APPLICATION" = "OVERDRAFT_APPLICATION", // The status is changed.
}

export enum PostboxItemEvent {
  POSTBOX_ITEM_CREATED = "POSTBOX_ITEM_CREATED",
}

export type WebhookType =
  | OverdraftApplicationWebhookEvent
  | CardWebhookEvent
  | TransactionWebhookEvent
  | PersonWebhookEvent
  | AccountWebhookEvent
  | PostboxItemEvent;

export enum CardAuthorizationDeclineV2Type {
  "3DS_FAILED" = "3DS_FAILED", // We could not approve your transaction because the merchant did not provide correct authentication information. Please try again.
  "AUTHENTICATION_REQUIRED" = "AUTHENTICATION_REQUIRED", // Failed online authentication. Please try again.
  "CARD_BLOCKED" = "CARD_BLOCKED", // Something went wrong. Contact us for further details.
  "CARD_EXPIRED" = "CARD_EXPIRED", // This card has expired. Please use your replacement card. If you have not yet received one, then please contact customer support.
  "CARD_INACTIVE" = "CARD_INACTIVE", // Card not active. Please activate your card and try again.
  "CARD_LOST" = "CARD_LOST", // The card was reported as lost. If you have not received a replacement card, please contact customer support.
  "CARD_STOLEN" = "CARD_STOLEN", // The card was reported as stolen. If you have not received a replacement card, please contact customer support.
  "EXPIRY_DATE_INVALID" = "EXPIRY_DATE_INVALID", // Incorrect card details provided. Please try again.
  "FRAUD_SUSPECTED" = "FRAUD_SUSPECTED", // Something went wrong. Contact us for further details.
  "INSUFFICIENT_FUNDS" = "INSUFFICIENT_FUNDS", // Balance is too low. Top up your account and try again.
  "INVALID_CARD_DETAILS" = "INVALID_CARD_DETAILS", // Invalid card details were provided. Please double-check your card details and ensure that your card is not blocked and try again.
  "INVALID_PIN_BLOCKED" = "INVALID_PIN_BLOCKED", // Card is blocked due to incorrect PIN attempts. Please reset the PIN and try again.
  "LIST_CONTROL" = "LIST_CONTROL", // Spending control violated. Please review the set controls and try again.
  "PIN_INCORRECT" = "PIN_INCORRECT", // Incorrect PIN entered. Please try again.
  "SCA_REQUIRED" = "SCA_REQUIRED", // Authentication is required for this transaction.
  "SPENDING_LIMIT" = "SPENDING_LIMIT", // Spending limit exceeded. Please review the set limits and try again.
  "UNKNOWN" = "UNKNOWN", // The payment was declined for an unclear reason. Please try to make a purchase at a different merchant. If payment still fails, then please order a replacement card.
  "UNSUPPORTED_FUNCTION" = "UNSUPPORTED_FUNCTION", // The operation attempted with your card is not supported.
}

export type CardAuthorizationDeclineV2Reason = {
  type: CardAuthorizationDeclineV2Type;
  id: string;
  message: string;
};

type Amount = {
  value: number;
  unit: string;
  currency: string;
};

export type Reservation = {
  id: string;
  amount: Amount;
  reservation_type: ReservationType;
  reference: string;
  status: ReservationStatus;
  meta_info: string;
  expires_at: string | null;
  expired_at: string | null;
  resolved_at: string | null;
  description: string;
};

export type Booking = {
  id: string;
  creation_date: string;
  valuta_date: string;
  booking_date: string;
  booking_type: string;
  amount: Amount;
  description: string;
  recipient_bic: string;
  recipient_iban: string;
  recipient_name: string;
  sender_bic: string;
  sender_iban: string;
  sender_name: string;
  end_to_end_id: string;
  creditor_identifier?: string | null;
  mandate_reference?: string | null;
  transaction_id: string;
  return_transaction_id?: string | null;
  sepa_return_code?: string | null;
  sepa_return_reason?: string | null;
  sepa_return_reason_definition?: string | null;
  meta_info: string | null;
};

export enum BookingType {
  CANCELLATION_BOOKING = "CANCELLATION_BOOKING",
  CANCELLATION_DOUBLE_BOOKING = "CANCELLATION_DOUBLE_BOOKING",
  CREDIT_TRANSFER_CANCELLATION = "CREDIT_TRANSFER_CANCELLATION",
  CURRENCY_TRANSACTION_CANCELLATION = "CURRENCY_TRANSACTION_CANCELLATION",
  DIRECT_DEBIT = "DIRECT_DEBIT",
  FOREIGN_PAYMENT = "FOREIGN_PAYMENT",
  OTHER = "OTHER",
  SEPA_CREDIT_TRANSFER_RETURN = "SEPA_CREDIT_TRANSFER_RETURN",
  SEPA_CREDIT_TRANSFER = "SEPA_CREDIT_TRANSFER",
  SEPA_DIRECT_DEBIT_RETURN = "SEPA_DIRECT_DEBIT_RETURN",
  SEPA_DIRECT_DEBIT = "SEPA_DIRECT_DEBIT",
  TRANSFER = "TRANSFER",
  INTERNATIONAL_CREDIT_TRANSFER = "INTERNATIONAL_CREDIT_TRANSFER",
  CANCELLATION_SEPA_DIRECT_DEBIT_RETURN = "CANCELLATION_SEPA_DIRECT_DEBIT_RETURN",
  REBOOKING = "REBOOKING",
  CANCELLATION_DIRECT_DEBIT = "CANCELLATION_DIRECT_DEBIT",
  CANCELLATION_SEPA_CREDIT_TRANSFER_RETURN = "CANCELLATION_SEPA_CREDIT_TRANSFER_RETURN",
  CARD_TRANSACTION = "CARD_TRANSACTION",
  INTEREST_ACCRUED = "INTEREST_ACCRUED",
  CANCELLATION_INTEREST_ACCRUED = "CANCELLATION_INTEREST_ACCRUED",
  COMMISSION_OVERDRAFT = "COMMISSION_OVERDRAFT",
}

export enum CardAuthorizationDeclinedStatus {
  DECLINED = "DECLINED",
  ACCEPTED = "ACCEPTED",
}

export enum POSEntryMode {
  "CHIP" = "CHIP",
  "CONTACTLESS" = "CONTACTLESS",
  "MAG_STRIPE" = "MAG_STRIPE",
  "CARD_NOT_PRESENT" = "CARD_NOT_PRESENT",
  "PHONE" = "PHONE",
  "UNKNOWN" = "UNKNOWN",
}

export enum ChangeRequestStatus {
  AUTHORIZATION_REQUIRED = "AUTHORIZATION_REQUIRED",
  CONFIRMATION_REQUIRED = "CONFIRMATION_REQUIRED",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export type CardTransaction = {
  card_id: string;
  type: TransactionType;
  status: CardAuthorizationDeclinedStatus;
  attempted_at: Date;
  pos_entry_mode: POSEntryMode;
  merchant: {
    country_code: string;
    category_code: string;
    name: string;
  };
  amount: Amount;
  original_amount: Amount;
};

export enum IdentificationStatus {
  PENDING = "pending",
  PENDING_SUCCESSFUL = "pending_successful",
  PENDING_FAILED = "pending_failed",
  SUCCESSFUL = "successful",
  FAILED = "failed",
  EXPIRED = "expired",
  CREATED = "created",
  ABORTED = "aborted",
  CANCELED = "canceled",
}

/*
 * Customer Screening and Risk Checks
 * @see @link{https://docs.solarisbank.com/guides/get-started/digital-banking/onboard-person/#customer-due-diligence-cdd}
 */

export enum ScreeningProgress {
  NOT_SCREENED = "NOT_SCREENED",
  POTENTIAL_MATCH = "POTENTIAL_MATCH",
  SCREENED_ACCEPTED = "SCREENED_ACCEPTED",
  SCREENED_DECLINED = "SCREENED_DECLINED",
}

export enum RiskClarificationStatus {
  NOT_SCORED = "NOT_SCORED",
  POTENTIAL_RISK = "POTENTIAL_RISK",
  NORMAL_RISK = "NORMAL_RISK",
  INFORMATION_REQUESTED = "INFORMATION_REQUESTED",
  INFORMATION_RECEIVED = "INFORMATION_RECEIVED",
  RISK_ACCEPTED = "RISK_ACCEPTED",
  RISK_REJECTED = "RISK_REJECTED",
  CUSTOMER_UNRESPONSIVE = "CUSTOMER_UNRESPONSIVE",
  SCORING_NOT_REQUIRED = "SCORING_NOT_REQUIRED",
}

export enum CustomerVettingStatus {
  NOT_VETTED = "NOT_VETTED",
  NO_MATCH = "NO_MATCH",
  POTENTIAL_MATCH = "POTENTIAL_MATCH",
  INFORMATION_REQUESTED = "INFORMATION_REQUESTED",
  INFORMATION_RECEIVED = "INFORMATION_RECEIVED",
  RISK_ACCEPTED = "RISK_ACCEPTED",
  RISK_REJECTED = "RISK_REJECTED",
  CUSTOMER_UNRESPONSIVE = "CUSTOMER_UNRESPONSIVE",
  VETTING_NOT_REQUIRED = "VETTING_NOT_REQUIRED",
}

/*
 * End of Customer Screening and Risk Checks
 */

export enum OverdraftApplicationStatus {
  CREATED = "created",
  INITIAL_SCORING_PENDING = "initial_scoring_pending",
  ACCOUNT_SNAPSHOT_PENDING = "account_snapshot_pending",
  ACCOUNT_SNAPSHOT_VERIFICATION_PENDING = "account_snapshot_verification_pending",
  OFFERED = "offered",
  REJECTED = "rejected",
  OVERDRAFT_CREATED = "overdraft_created",
  EXPIRED = "expired",
}

export enum OverdraftApplicationDecision {
  OFFERED = "OFFERED",
  REJECTED = "REJECTED",
}

export enum DeliveryMethod {
  MOBILE_NUMBER = "mobile_number",
  DEVICE_SIGNING = "device_signing",
}

export type AuthorizeChangeRequestResponse = {
  id: string;
  status: ChangeRequestStatus;
  updated_at: string;
  string_to_sign?: string;
};

export type OverdraftApplication = {
  id: string;
  account_snapshot_id: string | null;
  created_at: string;
  limit: Amount | null;
  credit_record_id: string;
  rejection_reasons: [string] | null;
  decision: OverdraftApplicationDecision | null;
  overdraft_id: string | null;
  person_id: string;
  status: OverdraftApplicationStatus;
  interest_accrual_rate: number;
  overdraft_rate: number;
  interest_conditions_enabled: boolean;
};

export enum OverdraftStatus {
  CREATED = "created",
  LIMIT_SET = "limit_set",
}

export type Overdraft = {
  status: OverdraftStatus;
  person_id: string;
  limit: Amount;
  interest_accrual_rate: number;
  overdraft_rate: number;
  interest_conditions_enabled: boolean;
  id: string;
  created_at: string;
  account_id: string;
};

export enum DeviceConsentEventType {
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export interface DeviceConsentPayload {
  event_type: DeviceConsentEventType;
  confirmed_at: string;
}

export interface DeviceConsent {
  id: string;
  person_id: string;
  event_type: DeviceConsentEventType;
  confirmed_at: string;
  created_at: string;
}

export enum DeviceActivityType {
  APP_START = "APP_START",
  PASSWORD_RESET = "PASSWORD_RESET",
  CONSENT_PROVIDED = "CONSENT_PROVIDED",
}

export interface DeviceActivityPayload {
  device_data: string;
  activity_type: DeviceActivityType;
}

export enum PostboxDocumentType {
  ACCOUNT_STATEMENT = "ACCOUNT_STATEMENT",
  BALANCE_CONFIRMATION = "BALANCE_CONFIRMATION",
  CUSTOMER_INFORMATION = "CUSTOMER_INFORMATION",
  DUNNING_INFORMATION = "DUNNING_INFORMATION",
  LOAN_SCHEDULE = "LOAN_SCHEDULE",
  SECURITIES_INVOICE = "SECURITIES_INVOICE",
  SECURITIES_EVENT = "SECURITIES_EVENT",
  SECURITIES_EVENT_NOTIFICATION = "SECURITIES_EVENT_NOTIFICATION",
  DEPOT_STATEMENT_MIFID = "DEPOT_STATEMENT_MIFID",
  EX_POST_COST_INFORMATION = "EX_POST_COST_INFORMATION",
  DEPOT_STATEMENT = "DEPOT_STATEMENT",
  ASSETS_ACQUISITION = "ASSETS_ACQUISITION",
  ASSETS_ACQUISITION_COSTS = "ASSETS_ACQUISITION_COSTS",
  PROFIT_TAX_STATEMENT = "PROFIT_TAX_STATEMENT",
  YEARLY_TAX_STATEMENT = "YEARLY_TAX_STATEMENT",
  TAX_SETTLEMENT_CALCULATION = "TAX_SETTLEMENT_CALCULATION",
  CREDIT_CARD_STATEMENT = "CREDIT_CARD_STATEMENT",
  RELATIONSHIP_TERMINATION = "RELATIONSHIP_TERMINATION",
  CREDIT_CARD_SECCI = "CREDIT_CARD_SECCI",
  CREDIT_CARD_CONTRACT = "CREDIT_CARD_CONTRACT",
  CREDIT_CARD_CONTRACT_SIGNED = "CREDIT_CARD_CONTRACT_SIGNED",
}

export enum PostboxOwnerType {
  PERSON = "Person",
  BUSINESS = "Business",
}
