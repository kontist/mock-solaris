import express, { Router } from "express";
import bodyParser from "body-parser";
import swig from "swig";
import path from "path";
import multer from "multer";

import * as log from "./logger";
import * as oauthAPI from "./routes/oauth";
import * as personsAPI from "./routes/persons";
import * as businessesAPI from "./routes/business";
import * as deviceBindingAPI from "./routes/deviceBinding";
import * as standingOrdersAPI from "./routes/standingOrders";
import * as accountsAPI from "./routes/accounts";
import * as identificationsAPI from "./routes/identifications";
import * as taxIdentificationsAPI from "./routes/taxIdentifications";
import * as transactionsAPI from "./routes/transactions";
import * as webhooksAPI from "./routes/webhooks";
import * as backofficeAPI from "./routes/backoffice";
import * as bankStatementsAPI from "./routes/bankStatements";
import * as mobileNumberAPI from "./routes/mobileNumber";
import * as changeRequestAPI from "./routes/changeRequest";
import * as returnNotificationsAPI from "./routes/sepaDirectDebitReturns";
import * as seizuresAPI from "./routes/seizures";
import * as deviceMonitoringAPI from "./routes/deviceMonitoring";
import * as timedOrdersAPI from "./routes/timedOrders";
import * as batchTransfersAPI from "./routes/batchTransfers";
import * as cardsAPI from "./routes/cards";
import * as e2eAPI from "./routes/e2e";
import * as middlewares from "./helpers/middlewares";
import * as overdraftAPI from "./routes/overdraft";
import * as termsAPI from "./routes/termsAndConditions";
import * as psd2API from "./routes/psd2";
import * as postboxItemAPI from "./routes/postbox";
import * as topUpsAPI from "./routes/topUps";
import * as instantCreditTransferAPI from "./routes/instantCreditTransfer";
import * as accountOpeningRequestAPI from "./routes/accountOpeningRequest";

import { migrate } from "./db";

import { oauthTokenAuthenticationMiddleware } from "./helpers/oauth";
import { safeRequestHandler } from "./helpers/safeRequestHandler";
import { shouldReturnJSON } from "./helpers";
import { CardStatus } from "./helpers/types";
import { createStripeCustomerIfNotExistsMiddleware } from "./helpers/stripe";
import * as questionsAPI from "./routes/questions";
import { find } from "./routes/commercialRegistrations/find";
import { search } from "./routes/commercialRegistrations/search";

const app = express();
const fileUpload = multer();

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

const router = Router();

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
app.set("json spaces", 2);
app.use("/v1", router);
app.post("/oauth/token", oauthAPI.generateToken);
app.post("/oauth2/token", oauthAPI.generateOAuth2Token);

