import express, { Router } from "express";
import bodyParser from "body-parser";
import swig from "swig";
import path from "path";

import * as log from "./logger";
import * as oauthAPI from "./routes/oauth";
import * as personsAPI from "./routes/persons";
import * as deviceBindingAPI from "./routes/deviceBinding";
import * as standingOrdersAPI from "./routes/standingOrders";
import * as accountsAPI from "./routes/accounts";
import * as identificationsAPI from "./routes/identifications";
import * as taxIdentificationsAPI from "./routes/taxIdentifications";
import * as transactionsAPI from "./routes/transactions";
import * as webhooksAPI from "./routes/webhooks";
import * as backofficeAPI from "./routes/backoffice";
import * as accountStatementsAPI from "./routes/accountStatements";
import * as bankStatementsAPI from "./routes/bankStatements";
import * as mobileNumberAPI from "./routes/mobileNumber";
import * as changeRequestAPI from "./routes/changeRequest";
import * as returnNotificationsAPI from "./routes/sepaDirectDebitReturns";
import * as seizuresAPI from "./routes/seizures";
import * as timedOrdersAPI from "./routes/timedOrders";
import * as batchTransfersAPI from "./routes/batchTransfers";
import * as cardsAPI from "./routes/cards";
import * as e2eAPI from "./routes/e2e";
import * as middlewares from "./helpers/middlewares";
import * as ovedraftAPI from "./routes/overdraft";

import { migrate } from "./db";

import { oauthTokenAuthenticationMiddleware } from "./helpers/oauth";
import { safeRequestHandler } from "./helpers/safeRequestHandler";
import { shouldReturnJSON } from "./helpers";
import { CardStatus } from "./helpers/types";
const app = express();

function logResponseBody(req, res, next) {
  const oldWrite = res.write;
  const oldEnd = res.end;

  var chunks = [];

  res.write = function(chunk) {
    chunks.push(Buffer.from(chunk));

    oldWrite.apply(res, arguments);
  };

  res.end = function(chunk) {
    if (chunk) {
      chunks.push(Buffer.from(chunk));
    }

    var body = Buffer.concat(chunks).toString("utf8");

    if ((res.get("content-type") || "").startsWith("text/html")) {
      body = `${body.slice(0, 14)}...`;
    }

    log.debug("---> ", req.path, ">>", body, "<<");

    oldEnd.apply(res, arguments);
  };

  next();
}

const router = new Router();

app.use(logResponseBody);

app.engine("html", swig.renderFile);
app.set("view engine", "html");
app.set("views", path.join(__dirname, "templates"));
app.set("view cache", false);
swig.setDefaults({ cache: false });

app.use(log.getExpressLogger());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(errorHandler);
app.use("/v1", router);
app.post("/oauth/token", oauthAPI.generateToken);

function errorHandler(err, req, res, next) {
  log.error(err);

  if (shouldReturnJSON(req)) {
    res.status(500).send({ err: err.message });
  } else {
    res.status(500).render("error", { error: err });
  }
}

const { REQUIRE_HOST_HEADER } = process.env;

const checkRequestHostHeader = (req, res, next) => {
  if (REQUIRE_HOST_HEADER && !req.headers.host.includes(REQUIRE_HOST_HEADER)) {
    log.error(
      `(checkRequestHostHeader()) Tried to connect from ${req.headers.host}`
    );

    return res
      .status(403)
      .send("You should not connect to staging mocksolaris from local machine");
  }

  next();
};

router.use(oauthTokenAuthenticationMiddleware);

// PERSONS
router.post("/persons", safeRequestHandler(personsAPI.createPerson));
router.get("/persons/:person_id", safeRequestHandler(personsAPI.showPerson));
router.get("/persons", safeRequestHandler(personsAPI.showPersons));
router.patch(
  "/persons/:person_id",
  safeRequestHandler(personsAPI.updatePerson)
);
router.post(
  "/persons/:person_id/credit_records",
  safeRequestHandler(personsAPI.createCreditRecord)
);

