import express, { Router } from "express";
import bodyParser from "body-parser";
import swig from "swig";
import path from "path";

import * as log from "./logger";
import * as oauthAPI from "./routes/oauth";
import * as personsAPI from "./routes/persons";
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
import * as e2eAPI from "./routes/e2e";

import { migrate } from "./db";

import { oauthTokenAuthenticationMiddleware } from "./helpers/oauth";
import { safeRequestHandler } from "./helpers/safeRequestHandler";
import { shouldReturnJSON } from "./helpers";
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

    console.log("---> ", req.path, ">>", body, "<<");

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

// SEPA_DIRECT_DEBIT_RETURNS
router.get(
  "/sepa_direct_debit_returns",
  safeRequestHandler(returnNotificationsAPI.listReturnNotificationsHandler)
);

// IDENTIFICATIONS
router.get(
  "/persons/:person_id/identifications",
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
  safeRequestHandler(webhooksAPI.indexWebhooks)
);
router.post(
  "/webhooks",
  checkRequestHostHeader,
  safeRequestHandler(webhooksAPI.createWebhook)
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
      console.log(`mocksolaris listening on http://localhost:${port}/!`);
      resolve();
    });
  });
};
