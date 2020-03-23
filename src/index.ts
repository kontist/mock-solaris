import { serve } from "./app";
import * as db from "./db";
import * as account from "./routes/accounts";
import * as backOffice from "./routes/backoffice";
import * as standingOrders from "./routes/standingOrders";
import { changeCardStatus } from "./helpers/cards";
import { processTimedOrders } from "./routes/timedOrders";
import * as logger from "./logger";
import { createSeizure } from "./routes/seizures";
import * as reservations from "./helpers/reservations";
import { createCreditPresentment } from "./helpers/creditPresentment";
import { generateSolarisWebhookSignature } from "./helpers/solarisWebhookSignature";
import * as webhooks from "./helpers/webhooks";
import fraudWatchdog from "./helpers/fraudWatchdog";
import { changeOverdraftApplicationStatus } from "./helpers/overdraft";

export default {
  serve,
  logger,
  flushDb: db.flushDb,
  getPerson: db.getPerson,
  getAllPersons: db.getAllPersons,
  savePerson: db.savePerson,
  migrate: db.migrate,
  findPersonByAccountId: db.findPersonByAccountId,
  saveBooking: db.saveBooking,
  createAccount: account.createAccount,
  updateAccountLockingStatus: backOffice.updateAccountLockingStatus,
  saveMobileNumber: db.saveMobileNumber,
  deleteMobileNumber: db.deleteMobileNumber,
  saveTaxIdentifications: db.saveTaxIdentifications,
  getTechnicalUserPerson: db.getTechnicalUserPerson,
  processQueuedBooking: backOffice.processQueuedBooking,
  createStandingOrder: standingOrders.createStandingOrder,
  confirmStandingOrderCreation: standingOrders.confirmStandingOrderCreation,
  cancelStandingOrder: standingOrders.cancelStandingOrder,
  confirmStandingOrderCancelation:
    standingOrders.confirmStandingOrderCancelation,
  getSmsToken: db.getSmsToken,
  processTimedOrders,
  createSeizure,
  changeCardStatus,
  getCard: db.getCard,
  getCardData: db.getCardData,
  createReservation: reservations.createReservation,
  updateReservation: reservations.updateReservation,
  createCreditPresentment,
  webhooks,
  fraudWatchdog,
  generateSolarisWebhookSignature,
  changeOverdraftApplicationStatus
};