function errorHandler(err, req, res, next) {
  log.error(err, {
    personId: req.person?.id,
    ...(req.body || {}),
  });

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
router.post(
  "/persons/:person_id/settings",
  safeRequestHandler(personsAPI.createSettings)
);
router.post(
  "/persons/:person_id/documents",
  middlewares.withPerson,
  fileUpload.single("file"),
  safeRequestHandler(personsAPI.postDocument)
);

router.get(
  "/question_set/:question_set_id",
  safeRequestHandler(questionsAPI.listQuestions)
);
router.patch(
  "/question_set/:question_set_id/questions/:question_id/answer",
  safeRequestHandler(questionsAPI.answerQuestion)
);

// DEVICE BINDING
router.post("/mfa/devices", safeRequestHandler(deviceBindingAPI.createDevice));
router.get("/mfa/devices", safeRequestHandler(deviceBindingAPI.getDevices));
router.get(
  "/mfa/devices/:id",
  safeRequestHandler(deviceBindingAPI.getDeviceInfo)
);
router.delete(
  "/mfa/devices/:id",
  safeRequestHandler(deviceBindingAPI.deleteDevice)
);

router.get(
  "/mfa/devices/:id/keys",
  safeRequestHandler(deviceBindingAPI.listDeviceKeys)
);
router.post(
  "/mfa/devices/:id/keys",
  safeRequestHandler(deviceBindingAPI.addDeviceKey)
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
router.post(
  "/persons/:person_id/account_snapshots",
  safeRequestHandler(accountsAPI.createAccountSnapshot)
);
router.get(
  "/accounts/:account_id/balance",
  safeRequestHandler(accountsAPI.showAccountBalance)
);

router.get(
  "/accounts/:account_id/average_daily_balance",
  safeRequestHandler(accountsAPI.showAverageDailyAccountBalance)
);

// PSD2
router.get(
  "/psd2/challenges/:challenge_id",
  safeRequestHandler(psd2API.verifyChallengeId)
);

router.patch(
  "/psd2/challenges/:challenge_id",
  safeRequestHandler(psd2API.patchChallengeId)
);

// OVERDRAFT
router.post(
  "/persons/:person_id/overdraft_applications",
  safeRequestHandler(overdraftAPI.createOverdraftApplication)
);
router.get(
  "/persons/:person_id/overdraft_applications/:id",
  safeRequestHandler(overdraftAPI.getOverdraftApplication)
);
router.put(
  "/persons/:person_id/overdraft_applications/:id/account_snapshot",
  safeRequestHandler(overdraftAPI.linkOverdraftApplicationSnapshot)
);
router.put(
  "/persons/:person_id/overdraft_applications/:id/overdraft",
  safeRequestHandler(overdraftAPI.createOverdraft)
);

router.post(
  "/persons/:person_id/overdrafts/:overdraft_id/terminate",
  safeRequestHandler(overdraftAPI.terminateOverdraft)
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
  CardStatus.BLOCKED_BY_SOLARIS,
];

router.post(
  "/cards/:card_id/replace",
  cardsAPI.cardMiddleware,
  cardsAPI.cardStatusMiddleware(REPLACE_CARD_ALLOWED_STATES),
  safeRequestHandler(cardsAPI.replaceCardHandler)
);

router.get(
  "/cards/:card_id/pin_keys/latest",
  cardsAPI.cardMiddleware,
  safeRequestHandler(cardsAPI.getCardLatestPINKeyHandler)
);

router.post(
  "/cards/:card_id/pin_update_requests",
  cardsAPI.cardMiddleware,
  safeRequestHandler(cardsAPI.createCardPINUpdateRequestHandler)
);

router.delete(
  "/card_controls/spending_limits/:id",
  safeRequestHandler(cardsAPI.deleteCardSpendingLimitsHandler)
);

router.post(
  "/card_controls/spending_limits",
  safeRequestHandler(cardsAPI.createCardSpendingLimitsHandler)
);

router.get(
  "/card_controls/spending_limits",
  safeRequestHandler(cardsAPI.indexCardSpendingLimitsHandler)
);

router.post(
  "/cards/:card_id/sca_pin_update_requests",
  cardsAPI.cardMiddleware,
  safeRequestHandler(cardsAPI.changeCardPINWithChangeRequestHandler)
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

router.post(
  "/cards/:card_id/close",
  cardsAPI.cardMiddleware,
  cardsAPI.cardStatusMiddleware([
    CardStatus.INACTIVE,
    CardStatus.ACTIVE,
    CardStatus.BLOCKED,
  ]),
  safeRequestHandler(cardsAPI.closeCardHandler)
);

router.post(
  "/cards/:card_id/sca_push_provision/:wallet_type",
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

// DEVICE MONITORING
router.post(
  "/persons/:person_id/device_consents",
  middlewares.withPerson,
  safeRequestHandler(deviceMonitoringAPI.createDeviceConsent)
);

router.patch(
  "/persons/:person_id/device_consents/:device_consent_id",
  middlewares.withPerson,
  safeRequestHandler(deviceMonitoringAPI.updateDeviceConsent)
);

router.post(
  "/persons/:person_id/device_activities",
  middlewares.withPerson,
  safeRequestHandler(deviceMonitoringAPI.createUserActivity)
);

// TERMS AND CONDITIONS
router.post(
  "/terms_and_conditions_events",
  safeRequestHandler(termsAPI.createTermsAndConditionsEvent)
);

// POSTBOX ITEM
router.get(
  "/persons/:person_id/postbox/items",
  safeRequestHandler(postboxItemAPI.listPostboxItems)
);

router.get(
  "/postbox/items/:postbox_item_id",
  safeRequestHandler(postboxItemAPI.getPostboxItem)
);

router.get(
  "/postbox/items/:postbox_item_id/document",
  safeRequestHandler(postboxItemAPI.downloadPostboxItem)
);

// SEPA DIRECT DEBIT REFUND
router.post(
  "/persons/:person_id/accounts/:account_id/sepa_direct_debit_returns",
  safeRequestHandler(transactionsAPI.directDebitRefund)
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
app.get(
  "/__BACKOFFICE__/businesses",
  safeRequestHandler(backofficeAPI.listBusinesses)
);

app.get(
  "/__BACKOFFICE__/webhooks",
  safeRequestHandler(backofficeAPI.listWebhooks)
);

app.post(
  "/__BACKOFFICE__/setIdentificationState/:personId/:identificationId",
  safeRequestHandler(backofficeAPI.setIdentificationState)
);
app.post(
  "/__BACKOFFICE__/setIdentification/:id",
  safeRequestHandler(backofficeAPI.setIdentification)
);

app.post(
  "/__BACKOFFICE__/setScreening/:email",
  safeRequestHandler(backofficeAPI.setScreening)
);

app.get(
  "/__BACKOFFICE__/person/:id",
  safeRequestHandler(backofficeAPI.getPersonHandler)
);

app.get(
  "/__BACKOFFICE__/business/:id",
  safeRequestHandler(backofficeAPI.getBusinessHandler)
);

app.delete(
  "/__BACKOFFICE__/person/:id",
  safeRequestHandler(personsAPI.deletePerson)
);

app.post(
  "/__BACKOFFICE__/person/:id",
  safeRequestHandler(backofficeAPI.updatePersonHandler)
);

app.post(
  "/__BACKOFFICE__/business/:id",
  safeRequestHandler(backofficeAPI.updateBusinessHandler)
);

app.post(
  "/__BACKOFFICE__/updateOrigin/:id",
  safeRequestHandler(backofficeAPI.updateOrigin)
);

app.post(
  "/__BACKOFFICE__/queueBooking/:personId",
  safeRequestHandler(backofficeAPI.queueBookingRequestHandler)
);
app.post(
  "/__BACKOFFICE__/processQueuedBooking/:personId",
  safeRequestHandler(backofficeAPI.processQueuedBookingHandler)
);
app.post(
  "/__BACKOFFICE__/processQueuedBooking/:personId/:id",
  safeRequestHandler(backofficeAPI.processQueuedBookingHandler)
);
app.post(
  "/__BACKOFFICE__/createDirectDebitReturn/:personId/:id",
  safeRequestHandler(backofficeAPI.createDirectDebitReturnHandler)
);
app.post(
  "/__BACKOFFICE__/updateAccountLockingStatus/:personId",
  safeRequestHandler(backofficeAPI.updateAccountLockingStatusHandler)
);
app.post(
  "/__BACKOFFICE__/setTaxIdentifications/:personId",
  safeRequestHandler(backofficeAPI.saveTaxIdentificationsHandler)
);
app.post(
  "/__BACKOFFICE__/account/:person_id/setMockBalance",
  safeRequestHandler(accountsAPI.setMockBalance)
);

// BACKOFFICE - CARDS
app.get(
  "/__BACKOFFICE__/person/:id/cards",
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

app.post(
  "/__BACKOFFICE__/:personId/:cardId/createProvisioningToken",
  safeRequestHandler(backofficeAPI.provisioningTokenHandler)
);

app.post(
  "/__BACKOFFICE__/:personId/:cardId/updateProvisioningToken",
  safeRequestHandler(backofficeAPI.provisioningTokenHandler)
);

// BACKOFFICE - STANDING ORDERS
app.post(
  "/__BACKOFFICE__/triggerStandingOrder/:personId/:standingOrderId",
  safeRequestHandler(standingOrdersAPI.triggerStandingOrderRequestHandler)
);

// BACKOFFICE - SEIZURES PROTECTION
app.post(
  "/__BACKOFFICE__/addAccountSeizureProtection/:email",
  safeRequestHandler(backofficeAPI.addAccountSeizureProtectionHandler)
);
app.post(
  "/__BACKOFFICE__/deleteAccountSeizureProtection/:email",
  safeRequestHandler(backofficeAPI.deleteAccountSeizureProtectionHandler)
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

// BACKOFFICE - OVERDRAFT

app.post(
  "/__BACKOFFICE__/changeOverdraftApplicationStatus",
  safeRequestHandler(backofficeAPI.changeOverdraftApplicationStatusHandler)
);
app.post(
  "/__BACKOFFICE__/issueInterestAccruedBooking/:person_id",
  safeRequestHandler(backofficeAPI.issueInterestAccruedBookingHandler)
);

// BACKOFFICE - POSTBOX ITEM
app.post(
  "/__BACKOFFICE__/createPostboxItem/:person_id",
  safeRequestHandler(postboxItemAPI.createPostboxItemRequestHandler)
);

// BACKOFFICE - DEVICES
app.post(
  "/__BACKOFFICE__/deleteDevice/:person_id/:device_id",
  safeRequestHandler(backofficeAPI.deleteDeviceRequestHandler)
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
router.delete(
  "/webhooks/:webhookType",
  checkRequestHostHeader,
  safeRequestHandler(webhooksAPI.deleteWebhookHandler)
);

// TOP UPS
router.post(
  "/persons/:personId/accounts/:accountId/topups",
  middlewares.withPerson,
  middlewares.withAccount,
  createStripeCustomerIfNotExistsMiddleware,
  safeRequestHandler(topUpsAPI.createTopUp)
);
router.get(
  "/persons/:personId/accounts/:accountId/topups",
  middlewares.withPerson,
  middlewares.withAccount,
  createStripeCustomerIfNotExistsMiddleware,
  safeRequestHandler(topUpsAPI.listTopUps)
);
router.get(
  "/persons/:personId/accounts/:accountId/topups/:topupId",
  middlewares.withPerson,
  middlewares.withAccount,
  createStripeCustomerIfNotExistsMiddleware,
  safeRequestHandler(topUpsAPI.retrieveTopUp)
);
router.get(
  "/persons/:personId/topups/payment_methods",
  middlewares.withPerson,
  createStripeCustomerIfNotExistsMiddleware,
  safeRequestHandler(topUpsAPI.listPaymentMethods)
);
router.delete(
  "/persons/:personId/topups/payment_methods/:paymentMethodId",
  middlewares.withPerson,
  safeRequestHandler(topUpsAPI.deletePaymentMethod)
);
router.post(
  "/persons/:personId/accounts/:accountId/topups/:topUpId/cancel",
  middlewares.withPerson,
  middlewares.withAccount,
  safeRequestHandler(topUpsAPI.cancelTopUp)
);

// SEPA INSTANT CREDIT TRANSFERS

router.get(
  "/sepa_instant_reachability/:iban",
  safeRequestHandler(instantCreditTransferAPI.getInstantReachability)
);
router.post(
  "/accounts/:accountId/transactions/sepa_instant_credit_transfers",
  safeRequestHandler(instantCreditTransferAPI.createInstantCreditTransfer)
);

// ACCOUNT OPENING REQUEST

router.post(
  "/accounts/opening_requests",
  safeRequestHandler(accountOpeningRequestAPI.createAccountOpeningRequest)
);
router.get(
  "/accounts/opening_requests/:id",
  safeRequestHandler(accountOpeningRequestAPI.retrieveAccountOpeningRequest)
);

// BUSINESSES

router.post("/businesses", safeRequestHandler(businessesAPI.createBusiness));
router.get(
  "/businesses/:business_id",
  safeRequestHandler(businessesAPI.showBusiness)
);
router.get("/businesses", safeRequestHandler(businessesAPI.showBusinesses));
router.patch(
  "/businesses/:business_id",
  safeRequestHandler(businessesAPI.updateBusiness)
);

router.post(
  "/businesses/:business_id/documents",
  fileUpload.single("file"),
  safeRequestHandler(businessesAPI.postDocument)
);

// COMMERCIAL REGISTRATIONS

router.get(
  "/commercial_registrations/search_by_name",
  safeRequestHandler(search)
);

router.get("/commercial_registrations/find", safeRequestHandler(find));

app.post(
  "/__BACKOFFICE__/createMaps",
  safeRequestHandler(backofficeAPI.createMaps)
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

export const serve = async (port) => {
  await migrate();

  return new Promise((resolve, reject) => {
    app.listen(port, () => {
      log.debug(`mocksolaris listening on http://localhost:${port}/!`);
      resolve(null);
    });
  });
};