// DEVICE BINDING
router.post("/mfa/devices", safeRequestHandler(deviceBindingAPI.createDevice));
router.get(
  "/mfa/devices/:id",
  safeRequestHandler(deviceBindingAPI.getDeviceInfo)
);
router.put(
  "/mfa/challenges/signatures/:id",
  safeRequestHandler(deviceBindingAPI.verifyDevice)
);
router.post(
  "/mfa/challenges/devices",
  safeRequestHandler(deviceBindingAPI.createDeviceChallenge)
);
router.put(
  "/mfa/challenges/devices/:id",
  safeRequestHandler(deviceBindingAPI.verifyDeviceChallenge)
);

// ACCOUNTS
router.get(
  "/accounts/:account_id/bookings",
  safeRequestHandler(accountsAPI.showAccountBookings)
);
router.get(
  "/persons/:person_id/accounts/:id",
  safeRequestHandler(accountsAPI.showPersonAccount)
);
router.get(
  "/persons/:person_id/accounts",
  safeRequestHandler(accountsAPI.showPersonAccounts)
);
router.post(
  "/persons/:person_id/accounts",
  safeRequestHandler(accountsAPI.createAccountRequestHandler)
);
router.get(
  "/accounts/:account_id/balance",
  safeRequestHandler(accountsAPI.showAccountBalance)
);
router.post(
  "/persons/:person_id/account_snapshots",
  safeRequestHandler(accountsAPI.createAccountSnapshot)
);

// OVERDRAFT
router.post(
  "/persons/:person_id/overdraft_applications",
  safeRequestHandler(ovedraftAPI.createOverdraftApplication)
);
router.get(
  "/persons/:person_id/overdraft_applications/:id",
  safeRequestHandler(ovedraftAPI.getOverdraftApplication)
);

// CARDS
router.post(
  "/persons/:person_id/accounts/:account_id/cards",
  safeRequestHandler(cardsAPI.createCardHandler)
);

router.get(
  "/accounts/:account_id/cards",
  safeRequestHandler(cardsAPI.getAccountCardsHandler)
);

router.get(
  "/cards/:card_id",
  cardsAPI.cardMiddleware,
  safeRequestHandler(cardsAPI.getCardHandler)
);

router.post(
  "/cards/:card_id/activate",
  cardsAPI.cardMiddleware,
  safeRequestHandler(cardsAPI.activateCardHandler)
);

router.post(
  "/cards/:card_id/fraud_cases/:fraud_case_id/confirm",
  cardsAPI.cardMiddleware,
  safeRequestHandler(cardsAPI.confirmFraudHandler)
);

router.post(
  "/cards/:card_id/fraud_cases/:fraud_case_id/whitelist",
  cardsAPI.cardMiddleware,
  safeRequestHandler(cardsAPI.whitelistCardHandler)
);

const REPLACE_CARD_ALLOWED_STATES = [
  CardStatus.ACTIVE,
  CardStatus.BLOCKED,
  CardStatus.BLOCKED_BY_SOLARIS
];

router.post(
  "/cards/:card_id/replace",
  cardsAPI.cardMiddleware,
  cardsAPI.cardStatusMiddleware(REPLACE_CARD_ALLOWED_STATES),
  safeRequestHandler(cardsAPI.replaceCardHandler)
);

const GET_CARD_LIMITS_CARD_ALLOWED_STATES = [
  CardStatus.INACTIVE,
  CardStatus.ACTIVATION_BLOCKED_BY_SOLARIS,
  CardStatus.ACTIVE,
  CardStatus.BLOCKED,
  CardStatus.BLOCKED_BY_SOLARIS,
  CardStatus.CLOSED,
  CardStatus.CLOSED_BY_SOLARIS
];

router.get(
  "/cards/:card_id/limits/card_present",
  cardsAPI.cardMiddleware,
  cardsAPI.cardStatusMiddleware(GET_CARD_LIMITS_CARD_ALLOWED_STATES),
  safeRequestHandler(cardsAPI.getCardPresentLimitsHandler)
);

router.get(
  "/cards/:card_id/limits/card_not_present",
  cardsAPI.cardMiddleware,
  cardsAPI.cardStatusMiddleware(GET_CARD_LIMITS_CARD_ALLOWED_STATES),
  safeRequestHandler(cardsAPI.getCardNotPresentLimitsHandler)
);

const SET_CARD_LIMITS_CARD_ALLOWED_STATES = [
  CardStatus.INACTIVE,
  CardStatus.ACTIVATION_BLOCKED_BY_SOLARIS,
  CardStatus.ACTIVE,
  CardStatus.BLOCKED,
  CardStatus.BLOCKED_BY_SOLARIS
];

