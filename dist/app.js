"use strict";
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
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.serve = void 0;
const express_1 = __importStar(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const swig_1 = __importDefault(require("swig"));
const path_1 = __importDefault(require("path"));
const log = __importStar(require("./logger"));
const oauthAPI = __importStar(require("./routes/oauth"));
const personsAPI = __importStar(require("./routes/persons"));
const deviceBindingAPI = __importStar(require("./routes/deviceBinding"));
const standingOrdersAPI = __importStar(require("./routes/standingOrders"));
const accountsAPI = __importStar(require("./routes/accounts"));
const identificationsAPI = __importStar(require("./routes/identifications"));
const taxIdentificationsAPI = __importStar(require("./routes/taxIdentifications"));
const transactionsAPI = __importStar(require("./routes/transactions"));
const webhooksAPI = __importStar(require("./routes/webhooks"));
const backofficeAPI = __importStar(require("./routes/backoffice"));
const bankStatementsAPI = __importStar(require("./routes/bankStatements"));
const mobileNumberAPI = __importStar(require("./routes/mobileNumber"));
const changeRequestAPI = __importStar(require("./routes/changeRequest"));
const returnNotificationsAPI = __importStar(require("./routes/sepaDirectDebitReturns"));
const seizuresAPI = __importStar(require("./routes/seizures"));
const timedOrdersAPI = __importStar(require("./routes/timedOrders"));
const batchTransfersAPI = __importStar(require("./routes/batchTransfers"));
const cardsAPI = __importStar(require("./routes/cards"));
const e2eAPI = __importStar(require("./routes/e2e"));
const middlewares = __importStar(require("./helpers/middlewares"));
const overdraftAPI = __importStar(require("./routes/overdraft"));
const db_1 = require("./db");
const oauth_1 = require("./helpers/oauth");
const safeRequestHandler_1 = require("./helpers/safeRequestHandler");
const helpers_1 = require("./helpers");
const types_1 = require("./helpers/types");
const app = express_1.default();
function logResponseBody(req, res, next) {
    const oldWrite = res.write;
    const oldEnd = res.end;
    const chunks = [];
    // tslint:disable-next-line: only-arrow-functions
    res.write = function (chunk) {
        chunks.push(Buffer.from(chunk));
        oldWrite.apply(res, arguments);
    };
    // tslint:disable-next-line: only-arrow-functions
    res.end = function (chunk) {
        if (chunk) {
            chunks.push(Buffer.from(chunk));
        }
        let body = Buffer.concat(chunks).toString("utf8");
        if ((res.get("content-type") || "").startsWith("text/html")) {
            body = `${body.slice(0, 14)}...`;
        }
        log.debug("---> ", req.path, ">>", body, "<<");
        oldEnd.apply(res, arguments);
    };
    next();
}
const router = express_1.Router();
app.use(logResponseBody);
app.engine("html", swig_1.default.renderFile);
app.set("view engine", "html");
app.set("views", path_1.default.join(__dirname, "templates"));
app.set("view cache", false);
swig_1.default.setDefaults({ cache: false });
app.use(log.getExpressLogger());
app.use(body_parser_1.default.json());
app.use(body_parser_1.default.urlencoded({ extended: false }));
app.use(errorHandler);
app.use("/v1", router);
app.post("/oauth/token", oauthAPI.generateToken);
function errorHandler(err, req, res, next) {
    log.error(err);
    if (helpers_1.shouldReturnJSON(req)) {
        res.status(500).send({ err: err.message });
    }
    else {
        res.status(500).render("error", { error: err });
    }
}
const { REQUIRE_HOST_HEADER } = process.env;
const checkRequestHostHeader = (req, res, next) => {
    if (REQUIRE_HOST_HEADER && !req.headers.host.includes(REQUIRE_HOST_HEADER)) {
        log.error(`(checkRequestHostHeader()) Tried to connect from ${req.headers.host}`);
        return res
            .status(403)
            .send("You should not connect to staging mocksolaris from local machine");
    }
    next();
};
router.use(oauth_1.oauthTokenAuthenticationMiddleware);
// PERSONS
router.post("/persons", safeRequestHandler_1.safeRequestHandler(personsAPI.createPerson));
router.get("/persons/:person_id", safeRequestHandler_1.safeRequestHandler(personsAPI.showPerson));
router.get("/persons", safeRequestHandler_1.safeRequestHandler(personsAPI.showPersons));
router.patch("/persons/:person_id", safeRequestHandler_1.safeRequestHandler(personsAPI.updatePerson));
router.post("/persons/:person_id/credit_records", safeRequestHandler_1.safeRequestHandler(personsAPI.createCreditRecord));
// DEVICE BINDING
router.post("/mfa/devices", safeRequestHandler_1.safeRequestHandler(deviceBindingAPI.createDevice));
router.get("/mfa/devices/:id", safeRequestHandler_1.safeRequestHandler(deviceBindingAPI.getDeviceInfo));
router.put("/mfa/challenges/signatures/:id", safeRequestHandler_1.safeRequestHandler(deviceBindingAPI.verifyDevice));
router.post("/mfa/challenges/devices", safeRequestHandler_1.safeRequestHandler(deviceBindingAPI.createDeviceChallenge));
router.put("/mfa/challenges/devices/:id", safeRequestHandler_1.safeRequestHandler(deviceBindingAPI.verifyDeviceChallenge));
// ACCOUNTS
router.get("/accounts/:account_id/bookings", safeRequestHandler_1.safeRequestHandler(accountsAPI.showAccountBookings));
router.get("/persons/:person_id/accounts/:id", safeRequestHandler_1.safeRequestHandler(accountsAPI.showPersonAccount));
router.get("/persons/:person_id/accounts", safeRequestHandler_1.safeRequestHandler(accountsAPI.showPersonAccounts));
router.post("/persons/:person_id/accounts", safeRequestHandler_1.safeRequestHandler(accountsAPI.createAccountRequestHandler));
router.post("/persons/:person_id/account_snapshots", safeRequestHandler_1.safeRequestHandler(accountsAPI.createAccountSnapshot));
// OVERDRAFT
router.post("/persons/:person_id/overdraft_applications", safeRequestHandler_1.safeRequestHandler(overdraftAPI.createOverdraftApplication));
router.get("/persons/:person_id/overdraft_applications/:id", safeRequestHandler_1.safeRequestHandler(overdraftAPI.getOverdraftApplication));
router.put("/persons/:person_id/overdraft_applications/:id/account_snapshot", safeRequestHandler_1.safeRequestHandler(overdraftAPI.linkOverdraftApplicationSnapshot));
router.put("/persons/:person_id/overdraft_applications/:id/overdraft", safeRequestHandler_1.safeRequestHandler(overdraftAPI.createOverdraft));
// CARDS
router.post("/persons/:person_id/accounts/:account_id/cards", safeRequestHandler_1.safeRequestHandler(cardsAPI.createCardHandler));
router.get("/accounts/:account_id/cards", safeRequestHandler_1.safeRequestHandler(cardsAPI.getAccountCardsHandler));
router.get("/cards/:card_id", cardsAPI.cardMiddleware, safeRequestHandler_1.safeRequestHandler(cardsAPI.getCardHandler));
router.post("/cards/:card_id/activate", cardsAPI.cardMiddleware, safeRequestHandler_1.safeRequestHandler(cardsAPI.activateCardHandler));
router.post("/cards/:card_id/fraud_cases/:fraud_case_id/confirm", cardsAPI.cardMiddleware, safeRequestHandler_1.safeRequestHandler(cardsAPI.confirmFraudHandler));
router.post("/cards/:card_id/fraud_cases/:fraud_case_id/whitelist", cardsAPI.cardMiddleware, safeRequestHandler_1.safeRequestHandler(cardsAPI.whitelistCardHandler));
const REPLACE_CARD_ALLOWED_STATES = [
    types_1.CardStatus.ACTIVE,
    types_1.CardStatus.BLOCKED,
    types_1.CardStatus.BLOCKED_BY_SOLARIS,
];
router.post("/cards/:card_id/replace", cardsAPI.cardMiddleware, cardsAPI.cardStatusMiddleware(REPLACE_CARD_ALLOWED_STATES), safeRequestHandler_1.safeRequestHandler(cardsAPI.replaceCardHandler));
const GET_CARD_LIMITS_CARD_ALLOWED_STATES = [
    types_1.CardStatus.INACTIVE,
    types_1.CardStatus.ACTIVATION_BLOCKED_BY_SOLARIS,
    types_1.CardStatus.ACTIVE,
    types_1.CardStatus.BLOCKED,
    types_1.CardStatus.BLOCKED_BY_SOLARIS,
    types_1.CardStatus.CLOSED,
    types_1.CardStatus.CLOSED_BY_SOLARIS,
];
router.get("/cards/:card_id/limits/card_present", cardsAPI.cardMiddleware, cardsAPI.cardStatusMiddleware(GET_CARD_LIMITS_CARD_ALLOWED_STATES), safeRequestHandler_1.safeRequestHandler(cardsAPI.getCardPresentLimitsHandler));
router.get("/cards/:card_id/limits/card_not_present", cardsAPI.cardMiddleware, cardsAPI.cardStatusMiddleware(GET_CARD_LIMITS_CARD_ALLOWED_STATES), safeRequestHandler_1.safeRequestHandler(cardsAPI.getCardNotPresentLimitsHandler));
const SET_CARD_LIMITS_CARD_ALLOWED_STATES = [
    types_1.CardStatus.INACTIVE,
    types_1.CardStatus.ACTIVATION_BLOCKED_BY_SOLARIS,
    types_1.CardStatus.ACTIVE,
    types_1.CardStatus.BLOCKED,
    types_1.CardStatus.BLOCKED_BY_SOLARIS,
];
router.put("/cards/:card_id/limits/card_present", cardsAPI.cardMiddleware, cardsAPI.cardStatusMiddleware(SET_CARD_LIMITS_CARD_ALLOWED_STATES), safeRequestHandler_1.safeRequestHandler(cardsAPI.setCardPresentLimitsHandler));
router.put("/cards/:card_id/limits/card_not_present", cardsAPI.cardMiddleware, cardsAPI.cardStatusMiddleware(SET_CARD_LIMITS_CARD_ALLOWED_STATES), safeRequestHandler_1.safeRequestHandler(cardsAPI.setCardNotPresentLimitsHandler));
router.get("/accounts/:account_id/reservations", safeRequestHandler_1.safeRequestHandler(accountsAPI.showAccountReservations));
router.post("/cards/:card_id/block", cardsAPI.cardMiddleware, safeRequestHandler_1.safeRequestHandler(cardsAPI.blockCardHandler));
router.post("/cards/:card_id/unblock", cardsAPI.cardMiddleware, safeRequestHandler_1.safeRequestHandler(cardsAPI.unblockCardHandler));
router.post("/cards/:card_id/change_pin", cardsAPI.cardMiddleware, safeRequestHandler_1.safeRequestHandler(cardsAPI.changePINCardHandler));
router.patch("/cards/:card_id/settings", cardsAPI.cardMiddleware, safeRequestHandler_1.safeRequestHandler(cardsAPI.changeCardSettingsHandler));
router.post("/cards/:card_id/close", cardsAPI.cardMiddleware, cardsAPI.cardStatusMiddleware([
    types_1.CardStatus.INACTIVE,
    types_1.CardStatus.ACTIVE,
    types_1.CardStatus.BLOCKED,
]), safeRequestHandler_1.safeRequestHandler(cardsAPI.closeCardHandler));
router.post("/cards/:card_id/push_provision/:wallet_type", cardsAPI.cardMiddleware, safeRequestHandler_1.safeRequestHandler(cardsAPI.pushProvisioningHandler));
// VIRTUAL CARD DETAILS - in reality this endpoint should run on different server
router.post("/cards/:card_id/virtual_card_requests", cardsAPI.cardMiddleware, cardsAPI.getVirtualCardDetails);
// SEPA_DIRECT_DEBIT_RETURNS
router.get("/sepa_direct_debit_returns", safeRequestHandler_1.safeRequestHandler(returnNotificationsAPI.listReturnNotificationsHandler));
// IDENTIFICATIONS
router.get("/persons/:person_id/identifications", middlewares.withPerson, safeRequestHandler_1.safeRequestHandler(identificationsAPI.showPersonIdentifications));
router.post("/persons/:person_id/identifications", safeRequestHandler_1.safeRequestHandler(identificationsAPI.requireIdentification));
router.patch("/persons/:person_id/identifications/:id/request", safeRequestHandler_1.safeRequestHandler(identificationsAPI.patchIdentification));
// TAX INFORMATION
router.get("/persons/:person_id/tax_identifications", safeRequestHandler_1.safeRequestHandler(taxIdentificationsAPI.listTaxIdentifications));
router.post("/persons/:person_id/tax_identifications", safeRequestHandler_1.safeRequestHandler(taxIdentificationsAPI.submitTaxIdentification));
router.get("/persons/:person_id/tax_identifications/:id", safeRequestHandler_1.safeRequestHandler(taxIdentificationsAPI.showTaxIdentification));
router.patch("/persons/:person_id/tax_identifications/:id", safeRequestHandler_1.safeRequestHandler(taxIdentificationsAPI.updateTaxIdentification));
// TRANSACTIONS
router.post("/persons/:person_id/accounts/:account_id/transactions/sepa_credit_transfer", safeRequestHandler_1.safeRequestHandler(transactionsAPI.createSepaCreditTransfer));
router.post("/persons/:person_id/accounts/:account_id/transactions/sepa_credit_transfer/:transfer_id/authorize", safeRequestHandler_1.safeRequestHandler(transactionsAPI.authorizeTransaction));
router.post("/persons/:person_id/accounts/:account_id/transactions/sepa_credit_transfer/:transfer_id/confirm", safeRequestHandler_1.safeRequestHandler(transactionsAPI.confirmTransaction));
router.post("/accounts/:account_id/transactions/sepa_direct_debit", safeRequestHandler_1.safeRequestHandler(transactionsAPI.createSepaDirectDebit));
// STANDING ORDERS
router.get("/persons/:person_id/accounts/:account_id/standing_orders/:id", safeRequestHandler_1.safeRequestHandler(standingOrdersAPI.showStandingOrderRequestHandler));
router.post("/persons/:person_id/accounts/:account_id/standing_orders", safeRequestHandler_1.safeRequestHandler(standingOrdersAPI.createStandingOrderRequestHandler));
router.patch("/persons/:person_id/accounts/:account_id/standing_orders/:id", safeRequestHandler_1.safeRequestHandler(standingOrdersAPI.updateStandingOrderRequestHandler));
router.patch("/persons/:person_id/accounts/:account_id/standing_orders/:id/cancel", safeRequestHandler_1.safeRequestHandler(standingOrdersAPI.cancelStandingOrderRequestHandler));
// TIMED ORDERS
router.get("/persons/:person_id/accounts/:account_id/timed_orders", safeRequestHandler_1.safeRequestHandler(timedOrdersAPI.fetchTimedOrders));
router.get("/persons/:person_id/accounts/:account_id/timed_orders/:id", safeRequestHandler_1.safeRequestHandler(timedOrdersAPI.fetchTimedOrder));
router.post("/persons/:person_id/accounts/:account_id/timed_orders", safeRequestHandler_1.safeRequestHandler(timedOrdersAPI.createTimedOrder));
router.post("/persons/:person_id/accounts/:account_id/timed_orders/:id/authorize", safeRequestHandler_1.safeRequestHandler(timedOrdersAPI.authorizeTimedOrder));
router.post("/persons/:person_id/accounts/:account_id/timed_orders/:id/confirm", safeRequestHandler_1.safeRequestHandler(timedOrdersAPI.confirmTimedOrder));
router.patch("/persons/:person_id/accounts/:account_id/timed_orders/:id/cancel", safeRequestHandler_1.safeRequestHandler(timedOrdersAPI.cancelTimedOrder));
// BATCHED TRANSFERS
router.post("/persons/:person_id/accounts/:account_id/transactions/sepa_credit_transfer/batches", safeRequestHandler_1.safeRequestHandler(batchTransfersAPI.createBatchTransfer));
// BANK STATEMENTS
router.post("/accounts/:account_id/bank_statements", safeRequestHandler_1.safeRequestHandler(bankStatementsAPI.createBankStatement));
router.get("/accounts/:account_id/bank_statements/:bank_statement_id/bookings", safeRequestHandler_1.safeRequestHandler(bankStatementsAPI.showBankStatementBookings));
// MOBILE NUMBER
router.get("/persons/:person_id/mobile_number", safeRequestHandler_1.safeRequestHandler(mobileNumberAPI.showMobileNumber));
router.post("/persons/:person_id/mobile_number", safeRequestHandler_1.safeRequestHandler(mobileNumberAPI.createMobileNumber));
router.post("/persons/:person_id/mobile_number/authorize", safeRequestHandler_1.safeRequestHandler(mobileNumberAPI.authorizeMobileNumber));
router.post("/persons/:person_id/mobile_number/confirm", safeRequestHandler_1.safeRequestHandler(mobileNumberAPI.confirmMobileNumber));
router.delete("/persons/:person_id/mobile_number", safeRequestHandler_1.safeRequestHandler(mobileNumberAPI.removeMobileNumber));
// CHANGE REQUEST
router.post("/change_requests/:change_request_id/authorize", safeRequestHandler_1.safeRequestHandler(changeRequestAPI.authorizeChangeRequest));
router.post("/change_requests/:change_request_id/confirm", safeRequestHandler_1.safeRequestHandler(changeRequestAPI.confirmChangeRequest));
// SEIZURES
router.get("/persons/:person_id/seizures", safeRequestHandler_1.safeRequestHandler(seizuresAPI.getSeizuresRequestHandler));
// E2E
if (process.env.NODE_ENV === "e2e") {
    router.patch("/e2e/persons/:person_id", safeRequestHandler_1.safeRequestHandler(e2eAPI.updatePerson));
}
// BACKOFFICE
app.get("/__BACKOFFICE__", safeRequestHandler_1.safeRequestHandler(backofficeAPI.listPersons));
app.post("/__BACKOFFICE__/setIdentificationState/:email", safeRequestHandler_1.safeRequestHandler(backofficeAPI.setIdentificationState));
app.get("/__BACKOFFICE__/person/:email", safeRequestHandler_1.safeRequestHandler(backofficeAPI.getPersonHandler));
app.post("/__BACKOFFICE__/person/:email", safeRequestHandler_1.safeRequestHandler(backofficeAPI.updatePersonHandler));
app.post("/__BACKOFFICE__/queueBooking/:accountIdOrEmail", safeRequestHandler_1.safeRequestHandler(backofficeAPI.queueBookingRequestHandler));
app.post("/__BACKOFFICE__/processQueuedBooking/:personIdOrEmail", safeRequestHandler_1.safeRequestHandler(backofficeAPI.processQueuedBookingHandler));
app.post("/__BACKOFFICE__/processQueuedBooking/:personIdOrEmail/:id", safeRequestHandler_1.safeRequestHandler(backofficeAPI.processQueuedBookingHandler));
app.post("/__BACKOFFICE__/updateAccountLockingStatus/:personId", safeRequestHandler_1.safeRequestHandler(backofficeAPI.updateAccountLockingStatusHandler));
// BACKOFFICE - CARDS
app.get("/__BACKOFFICE__/person/:email/cards", safeRequestHandler_1.safeRequestHandler(backofficeAPI.listPersonsCards));
app.post("/__BACKOFFICE__/changeCardStatus", safeRequestHandler_1.safeRequestHandler(backofficeAPI.changeCardStatusHandler));
app.post("/__BACKOFFICE__/person/:person_id/reservations", safeRequestHandler_1.safeRequestHandler(backofficeAPI.createReservationHandler));
app.post("/__BACKOFFICE__/person/:person_id/reservations/:id", safeRequestHandler_1.safeRequestHandler(backofficeAPI.updateReservationHandler));
// BACKOFFICE - STANDING ORDERS
app.post("/__BACKOFFICE__/triggerStandingOrder/:personId/:standingOrderId", safeRequestHandler_1.safeRequestHandler(standingOrdersAPI.triggerStandingOrderRequestHandler));
// BACKOFFICE - SEIZURES
app.post("/__BACKOFFICE__/createSeizure/:person_id", safeRequestHandler_1.safeRequestHandler(seizuresAPI.createSeizureRequestHandler));
app.post("/__BACKOFFICE__/deleteSeizure/:person_id", safeRequestHandler_1.safeRequestHandler(seizuresAPI.deleteSeizureRequestHandler));
app.post("/__BACKOFFICE__/fulfillSeizure/:person_id", safeRequestHandler_1.safeRequestHandler(seizuresAPI.fulfillSeizureRequestHandler));
// BACKOFFICE - TIMED ORDERS
app.post("/__BACKOFFICE__/triggerTimedOrder/:person_id/:timed_order_id", safeRequestHandler_1.safeRequestHandler(async (req, res) => {
    const { person_id: personId, timed_order_id: timedOrderId } = req.params;
    await timedOrdersAPI.triggerTimedOrder(personId, timedOrderId);
    res.redirect("back");
}));
app.post("/__BACKOFFICE__/processTimedOrders/:person_id", safeRequestHandler_1.safeRequestHandler(async (req, res) => {
    await timedOrdersAPI.processTimedOrders(req.params.person_id);
    res.redirect("back");
}));
// BACKOFFICE - OVERDRAFT
app.post("/__BACKOFFICE__/changeOverdraftApplicationStatus", safeRequestHandler_1.safeRequestHandler(backofficeAPI.changeOverdraftApplicationStatusHandler));
app.post("/__BACKOFFICE__/issueInterestAccruedBooking/:person_id", safeRequestHandler_1.safeRequestHandler(backofficeAPI.issueInterestAccruedBookingHandler));
// WEBHOOKS
router.get("/webhooks", checkRequestHostHeader, safeRequestHandler_1.safeRequestHandler(webhooksAPI.indexWebhooksHandler));
router.post("/webhooks", checkRequestHostHeader, safeRequestHandler_1.safeRequestHandler(webhooksAPI.createWebhookHandler));
// HEALTH CHECK
app.get("/health", (req, res) => {
    res.status(200).send("there is no piwo tracker!");
});
// REST
app.get("*", (req, res) => {
    res.status(404).send("Not found");
});
exports.default = app;
exports.serve = async (port) => {
    await db_1.migrate();
    return new Promise((resolve, reject) => {
        app.listen(port, () => {
            log.debug(`mocksolaris listening on http://localhost:${port}/!`);
            resolve();
        });
    });
};
//# sourceMappingURL=app.js.map