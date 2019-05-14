var app = require('./app');
var db = require('./db');
var account = require('./routes/accounts');
var backOffice = require('./routes/backoffice');
var standingOrders = require('./routes/standingOrders');

module.exports = {
  serve: app.serve,
  flushDb: db.flushDb,
  getPerson: db.getPerson,
  getAllPersons: db.getAllPersons,
  savePerson: db.savePerson,
  migrate: db.migrate,
  findPersonByAccountId: db.findPersonByAccountId,
  saveBooking: db.saveBooking,
  getReservationsForAccount: db.getReservationsForAccount,
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
  confirmStandingOrderCancelation: standingOrders.confirmStandingOrderCancelation
};