router.put(
  "/cards/:card_id/limits/card_present",
  cardsAPI.cardMiddleware,
  cardsAPI.cardStatusMiddleware(SET_CARD_LIMITS_CARD_ALLOWED_STATES),
  safeRequestHandler(cardsAPI.setCardPresentLimitsHandler)
);

router.put(
  "/cards/:card_id/limits/card_not_present",
  cardsAPI.cardMiddleware,
  cardsAPI.cardStatusMiddleware(SET_CARD_LIMITS_CARD_ALLOWED_STATES),
  safeRequestHandler(cardsAPI.setCardNotPresentLimitsHandler)
);

router.get(
  "/accounts/:account_id/reservations",
  safeRequestHandler(accountsAPI.showAccountReservations)
);

router.post(
  "/cards/:card_id/block",
  cardsAPI.cardMiddleware,
  safeRequestHandler(cardsAPI.blockCardHandler)
);

router.post(
  "/cards/:card_id/unblock",
  cardsAPI.cardMiddleware,
  safeRequestHandler(cardsAPI.unblockCardHandler)
);

router.post(
  "/cards/:card_id/change_pin",
  cardsAPI.cardMiddleware,
  safeRequestHandler(cardsAPI.changePINCardHandler)
);

router.patch(
  "/cards/:card_id/settings",
  cardsAPI.cardMiddleware,
  safeRequestHandler(cardsAPI.changeCardSettingsHandler)
);

router.post(
  "/cards/:card_id/close",
  cardsAPI.cardMiddleware,
  cardsAPI.cardStatusMiddleware([
    CardStatus.INACTIVE,
    CardStatus.ACTIVE,
    CardStatus.BLOCKED
  ]),
  safeRequestHandler(cardsAPI.closeCardHandler)
);

router.post(
  "/cards/:card_id/push_provision/:wallet_type",
  cardsAPI.cardMiddleware,
  safeRequestHandler(cardsAPI.pushProvisioningHandler)
);

// VIRTUAL CARD DETAILS - in reality this endpoint should run on different server
router.post(
  "/cards/:card_id/virtual_card_requests",
  cardsAPI.cardMiddleware,
  cardsAPI.getVirtualCardDetails
);

// SEPA_DIRECT_DEBIT_RETURNS
router.get(
  "/sepa_direct_debit_returns",
  safeRequestHandler(returnNotificationsAPI.listReturnNotificationsHandler)
);

// IDENTIFICATIONS
router.get(
  "/persons/:person_id/identifications",
  middlewares.withPerson,
  safeRequestHandler(identificationsAPI.showPersonIdentifications)
);
router.post(
  "/persons/:person_id/identifications",
  safeRequestHandler(identificationsAPI.requireIdentification)
);
router.patch(
  "/persons/:person_id/identifications/:id/request",
  safeRequestHandler(identificationsAPI.patchIdentification)
);

// TAX INFORMATION
router.get(
  "/persons/:person_id/tax_identifications",
  safeRequestHandler(taxIdentificationsAPI.listTaxIdentifications)
);
router.post(
  "/persons/:person_id/tax_identifications",
  safeRequestHandler(taxIdentificationsAPI.submitTaxIdentification)
);
router.get(
  "/persons/:person_id/tax_identifications/:id",
  safeRequestHandler(taxIdentificationsAPI.showTaxIdentification)
);
router.patch(
  "/persons/:person_id/tax_identifications/:id",
  safeRequestHandler(taxIdentificationsAPI.updateTaxIdentification)
);

// TRANSACTIONS
router.post(
  "/persons/:person_id/accounts/:account_id/transactions/sepa_credit_transfer",
  safeRequestHandler(transactionsAPI.createSepaCreditTransfer)
);
router.post(
  "/persons/:person_id/accounts/:account_id/transactions/sepa_credit_transfer/:transfer_id/authorize",
  safeRequestHandler(transactionsAPI.authorizeTransaction)
);
router.post(
  "/persons/:person_id/accounts/:account_id/transactions/sepa_credit_transfer/:transfer_id/confirm",
  safeRequestHandler(transactionsAPI.confirmTransaction)
);

