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
  cvv: string;
  settings: CardSettings;
};

export type AccountSnapshot = {
  status: string;
  provider: string;
  id: string;
  iban: string;
  account_id: string;
};

export type MockAccount = Account & {
  cards: { card: Card; cardDetails: CardDetails }[];
  reservations: Reservation[];
  fraudReservations: Reservation[];
  pendingReservation: Reservation;
  snapshot?: AccountSnapshot;
  overdraftApplications?: OverdraftApplication[];
  overdraft?: Overdraft;
  overdraftInterest?: number;
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
};

export type MockPerson = {
  id: string;
  fraudCases?: FraudCase[];
  account?: MockAccount;
  transactions: Booking[];
  changeRequest?: MockChangeRequest;
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

export type ReplaceCardData = {
  pin?: string;
  line_1?: string;
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
  NOT_PRESENT = "NOT_PRESENT",
}

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
  "ACCOUNT_PKONTO_CHANGE" = "ACCOUNT_PKONTO_CHANGE",
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
  "CARD_AUTHORIZATION_DECLINE" = "CARD_AUTHORIZATION_DECLINE", // 	The transaction was declined.
  "CARD_AUTHORIZATION_RESOLUTION" = "CARD_AUTHORIZATION_RESOLUTION", // 	The reservation was cancelled, expired or booked. No push notification for the customer is required for this webhook.
  "CARD_LIFECYCLE_EVENT" = "CARD_LIFECYCLE_EVENT", // The status of the card is changed.
  "CARD_TOKEN_LIFECYCLE" = "CARD_TOKEN_LIFECYCLE", // Push provisioning token is created or updated.
  "SCA_CHALLENGE" = "SCA_CHALLENGE", // payment through browser was created
}

export enum OverdraftApplicationWebhookEvent {
  "OVERDRAFT_APPLICATION" = "OVERDRAFT_APPLICATION", // The status is changed.
}

export enum CardAuthorizationDeclineReason {
  "AUTHENTICATION_REQUIRED" = "AUTHENTICATION_REQUIRED", // 	Failed online authentication. Please try again.
  "CARD_BLOCKED" = "CARD_BLOCKED", // 	Something went wrong. Contact us for further details.
  "ACCOUNT_CLOSED" = "ACCOUNT_CLOSED", // 	Something went wrong. Contact us for further details.
  "ACCOUNT_LIMIT_REACHED" = "ACCOUNT_LIMIT_REACHED", // 	Account limit reached. Please contact us for further details.
  "EXPIRY_DATE_INVALID" = "EXPIRY_DATE_INVALID", // 	Incorrect card details provided. Please try again.
  "CARD_INACTIVE" = "CARD_INACTIVE", // 	Card not active. Please activate your card and try again.
  "CARD_NOT_PRESENT_AMOUNT_LIMIT_REACHED_DAILY" = "CARD_NOT_PRESENT_AMOUNT_LIMIT_REACHED_DAILY", // 	Daily card limit exceeded. Please review the card limits and try again.
  "CARD_NOT_PRESENT_AMOUNT_LIMIT_REACHED_MONTHLY" = "CARD_NOT_PRESENT_AMOUNT_LIMIT_REACHED_MONTHLY", // 	Monthly card limit exceeded. Please review the card limits and try again.
  "CARD_NOT_PRESENT_USE_LIMIT_REACHED_DAILY" = "CARD_NOT_PRESENT_USE_LIMIT_REACHED_DAILY", // 	Daily card limit exceeded. Please review the card limits and try again.
  "CARD_NOT_PRESENT_USE_LIMIT_REACHED_MONTHLY" = "CARD_NOT_PRESENT_USE_LIMIT_REACHED_MONTHLY", // 	Monthly card limit exceeded. Please review the card limits and try again.
  "CARD_PRESENT_AMOUNT_LIMIT_REACHED_DAILY" = "CARD_PRESENT_AMOUNT_LIMIT_REACHED_DAILY", // 	Daily card limit exceeded. Please review the card limits and try again.
  "CARD_PRESENT_AMOUNT_LIMIT_REACHED_MONTHLY" = "CARD_PRESENT_AMOUNT_LIMIT_REACHED_MONTHLY", // 	Monthly card limit exceeded. Please review the card limits and try again.
  "CARD_PRESENT_USE_LIMIT_REACHED_DAILY" = "CARD_PRESENT_USE_LIMIT_REACHED_DAILY", // 	Daily card limit exceeded. Please review the card limits and try again.
  "CARD_PRESENT_USE_LIMIT_REACHED_MONTHLY" = "CARD_PRESENT_USE_LIMIT_REACHED_MONTHLY", // 	Monthly card limit exceeded. Please review the card limits and try again.
  "CASH_ADVANCE_AMOUNT_LIMIT_REACHED_DAILY" = "CASH_ADVANCE_AMOUNT_LIMIT_REACHED_DAILY", // 	Daily limit for Cash withdrawals has been reached. Contact us for further details.
  "CASH_ADVANCE_AMOUNT_LIMIT_REACHED_MONTHLY" = "CASH_ADVANCE_AMOUNT_LIMIT_REACHED_MONTHLY", // 	Monthly limit for Cash withdrawals has been reached. Contact us for further details.
  "TERMINAL_ERROR" = "TERMINAL_ERROR", // 	There was an issue with the merchant terminal. Please try again.
  "CVV_INCORRECT" = "CVV_INCORRECT", // 	Incorrect card details provided. Please try again.
  "DUPLICATE_TRASACTION" = "DUPLICATE_TRASACTION", // 	There was an issue with the merchant terminal. Please try again.
  "DUPLICATE_TRANSACTION" = "DUPLICATE_TRANSACTION", // 	There was an issue with the merchant terminal. Please try again.
  "PIN_INCORRECT" = "PIN_INCORRECT", // 	Incorrect PIN entered. Please try again.
  "INSUFFICIENT_FUNDS" = "INSUFFICIENT_FUNDS", // 	Balance is too low. Top up your account and try again.
  "CONTACT_BANK" = "CONTACT_BANK", // 	Something went wrong. Contact us for further details.
  "INVALID_PIN_BLOCKED" = "INVALID_PIN_BLOCKED", // 	Card is blocked due to incorrect PIN attempts. Please reset the PIN and try again.
  "FRAUD_SUSPECTED" = "FRAUD_SUSPECTED", // 	Something went wrong. Contact us for further details.
  "PIN_ENTRY_TIMEOUT" = "PIN_ENTRY_TIMEOUT", // 	There was an issue with the merchant terminal. Please try again.
  "RETRY_WITH_CHIP_AND_PIN" = "RETRY_WITH_CHIP_AND_PIN", // 	We encountered a problem while trying to approve your transaction. Please try again inserting the card in the merchant terminal.
  "3DS_FAILED" = "3DS_FAILED", // We could not approve your transaction because the merchant did not provide correct authentication information. Please try again.
}

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

export type CardSettings = {
  contactless_enabled: boolean;
};

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
