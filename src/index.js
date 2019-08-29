import { serve } from "./app";
import * as db from "./db";
import * as account from "./routes/accounts";
import * as backOffice from "./routes/backoffice";
import * as standingOrders from "./routes/standingOrders";
import { processTimedOrders } from "./routes/timedOrders";
import * as logger from "./logger";

module.exports = {
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
  processTimedOrders
};