router.post(
  "/accounts/:account_id/transactions/sepa_direct_debit",
  safeRequestHandler(transactionsAPI.createSepaDirectDebit)
);

// STANDING ORDERS
router.get(
  "/persons/:person_id/accounts/:account_id/standing_orders/:id",
  safeRequestHandler(standingOrdersAPI.showStandingOrderRequestHandler)
);
router.post(
  "/persons/:person_id/accounts/:account_id/standing_orders",
  safeRequestHandler(standingOrdersAPI.createStandingOrderRequestHandler)
);
router.patch(
  "/persons/:person_id/accounts/:account_id/standing_orders/:id",
  safeRequestHandler(standingOrdersAPI.updateStandingOrderRequestHandler)
);
router.patch(
  "/persons/:person_id/accounts/:account_id/standing_orders/:id/cancel",
  safeRequestHandler(standingOrdersAPI.cancelStandingOrderRequestHandler)
);

// TIMED ORDERS
router.get(
  "/persons/:person_id/accounts/:account_id/timed_orders",
  safeRequestHandler(timedOrdersAPI.fetchTimedOrders)
);
router.get(
  "/persons/:person_id/accounts/:account_id/timed_orders/:id",
  safeRequestHandler(timedOrdersAPI.fetchTimedOrder)
);
router.post(
  "/persons/:person_id/accounts/:account_id/timed_orders",
  safeRequestHandler(timedOrdersAPI.createTimedOrder)
);
router.post(
  "/persons/:person_id/accounts/:account_id/timed_orders/:id/authorize",
  safeRequestHandler(timedOrdersAPI.authorizeTimedOrder)
);
router.post(
  "/persons/:person_id/accounts/:account_id/timed_orders/:id/confirm",
  safeRequestHandler(timedOrdersAPI.confirmTimedOrder)
);
router.patch(
  "/persons/:person_id/accounts/:account_id/timed_orders/:id/cancel",
  safeRequestHandler(timedOrdersAPI.cancelTimedOrder)
);

// BATCHED TRANSFERS
router.post(
  "/persons/:person_id/accounts/:account_id/transactions/sepa_credit_transfer/batches",
  safeRequestHandler(batchTransfersAPI.createBatchTransfer)
);

// ACCOUNT STATEMENTS
router.post(
  "/accounts/:account_id/statement_of_accounts",
  safeRequestHandler(accountStatementsAPI.createAccountStatement)
);
router.get(
  "/accounts/:account_id/statement_of_accounts/:statement_of_account_id/bookings",
  safeRequestHandler(accountStatementsAPI.showAccountStatementBookings)
);

// BANK STATEMENTS
router.post(
  "/accounts/:account_id/bank_statements",
  safeRequestHandler(bankStatementsAPI.createBankStatement)
);
router.get(
  "/accounts/:account_id/bank_statements/:bank_statement_id/bookings",
  safeRequestHandler(bankStatementsAPI.showBankStatementBookings)
);

// MOBILE NUMBER
router.get(
  "/persons/:person_id/mobile_number",
  safeRequestHandler(mobileNumberAPI.showMobileNumber)
);
router.post(
  "/persons/:person_id/mobile_number",
  safeRequestHandler(mobileNumberAPI.createMobileNumber)
);
router.post(
  "/persons/:person_id/mobile_number/authorize",
  safeRequestHandler(mobileNumberAPI.authorizeMobileNumber)
);
router.post(
  "/persons/:person_id/mobile_number/confirm",
  safeRequestHandler(mobileNumberAPI.confirmMobileNumber)
);
router.delete(
  "/persons/:person_id/mobile_number",
  safeRequestHandler(mobileNumberAPI.removeMobileNumber)
);

// CHANGE REQUEST
router.post(
  "/change_requests/:change_request_id/authorize",
  safeRequestHandler(changeRequestAPI.authorizeChangeRequest)
);
router.post(
  "/change_requests/:change_request_id/confirm",
  safeRequestHandler(changeRequestAPI.confirmChangeRequest)
);

// SEIZURES
router.get(
  "/persons/:person_id/seizures",
  safeRequestHandler(seizuresAPI.getSeizuresRequestHandler)
);

