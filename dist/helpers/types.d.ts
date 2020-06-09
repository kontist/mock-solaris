export declare enum ReservationType {
    CARD_AUTHORIZATION = "CARD_AUTHORIZATION"
}
export declare enum ReservationStatus {
    OPEN = "OPEN",
    RESOLVED = "RESOLVED",
    ROLLBACK = "ROLLBACK",
    EXPIRED = "EXPIRED"
}
export declare enum TransactionType {
    PURCHASE = "PURCHASE",
    CASH_ATM = "CASH_ATM",
    CASH_MANUAL = "CASH_MANUAL",
    CREDIT_PRESENTMENT = "CREDIT_PRESENTMENT"
}
export declare enum CardType {
    VIRTUAL_VISA_BUSINESS_DEBIT = "VIRTUAL_VISA_BUSINESS_DEBIT",
    VISA_BUSINESS_DEBIT = "VISA_BUSINESS_DEBIT",
    MASTERCARD_BUSINESS_DEBIT = "MASTERCARD_BUSINESS_DEBIT",
    VIRTUAL_MASTERCARD_BUSINESS_DEBIT = "VIRTUAL_MASTERCARD_BUSINESS_DEBIT",
    VIRTUAL_VISA_FREELANCE_DEBIT = "VIRTUAL_VISA_FREELANCE_DEBIT"
}
export declare enum CardStatus {
    PROCESSING = "PROCESSING",
    INACTIVE = "INACTIVE",
    ACTIVE = "ACTIVE",
    BLOCKED = "BLOCKED",
    BLOCKED_BY_SOLARIS = "BLOCKED_BY_SOLARIS",
    ACTIVATION_BLOCKED_BY_SOLARIS = "ACTIVATION_BLOCKED_BY_SOLARIS",
    CLOSED = "CLOSED",
    CLOSED_BY_SOLARIS = "CLOSED_BY_SOLARIS"
}
export declare enum ActionType {
    RESOLVE = "RESOLVE",
    BOOK = "BOOK",
    EXPIRE = "EXPIRE"
}
export declare enum FxRate {
    EUR = 1,
    USD = 0.904697
}
export declare type Card = {
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
export declare type CardDetails = {
    pin: string;
    reference: string;
    cardNumber: string;
    token: string;
    cardPresentLimits: CardLimits;
    cardNotPresentLimits: CardLimits;
    cvv: string;
    settings: CardSettings;
};
export declare type AccountSnapshot = {
    status: string;
    provider: string;
    id: string;
    iban: string;
    account_id: string;
};
export declare type MockAccount = Account & {
    cards: Array<{
        card: Card;
        cardDetails: CardDetails;
    }>;
    reservations: Reservation[];
    fraudReservations: Reservation[];
    snapshot?: AccountSnapshot;
    overdraftApplications?: OverdraftApplication[];
    overdraft?: Overdraft;
    overdraftInterest?: number;
};
export declare type MockChangeRequest = {
    cardId?: string;
    pin?: string;
    changeRequestId?: string;
    token?: string;
};
export declare type MockPerson = {
    id: string;
    fraudCases?: FraudCase[];
    account?: MockAccount;
    transactions: Booking[];
    changeRequest?: MockChangeRequest;
};
export declare type FraudCase = {
    id: string;
    reservationId: string;
    cardId: string;
    reservationExpiresAt: number;
};
export declare type SolarisAPIErrorData = {
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
export declare type CreateCardData = {
    pin?: string;
    type: CardType;
    business_id?: string;
    reference: string;
    line_1: string;
};
export declare type ReplaceCardData = {
    pin?: string;
    line_1?: string;
};
declare type CardLimit = {
    max_amount_cents: number;
    max_transactions: number;
};
export declare type CardLimits = {
    daily: CardLimit;
    monthly: CardLimit;
};
export declare enum CardLimitType {
    PRESENT = "PRESENT",
    NOT_PRESENT = "NOT_PRESENT"
}
export declare enum CaseResolution {
    PENDING = "PENDING",
    CONFIRMED = "CONFIRMED",
    WHITELISTED = "WHITELISTED",
    TIMED_OUT = "TIMED_OUT",
    TIMEOUT = "TIMEOUT"
}
export declare enum TransactionWebhookEvent {
    "BOOKING" = "BOOKING",
    "SEPA_SCHEDULED_TRANSACTION" = "SEPA_SCHEDULED_TRANSACTION",
    "SEPA_TIMED_ORDER" = "SEPA_TIMED_ORDER",
    "SEPA_DIRECT_DEBIT_RETURN" = "SEPA_DIRECT_DEBIT_RETURN"
}
export declare enum PersonWebhookEvent {
    "IDENTIFICATION" = "IDENTIFICATION",
    "PERSON_SEIZURE_CREATED" = "PERSON_SEIZURE_CREATED",
    "PERSON_SEIZURE_DELETED" = "PERSON_SEIZURE_DELETED"
}
export declare enum AccountWebhookEvent {
    "ACCOUNT_BLOCK" = "ACCOUNT_BLOCK"
}
export declare enum CardWebhookEvent {
    "CARD_AUTHORIZATION" = "CARD_AUTHORIZATION",
    "CARD_FRAUD_CASE_PENDING" = "CARD_FRAUD_CASE_PENDING",
    "CARD_FRAUD_CASE_TIMEOUT" = "CARD_FRAUD_CASE_TIMEOUT",
    "CARD_AUTHORIZATION_DECLINE" = "CARD_AUTHORIZATION_DECLINE",
    "CARD_AUTHORIZATION_RESOLUTION" = "CARD_AUTHORIZATION_RESOLUTION",
    "CARD_LIFECYCLE_EVENT" = "CARD_LIFECYCLE_EVENT"
}
export declare enum OverdraftApplicationWebhookEvent {
    "OVERDRAFT_APPLICATION" = "OVERDRAFT_APPLICATION"
}
export declare enum CardAuthorizationDeclineReason {
    "AUTHENTICATION_REQUIRED" = "AUTHENTICATION_REQUIRED",
    "CARD_BLOCKED" = "CARD_BLOCKED",
    "ACCOUNT_CLOSED" = "ACCOUNT_CLOSED",
    "ACCOUNT_LIMIT_REACHED" = "ACCOUNT_LIMIT_REACHED",
    "EXPIRY_DATE_INVALID" = "EXPIRY_DATE_INVALID",
    "CARD_INACTIVE" = "CARD_INACTIVE",
    "CARD_NOT_PRESENT_AMOUNT_LIMIT_REACHED_DAILY" = "CARD_NOT_PRESENT_AMOUNT_LIMIT_REACHED_DAILY",
    "CARD_NOT_PRESENT_AMOUNT_LIMIT_REACHED_MONTHLY" = "CARD_NOT_PRESENT_AMOUNT_LIMIT_REACHED_MONTHLY",
    "CARD_NOT_PRESENT_USE_LIMIT_REACHED_DAILY" = "CARD_NOT_PRESENT_USE_LIMIT_REACHED_DAILY",
    "CARD_NOT_PRESENT_USE_LIMIT_REACHED_MONTHLY" = "CARD_NOT_PRESENT_USE_LIMIT_REACHED_MONTHLY",
    "CARD_PRESENT_AMOUNT_LIMIT_REACHED_DAILY" = "CARD_PRESENT_AMOUNT_LIMIT_REACHED_DAILY",
    "CARD_PRESENT_AMOUNT_LIMIT_REACHED_MONTHLY" = "CARD_PRESENT_AMOUNT_LIMIT_REACHED_MONTHLY",
    "CARD_PRESENT_USE_LIMIT_REACHED_DAILY" = "CARD_PRESENT_USE_LIMIT_REACHED_DAILY",
    "CARD_PRESENT_USE_LIMIT_REACHED_MONTHLY" = "CARD_PRESENT_USE_LIMIT_REACHED_MONTHLY",
    "CASH_ADVANCE_AMOUNT_LIMIT_REACHED_DAILY" = "CASH_ADVANCE_AMOUNT_LIMIT_REACHED_DAILY",
    "CASH_ADVANCE_AMOUNT_LIMIT_REACHED_MONTHLY" = "CASH_ADVANCE_AMOUNT_LIMIT_REACHED_MONTHLY",
    "TERMINAL_ERROR" = "TERMINAL_ERROR",
    "CVV_INCORRECT" = "CVV_INCORRECT",
    "DUPLICATE_TRASACTION" = "DUPLICATE_TRASACTION",
    "DUPLICATE_TRANSACTION" = "DUPLICATE_TRANSACTION",
    "PIN_INCORRECT" = "PIN_INCORRECT",
    "INSUFFICIENT_FUNDS" = "INSUFFICIENT_FUNDS",
    "CONTACT_BANK" = "CONTACT_BANK",
    "INVALID_PIN_BLOCKED" = "INVALID_PIN_BLOCKED",
    "FRAUD_SUSPECTED" = "FRAUD_SUSPECTED",
    "PIN_ENTRY_TIMEOUT" = "PIN_ENTRY_TIMEOUT",
    "RETRY_WITH_CHIP_AND_PIN" = "RETRY_WITH_CHIP_AND_PIN",
    "3DS_FAILED" = "3DS_FAILED"
}
declare type Amount = {
    value: number;
    unit: string;
    currency: string;
};
export declare type Reservation = {
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
export declare type Booking = {
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
export declare enum BookingType {
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
    CANCELLATION_INTEREST_ACCRUED = "CANCELLATION_INTEREST_ACCRUED"
}
export declare enum CardAuthorizationDeclinedStatus {
    DECLINED = "DECLINED",
    ACCEPTED = "ACCEPTED"
}
export declare enum POSEntryMode {
    "CHIP" = "CHIP",
    "CONTACTLESS" = "CONTACTLESS",
    "MAG_STRIPE" = "MAG_STRIPE",
    "CARD_NOT_PRESENT" = "CARD_NOT_PRESENT",
    "PHONE" = "PHONE",
    "UNKNOWN" = "UNKNOWN"
}
export declare enum ChangeRequestStatus {
    AUTHORIZATION_REQUIRED = "AUTHORIZATION_REQUIRED",
    CONFIRMATION_REQUIRED = "CONFIRMATION_REQUIRED",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED"
}
export declare type CardSettings = {
    contactless_enabled: boolean;
};
export declare type CardTransaction = {
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
export declare enum IdentificationStatus {
    PENDING = "pending",
    PENDING_SUCCESSFUL = "pending_successful",
    PENDING_FAILED = "pending_failed",
    SUCCESSFUL = "successful",
    FAILED = "failed",
    EXPIRED = "expired",
    CREATED = "created",
    ABORTED = "aborted",
    CANCELED = "canceled"
}
export declare enum OverdraftApplicationStatus {
    CREATED = "created",
    INITIAL_SCORING_PENDING = "initial_scoring_pending",
    ACCOUNT_SNAPSHOT_PENDING = "account_snapshot_pending",
    ACCOUNT_SNAPSHOT_VERIFICATION_PENDING = "account_snapshot_verification_pending",
    OFFERED = "offered",
    REJECTED = "rejected",
    OVERDRAFT_CREATED = "overdraft_created"
}
export declare enum OverdraftApplicationDecision {
    OFFERED = "OFFERED",
    REJECTED = "REJECTED"
}
export declare type OverdraftApplication = {
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
export declare enum OverdraftStatus {
    CREATED = "created",
    LIMIT_SET = "limit_set"
}
export declare type Overdraft = {
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
export {};
