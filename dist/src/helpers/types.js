"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OverdraftStatus = exports.OverdraftApplicationDecision = exports.OverdraftApplicationStatus = exports.IdentificationStatus = exports.ChangeRequestStatus = exports.POSEntryMode = exports.CardAuthorizationDeclinedStatus = exports.BookingType = exports.CardAuthorizationDeclineReason = exports.OverdraftApplicationWebhookEvent = exports.CardWebhookEvent = exports.ProvisioningTokenMessageReason = exports.ProvisioningTokenEventType = exports.AccountWebhookEvent = exports.PersonWebhookEvent = exports.TransactionWebhookEvent = exports.CaseResolution = exports.CardLimitType = exports.FxRate = exports.ActionType = exports.ProvisioningTokenStatus = exports.CardStatus = exports.CardType = exports.TransactionType = exports.ReservationStatus = exports.ReservationType = void 0;
var ReservationType;
(function (ReservationType) {
    ReservationType["CARD_AUTHORIZATION"] = "CARD_AUTHORIZATION";
})(ReservationType = exports.ReservationType || (exports.ReservationType = {}));
var ReservationStatus;
(function (ReservationStatus) {
    ReservationStatus["OPEN"] = "OPEN";
    ReservationStatus["RESOLVED"] = "RESOLVED";
    ReservationStatus["ROLLBACK"] = "ROLLBACK";
    ReservationStatus["EXPIRED"] = "EXPIRED";
})(ReservationStatus = exports.ReservationStatus || (exports.ReservationStatus = {}));
var TransactionType;
(function (TransactionType) {
    TransactionType["PURCHASE"] = "PURCHASE";
    TransactionType["CASH_ATM"] = "CASH_ATM";
    TransactionType["CASH_MANUAL"] = "CASH_MANUAL";
    TransactionType["CREDIT_PRESENTMENT"] = "CREDIT_PRESENTMENT";
})(TransactionType = exports.TransactionType || (exports.TransactionType = {}));
var CardType;
(function (CardType) {
    CardType["VIRTUAL_VISA_BUSINESS_DEBIT"] = "VIRTUAL_VISA_BUSINESS_DEBIT";
    CardType["VISA_BUSINESS_DEBIT"] = "VISA_BUSINESS_DEBIT";
    CardType["MASTERCARD_BUSINESS_DEBIT"] = "MASTERCARD_BUSINESS_DEBIT";
    CardType["VIRTUAL_MASTERCARD_BUSINESS_DEBIT"] = "VIRTUAL_MASTERCARD_BUSINESS_DEBIT";
    CardType["VIRTUAL_VISA_FREELANCE_DEBIT"] = "VIRTUAL_VISA_FREELANCE_DEBIT";
})(CardType = exports.CardType || (exports.CardType = {}));
var CardStatus;
(function (CardStatus) {
    CardStatus["PROCESSING"] = "PROCESSING";
    CardStatus["INACTIVE"] = "INACTIVE";
    CardStatus["ACTIVE"] = "ACTIVE";
    CardStatus["BLOCKED"] = "BLOCKED";
    CardStatus["BLOCKED_BY_SOLARIS"] = "BLOCKED_BY_SOLARIS";
    CardStatus["ACTIVATION_BLOCKED_BY_SOLARIS"] = "ACTIVATION_BLOCKED_BY_SOLARIS";
    CardStatus["CLOSED"] = "CLOSED";
    CardStatus["CLOSED_BY_SOLARIS"] = "CLOSED_BY_SOLARIS";
})(CardStatus = exports.CardStatus || (exports.CardStatus = {}));
var ProvisioningTokenStatus;
(function (ProvisioningTokenStatus) {
    ProvisioningTokenStatus["ACTIVE"] = "ACTIVE";
    ProvisioningTokenStatus["INACTIVE"] = "INACTIVE";
    ProvisioningTokenStatus["DEACTIVATED"] = "DEACTIVATED";
    ProvisioningTokenStatus["SUSPENDED"] = "SUSPENDED";
})(ProvisioningTokenStatus = exports.ProvisioningTokenStatus || (exports.ProvisioningTokenStatus = {}));
var ActionType;
(function (ActionType) {
    ActionType["RESOLVE"] = "RESOLVE";
    ActionType["BOOK"] = "BOOK";
    ActionType["EXPIRE"] = "EXPIRE";
})(ActionType = exports.ActionType || (exports.ActionType = {}));
var FxRate;
(function (FxRate) {
    FxRate[FxRate["EUR"] = 1] = "EUR";
    FxRate[FxRate["USD"] = 0.904697] = "USD";
})(FxRate = exports.FxRate || (exports.FxRate = {}));
var CardLimitType;
(function (CardLimitType) {
    CardLimitType["PRESENT"] = "PRESENT";
    CardLimitType["NOT_PRESENT"] = "NOT_PRESENT";
})(CardLimitType = exports.CardLimitType || (exports.CardLimitType = {}));
var CaseResolution;
(function (CaseResolution) {
    CaseResolution["PENDING"] = "PENDING";
    CaseResolution["CONFIRMED"] = "CONFIRMED";
    CaseResolution["WHITELISTED"] = "WHITELISTED";
    CaseResolution["TIMED_OUT"] = "TIMED_OUT";
    CaseResolution["TIMEOUT"] = "TIMEOUT";
})(CaseResolution = exports.CaseResolution || (exports.CaseResolution = {}));
var TransactionWebhookEvent;
(function (TransactionWebhookEvent) {
    TransactionWebhookEvent["BOOKING"] = "BOOKING";
    TransactionWebhookEvent["SEPA_SCHEDULED_TRANSACTION"] = "SEPA_SCHEDULED_TRANSACTION";
    TransactionWebhookEvent["SEPA_TIMED_ORDER"] = "SEPA_TIMED_ORDER";
    TransactionWebhookEvent["SEPA_DIRECT_DEBIT_RETURN"] = "SEPA_DIRECT_DEBIT_RETURN";
})(TransactionWebhookEvent = exports.TransactionWebhookEvent || (exports.TransactionWebhookEvent = {}));
var PersonWebhookEvent;
(function (PersonWebhookEvent) {
    PersonWebhookEvent["IDENTIFICATION"] = "IDENTIFICATION";
    PersonWebhookEvent["PERSON_SEIZURE_CREATED"] = "PERSON_SEIZURE_CREATED";
    PersonWebhookEvent["PERSON_SEIZURE_DELETED"] = "PERSON_SEIZURE_DELETED";
    PersonWebhookEvent["PERSON_DELETED"] = "PERSON_DELETED";
    PersonWebhookEvent["PERSON_CHANGED"] = "PERSON_CHANGED";
})(PersonWebhookEvent = exports.PersonWebhookEvent || (exports.PersonWebhookEvent = {}));
var AccountWebhookEvent;
(function (AccountWebhookEvent) {
    AccountWebhookEvent["ACCOUNT_BLOCK"] = "ACCOUNT_BLOCK";
    AccountWebhookEvent["ACCOUNT_CLOSURE"] = "ACCOUNT_CLOSURE";
})(AccountWebhookEvent = exports.AccountWebhookEvent || (exports.AccountWebhookEvent = {}));
var ProvisioningTokenEventType;
(function (ProvisioningTokenEventType) {
    ProvisioningTokenEventType["TOKEN_CREATED"] = "TOKEN_CREATED";
    ProvisioningTokenEventType["TOKEN_STATUS_UPDATED"] = "TOKEN_STATUS_UPDATED";
})(ProvisioningTokenEventType = exports.ProvisioningTokenEventType || (exports.ProvisioningTokenEventType = {}));
var ProvisioningTokenMessageReason;
(function (ProvisioningTokenMessageReason) {
    ProvisioningTokenMessageReason["TOKEN_CREATED"] = "TOKEN_CREATED";
    ProvisioningTokenMessageReason["LUK_REPLENISHMENT"] = "LUK_REPLENISHMENT";
    ProvisioningTokenMessageReason["DEVICE_PROVISIONING_RESULT"] = "DEVICE_PROVISIONING_RESULT";
    ProvisioningTokenMessageReason["OTP_VERIFICATION_RESULT"] = "OTP_VERIFICATION_RESULT";
})(ProvisioningTokenMessageReason = exports.ProvisioningTokenMessageReason || (exports.ProvisioningTokenMessageReason = {}));
var CardWebhookEvent;
(function (CardWebhookEvent) {
    CardWebhookEvent["CARD_AUTHORIZATION"] = "CARD_AUTHORIZATION";
    CardWebhookEvent["CARD_FRAUD_CASE_PENDING"] = "CARD_FRAUD_CASE_PENDING";
    CardWebhookEvent["CARD_FRAUD_CASE_TIMEOUT"] = "CARD_FRAUD_CASE_TIMEOUT";
    CardWebhookEvent["CARD_AUTHORIZATION_DECLINE"] = "CARD_AUTHORIZATION_DECLINE";
    CardWebhookEvent["CARD_AUTHORIZATION_RESOLUTION"] = "CARD_AUTHORIZATION_RESOLUTION";
    CardWebhookEvent["CARD_LIFECYCLE_EVENT"] = "CARD_LIFECYCLE_EVENT";
    CardWebhookEvent["CARD_TOKEN_LIFECYCLE"] = "CARD_TOKEN_LIFECYCLE";
})(CardWebhookEvent = exports.CardWebhookEvent || (exports.CardWebhookEvent = {}));
var OverdraftApplicationWebhookEvent;
(function (OverdraftApplicationWebhookEvent) {
    OverdraftApplicationWebhookEvent["OVERDRAFT_APPLICATION"] = "OVERDRAFT_APPLICATION";
})(OverdraftApplicationWebhookEvent = exports.OverdraftApplicationWebhookEvent || (exports.OverdraftApplicationWebhookEvent = {}));
var CardAuthorizationDeclineReason;
(function (CardAuthorizationDeclineReason) {
    CardAuthorizationDeclineReason["AUTHENTICATION_REQUIRED"] = "AUTHENTICATION_REQUIRED";
    CardAuthorizationDeclineReason["CARD_BLOCKED"] = "CARD_BLOCKED";
    CardAuthorizationDeclineReason["ACCOUNT_CLOSED"] = "ACCOUNT_CLOSED";
    CardAuthorizationDeclineReason["ACCOUNT_LIMIT_REACHED"] = "ACCOUNT_LIMIT_REACHED";
    CardAuthorizationDeclineReason["EXPIRY_DATE_INVALID"] = "EXPIRY_DATE_INVALID";
    CardAuthorizationDeclineReason["CARD_INACTIVE"] = "CARD_INACTIVE";
    CardAuthorizationDeclineReason["CARD_NOT_PRESENT_AMOUNT_LIMIT_REACHED_DAILY"] = "CARD_NOT_PRESENT_AMOUNT_LIMIT_REACHED_DAILY";
    CardAuthorizationDeclineReason["CARD_NOT_PRESENT_AMOUNT_LIMIT_REACHED_MONTHLY"] = "CARD_NOT_PRESENT_AMOUNT_LIMIT_REACHED_MONTHLY";
    CardAuthorizationDeclineReason["CARD_NOT_PRESENT_USE_LIMIT_REACHED_DAILY"] = "CARD_NOT_PRESENT_USE_LIMIT_REACHED_DAILY";
    CardAuthorizationDeclineReason["CARD_NOT_PRESENT_USE_LIMIT_REACHED_MONTHLY"] = "CARD_NOT_PRESENT_USE_LIMIT_REACHED_MONTHLY";
    CardAuthorizationDeclineReason["CARD_PRESENT_AMOUNT_LIMIT_REACHED_DAILY"] = "CARD_PRESENT_AMOUNT_LIMIT_REACHED_DAILY";
    CardAuthorizationDeclineReason["CARD_PRESENT_AMOUNT_LIMIT_REACHED_MONTHLY"] = "CARD_PRESENT_AMOUNT_LIMIT_REACHED_MONTHLY";
    CardAuthorizationDeclineReason["CARD_PRESENT_USE_LIMIT_REACHED_DAILY"] = "CARD_PRESENT_USE_LIMIT_REACHED_DAILY";
    CardAuthorizationDeclineReason["CARD_PRESENT_USE_LIMIT_REACHED_MONTHLY"] = "CARD_PRESENT_USE_LIMIT_REACHED_MONTHLY";
    CardAuthorizationDeclineReason["CASH_ADVANCE_AMOUNT_LIMIT_REACHED_DAILY"] = "CASH_ADVANCE_AMOUNT_LIMIT_REACHED_DAILY";
    CardAuthorizationDeclineReason["CASH_ADVANCE_AMOUNT_LIMIT_REACHED_MONTHLY"] = "CASH_ADVANCE_AMOUNT_LIMIT_REACHED_MONTHLY";
    CardAuthorizationDeclineReason["TERMINAL_ERROR"] = "TERMINAL_ERROR";
    CardAuthorizationDeclineReason["CVV_INCORRECT"] = "CVV_INCORRECT";
    CardAuthorizationDeclineReason["DUPLICATE_TRASACTION"] = "DUPLICATE_TRASACTION";
    CardAuthorizationDeclineReason["DUPLICATE_TRANSACTION"] = "DUPLICATE_TRANSACTION";
    CardAuthorizationDeclineReason["PIN_INCORRECT"] = "PIN_INCORRECT";
    CardAuthorizationDeclineReason["INSUFFICIENT_FUNDS"] = "INSUFFICIENT_FUNDS";
    CardAuthorizationDeclineReason["CONTACT_BANK"] = "CONTACT_BANK";
    CardAuthorizationDeclineReason["INVALID_PIN_BLOCKED"] = "INVALID_PIN_BLOCKED";
    CardAuthorizationDeclineReason["FRAUD_SUSPECTED"] = "FRAUD_SUSPECTED";
    CardAuthorizationDeclineReason["PIN_ENTRY_TIMEOUT"] = "PIN_ENTRY_TIMEOUT";
    CardAuthorizationDeclineReason["RETRY_WITH_CHIP_AND_PIN"] = "RETRY_WITH_CHIP_AND_PIN";
    CardAuthorizationDeclineReason["3DS_FAILED"] = "3DS_FAILED";
})(CardAuthorizationDeclineReason = exports.CardAuthorizationDeclineReason || (exports.CardAuthorizationDeclineReason = {}));
var BookingType;
(function (BookingType) {
    BookingType["CANCELLATION_BOOKING"] = "CANCELLATION_BOOKING";
    BookingType["CANCELLATION_DOUBLE_BOOKING"] = "CANCELLATION_DOUBLE_BOOKING";
    BookingType["CREDIT_TRANSFER_CANCELLATION"] = "CREDIT_TRANSFER_CANCELLATION";
    BookingType["CURRENCY_TRANSACTION_CANCELLATION"] = "CURRENCY_TRANSACTION_CANCELLATION";
    BookingType["DIRECT_DEBIT"] = "DIRECT_DEBIT";
    BookingType["FOREIGN_PAYMENT"] = "FOREIGN_PAYMENT";
    BookingType["OTHER"] = "OTHER";
    BookingType["SEPA_CREDIT_TRANSFER_RETURN"] = "SEPA_CREDIT_TRANSFER_RETURN";
    BookingType["SEPA_CREDIT_TRANSFER"] = "SEPA_CREDIT_TRANSFER";
    BookingType["SEPA_DIRECT_DEBIT_RETURN"] = "SEPA_DIRECT_DEBIT_RETURN";
    BookingType["SEPA_DIRECT_DEBIT"] = "SEPA_DIRECT_DEBIT";
    BookingType["TRANSFER"] = "TRANSFER";
    BookingType["INTERNATIONAL_CREDIT_TRANSFER"] = "INTERNATIONAL_CREDIT_TRANSFER";
    BookingType["CANCELLATION_SEPA_DIRECT_DEBIT_RETURN"] = "CANCELLATION_SEPA_DIRECT_DEBIT_RETURN";
    BookingType["REBOOKING"] = "REBOOKING";
    BookingType["CANCELLATION_DIRECT_DEBIT"] = "CANCELLATION_DIRECT_DEBIT";
    BookingType["CANCELLATION_SEPA_CREDIT_TRANSFER_RETURN"] = "CANCELLATION_SEPA_CREDIT_TRANSFER_RETURN";
    BookingType["CARD_TRANSACTION"] = "CARD_TRANSACTION";
    BookingType["INTEREST_ACCRUED"] = "INTEREST_ACCRUED";
    BookingType["CANCELLATION_INTEREST_ACCRUED"] = "CANCELLATION_INTEREST_ACCRUED";
})(BookingType = exports.BookingType || (exports.BookingType = {}));
var CardAuthorizationDeclinedStatus;
(function (CardAuthorizationDeclinedStatus) {
    CardAuthorizationDeclinedStatus["DECLINED"] = "DECLINED";
    CardAuthorizationDeclinedStatus["ACCEPTED"] = "ACCEPTED";
})(CardAuthorizationDeclinedStatus = exports.CardAuthorizationDeclinedStatus || (exports.CardAuthorizationDeclinedStatus = {}));
var POSEntryMode;
(function (POSEntryMode) {
    POSEntryMode["CHIP"] = "CHIP";
    POSEntryMode["CONTACTLESS"] = "CONTACTLESS";
    POSEntryMode["MAG_STRIPE"] = "MAG_STRIPE";
    POSEntryMode["CARD_NOT_PRESENT"] = "CARD_NOT_PRESENT";
    POSEntryMode["PHONE"] = "PHONE";
    POSEntryMode["UNKNOWN"] = "UNKNOWN";
})(POSEntryMode = exports.POSEntryMode || (exports.POSEntryMode = {}));
var ChangeRequestStatus;
(function (ChangeRequestStatus) {
    ChangeRequestStatus["AUTHORIZATION_REQUIRED"] = "AUTHORIZATION_REQUIRED";
    ChangeRequestStatus["CONFIRMATION_REQUIRED"] = "CONFIRMATION_REQUIRED";
    ChangeRequestStatus["COMPLETED"] = "COMPLETED";
    ChangeRequestStatus["FAILED"] = "FAILED";
})(ChangeRequestStatus = exports.ChangeRequestStatus || (exports.ChangeRequestStatus = {}));
var IdentificationStatus;
(function (IdentificationStatus) {
    IdentificationStatus["PENDING"] = "pending";
    IdentificationStatus["PENDING_SUCCESSFUL"] = "pending_successful";
    IdentificationStatus["PENDING_FAILED"] = "pending_failed";
    IdentificationStatus["SUCCESSFUL"] = "successful";
    IdentificationStatus["FAILED"] = "failed";
    IdentificationStatus["EXPIRED"] = "expired";
    IdentificationStatus["CREATED"] = "created";
    IdentificationStatus["ABORTED"] = "aborted";
    IdentificationStatus["CANCELED"] = "canceled";
})(IdentificationStatus = exports.IdentificationStatus || (exports.IdentificationStatus = {}));
var OverdraftApplicationStatus;
(function (OverdraftApplicationStatus) {
    OverdraftApplicationStatus["CREATED"] = "created";
    OverdraftApplicationStatus["INITIAL_SCORING_PENDING"] = "initial_scoring_pending";
    OverdraftApplicationStatus["ACCOUNT_SNAPSHOT_PENDING"] = "account_snapshot_pending";
    OverdraftApplicationStatus["ACCOUNT_SNAPSHOT_VERIFICATION_PENDING"] = "account_snapshot_verification_pending";
    OverdraftApplicationStatus["OFFERED"] = "offered";
    OverdraftApplicationStatus["REJECTED"] = "rejected";
    OverdraftApplicationStatus["OVERDRAFT_CREATED"] = "overdraft_created";
})(OverdraftApplicationStatus = exports.OverdraftApplicationStatus || (exports.OverdraftApplicationStatus = {}));
var OverdraftApplicationDecision;
(function (OverdraftApplicationDecision) {
    OverdraftApplicationDecision["OFFERED"] = "OFFERED";
    OverdraftApplicationDecision["REJECTED"] = "REJECTED";
})(OverdraftApplicationDecision = exports.OverdraftApplicationDecision || (exports.OverdraftApplicationDecision = {}));
var OverdraftStatus;
(function (OverdraftStatus) {
    OverdraftStatus["CREATED"] = "created";
    OverdraftStatus["LIMIT_SET"] = "limit_set";
})(OverdraftStatus = exports.OverdraftStatus || (exports.OverdraftStatus = {}));
//# sourceMappingURL=types.js.map