// E2E
if (process.env.NODE_ENV === "e2e") {
  router.patch(
    "/e2e/persons/:person_id",
    safeRequestHandler(e2eAPI.updatePerson)
  );
}

// BACKOFFICE
app.get("/__BACKOFFICE__", safeRequestHandler(backofficeAPI.listPersons));
app.post(
  "/__BACKOFFICE__/setIdentificationState/:email",
  safeRequestHandler(backofficeAPI.setIdentificationState)
);

app.get(
  "/__BACKOFFICE__/person/:email",
  safeRequestHandler(backofficeAPI.getPersonHandler)
);
app.post(
  "/__BACKOFFICE__/person/:email",
  safeRequestHandler(backofficeAPI.updatePersonHandler)
);

app.post(
  "/__BACKOFFICE__/queueBooking/:accountIdOrEmail",
  safeRequestHandler(backofficeAPI.queueBookingRequestHandler)
);
app.post(
  "/__BACKOFFICE__/processQueuedBooking/:personIdOrEmail",
  safeRequestHandler(backofficeAPI.processQueuedBookingHandler)
);
app.post(
  "/__BACKOFFICE__/processQueuedBooking/:personIdOrEmail/:id",
  safeRequestHandler(backofficeAPI.processQueuedBookingHandler)
);
app.post(
  "/__BACKOFFICE__/updateAccountLockingStatus/:personId",
  safeRequestHandler(backofficeAPI.updateAccountLockingStatusHandler)
);

// BACKOFFICE - CARDS
app.get(
  "/__BACKOFFICE__/person/:email/cards",
  safeRequestHandler(backofficeAPI.listPersonsCards)
);

app.post(
  "/__BACKOFFICE__/changeCardStatus",
  safeRequestHandler(backofficeAPI.changeCardStatusHandler)
);

app.post(
  "/__BACKOFFICE__/person/:person_id/reservations",
  safeRequestHandler(backofficeAPI.createReservationHandler)
);

app.post(
  "/__BACKOFFICE__/person/:person_id/reservations/:id",
  safeRequestHandler(backofficeAPI.updateReservationHandler)
);

// BACKOFFICE - STANDING ORDERS
app.post(
  "/__BACKOFFICE__/triggerStandingOrder/:personId/:standingOrderId",
  safeRequestHandler(standingOrdersAPI.triggerStandingOrderRequestHandler)
);

// BACKOFFICE - SEIZURES
app.post(
  "/__BACKOFFICE__/createSeizure/:person_id",
  safeRequestHandler(seizuresAPI.createSeizureRequestHandler)
);
app.post(
  "/__BACKOFFICE__/deleteSeizure/:person_id",
  safeRequestHandler(seizuresAPI.deleteSeizureRequestHandler)
);
app.post(
  "/__BACKOFFICE__/fulfillSeizure/:person_id",
  safeRequestHandler(seizuresAPI.fulfillSeizureRequestHandler)
);

// BACKOFFICE - TIMED ORDERS
app.post(
  "/__BACKOFFICE__/triggerTimedOrder/:person_id/:timed_order_id",
  safeRequestHandler(async (req, res) => {
    const { person_id: personId, timed_order_id: timedOrderId } = req.params;
    await timedOrdersAPI.triggerTimedOrder(personId, timedOrderId);
    res.redirect("back");
  })
);
app.post(
  "/__BACKOFFICE__/processTimedOrders/:person_id",
  safeRequestHandler(async (req, res) => {
    await timedOrdersAPI.processTimedOrders(req.params.person_id);
    res.redirect("back");
  })
);

// WEBHOOKS
router.get(
  "/webhooks",
  checkRequestHostHeader,
  safeRequestHandler(webhooksAPI.indexWebhooksHandler)
);
router.post(
  "/webhooks",
  checkRequestHostHeader,
  safeRequestHandler(webhooksAPI.createWebhookHandler)
);

// HEALTH CHECK
app.get("/health", (req, res) => {
  res.status(200).send("there is no piwo tracker!");
});

// REST
app.get("*", (req, res) => {
  res.status(404).send("Not found");
});

export default app;

export const serve = async port => {
  await migrate();

  return new Promise((resolve, reject) => {
    app.listen(port, () => {
      log.debug(`mocksolaris listening on http://localhost:${port}/!`);
      resolve();
    });
  });
};
