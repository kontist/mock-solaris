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
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.issueInterestAccruedBookingHandler = exports.changeOverdraftApplicationStatusHandler = exports.updateReservationHandler = exports.createReservationHandler = exports.changeCardStatusHandler = exports.updateAccountLockingStatusHandler = exports.updateAccountLockingStatus = exports.queueBookingRequestHandler = exports.findPersonByIdOrEmail = exports.generateBookingForPerson = exports.processQueuedBooking = exports.processQueuedBookingHandler = exports.displayBackofficeOverview = exports.setIdentificationState = exports.updatePersonHandler = exports.getPersonHandler = exports.listPersonsCards = exports.listPersons = exports.findIdentificationByEmail = exports.provisioningTokenHandler = exports.triggerBookingsWebhook = void 0;
const lodash_1 = __importDefault(require("lodash"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const moment_1 = __importDefault(require("moment"));
const node_uuid_1 = __importDefault(require("node-uuid"));
const http_status_1 = __importDefault(require("http-status"));
const db_1 = require("../db");
const sepaDirectDebitReturn_1 = require("../helpers/sepaDirectDebitReturn");
const helpers_1 = require("../helpers");
const webhooks_1 = require("../helpers/webhooks");
const seizures_1 = require("./seizures");
const log = __importStar(require("../logger"));
const cards_1 = require("../helpers/cards");
const reservations_1 = require("../helpers/reservations");
const creditPresentment_1 = require("../helpers/creditPresentment");
const types_1 = require("../helpers/types");
const overdraft_1 = require("../helpers/overdraft");
const triggerIdentificationWebhook = (payload) => webhooks_1.triggerWebhook(types_1.PersonWebhookEvent.IDENTIFICATION, payload);
const triggerAccountBlockWebhook = async (person) => {
    const { iban, id: accountId, locking_status: lockingStatus } = person.account;
    const payload = {
        account_id: accountId,
        person_id: person.id,
        business_id: null,
        locking_status: lockingStatus,
        updated_at: new Date().toISOString(),
        iban,
    };
    await webhooks_1.triggerWebhook(types_1.AccountWebhookEvent.ACCOUNT_BLOCK, payload);
};
exports.triggerBookingsWebhook = async (solarisAccountId) => {
    const payload = { account_id: solarisAccountId };
    await webhooks_1.triggerWebhook(types_1.TransactionWebhookEvent.BOOKING, payload);
};
/**
 * Handles changes on the provisioning token and redirects back to refresh data.
 * Reads the personId and cardId from the url params and the status (if sent) from the body.
 * @param req {Express.Request}
 * @param res {Express.Response}
 */
exports.provisioningTokenHandler = async (req, res) => {
    const { personId, cardId } = req.params;
    const { status } = req.body;
    await cards_1.upsertProvisioningToken(personId, cardId, status);
    res.redirect("back");
};
const filterAndSortIdentifications = (identifications, method) => {
    const idents = identifications
        .filter((identification) => identification.identificationLinkCreatedAt)
        .sort((id1, id2) => new Date(id2.identificationLinkCreatedAt).getTime() -
        new Date(id1.identificationLinkCreatedAt).getTime());
    if (method) {
        return idents.filter((identification) => identification.method === method);
    }
    return idents;
};
exports.findIdentificationByEmail = (email, method) => {
    return db_1.getAllIdentifications().then((identifications) => {
        const userIdentifications = identifications.filter((identification) => identification.email === email);
        const latestIdentification = filterAndSortIdentifications(userIdentifications, method)[0];
        log.info("latestIdentification", latestIdentification);
        return latestIdentification;
    });
};
exports.listPersons = async (req, res) => {
    const persons = await db_1.getAllPersons();
    res.render("persons", { persons });
};
exports.listPersonsCards = async (req, res) => {
    const person = await db_1.findPersonByEmail(req.params.email);
    res.render("cards", { person });
};
exports.getPersonHandler = async (req, res) => {
    const person = await db_1.findPersonByEmail(req.params.email);
    if (!person) {
        return res.status(http_status_1.default.NOT_FOUND).send({
            message: "Couldn't find person",
            details: req.params,
        });
    }
    const mobileNumber = await db_1.getMobileNumber(person.id);
    const taxIdentifications = await db_1.getTaxIdentifications(person.id);
    const devices = await db_1.getDevicesByPersonId(person.id);
    if (helpers_1.shouldReturnJSON(req)) {
        res.send(person);
    }
    else {
        res.render("person", {
            person,
            mobileNumber,
            taxIdentifications,
            devices,
            identifications: person.identifications,
            SEIZURE_STATUSES: seizures_1.SEIZURE_STATUSES,
        });
    }
};
exports.updatePersonHandler = async (req, res) => {
    const person = await db_1.findPersonByEmail(req.params.email);
    Object.keys(req.body).forEach((key) => {
        person[key] = req.body[key];
    });
    person.address = person.address || {};
    person.address.line_1 = req.body.line_1;
    person.address.line_2 = req.body.line_2;
    person.address.postal_code = req.body.postal_code;
    person.address.city = req.body.city;
    person.address.country = req.body.country;
    if (person.fatca_relevant === "null") {
        person.fatca_relevant = null;
    }
    else if (person.fatca_relevant === "true") {
        person.fatca_relevant = true;
    }
    else if (person.fatca_relevant === "false") {
        person.fatca_relevant = false;
    }
    if (!req.body.mobile_number) {
        await db_1.deleteMobileNumber(person.id);
    }
    await db_1.savePerson(person);
    res.redirect(`/__BACKOFFICE__/person/${person.email}`);
};
const shouldMarkMobileNumberAsVerified = (identification) => [
    types_1.IdentificationStatus.PENDING_SUCCESSFUL,
    types_1.IdentificationStatus.SUCCESSFUL,
].includes(identification.status) && identification.method === "idnow";
exports.setIdentificationState = async (req, res) => {
    const { status } = req.body;
    log.info("setIdentificationState body", req.body);
    log.info("setIdentificationState params", req.params);
    const { method = "idnow" } = req.query;
    const identification = await exports.findIdentificationByEmail(req.params.email, method);
    if (!identification) {
        return res.status(404).send("Couldnt find identification");
    }
    const person = await db_1.getPerson(identification.person_id);
    identification.status = status;
    person.identifications[identification.id] = identification;
    await db_1.savePerson(person);
    if (shouldMarkMobileNumberAsVerified(identification)) {
        const mobileNumber = await db_1.getMobileNumber(identification.person_id);
        if (mobileNumber) {
            mobileNumber.verified = true;
            await db_1.saveMobileNumber(identification.person_id, mobileNumber);
        }
    }
    await triggerIdentificationWebhook({
        id: identification.id,
        url: identification.url,
        person_id: identification.person_id,
        completed_at: identification.completed_at,
        reference: identification.reference,
        method,
        status,
    });
    res.redirect(`/__BACKOFFICE__/person/${req.params.email}#identifications`);
};
exports.displayBackofficeOverview = (req, res) => {
    db_1.getAllPersons().then((persons) => {
        res.render("overview", { persons });
    });
};
exports.processQueuedBookingHandler = async (req, res) => {
    const { personIdOrEmail, id } = req.params;
    await exports.processQueuedBooking(personIdOrEmail, id);
    res.redirect("back");
};
const generateBookingFromStandingOrder = (standingOrder) => {
    return {
        ...standingOrder,
        id: node_uuid_1.default.v4(),
        valuta_date: moment_1.default().format("YYYY-MM-DD"),
        booking_date: moment_1.default().format("YYYY-MM-DD"),
        booking_type: types_1.BookingType.SEPA_CREDIT_TRANSFER,
        amount: {
            value: -Math.abs(standingOrder.amount.value),
        },
    };
};
/**
 * Processes either a normal booking or a Standing Order.
 * @param {string} personIdOrEmail
 * @param {number} id Booking ID
 * @param {Boolean} isStandingOrder (Optional) True if is of type standing order.
 */
exports.processQueuedBooking = async (personIdOrEmail, id, isStandingOrder = false) => {
    let findPerson = () => db_1.getPerson(personIdOrEmail);
    if (personIdOrEmail.includes("@")) {
        findPerson = () => db_1.findPersonByEmail(personIdOrEmail);
    }
    const person = await findPerson();
    person.transactions = person.transactions || [];
    let bookings;
    bookings = isStandingOrder
        ? person.standingOrders || []
        : person.queuedBookings;
    let booking;
    if (id) {
        const findQueuedBooking = (queuedBooking) => queuedBooking.id === id;
        booking = bookings.find(findQueuedBooking);
        // Standing orders are not removed until cancelled or expired.
        if (!isStandingOrder) {
            lodash_1.default.remove(bookings, findQueuedBooking);
        }
    }
    else {
        booking = bookings.shift();
    }
    if (isStandingOrder) {
        booking = generateBookingFromStandingOrder(booking);
    }
    const allPersons = await db_1.getAllPersons();
    const receiver = allPersons
        .filter((dbPerson) => dbPerson.account)
        .find((dbPerson) => dbPerson.account.iban === booking.recipient_iban);
    const isDirectDebit = [
        types_1.BookingType.DIRECT_DEBIT,
        types_1.BookingType.SEPA_DIRECT_DEBIT,
    ].includes(booking.booking_type);
    const wouldOverdraw = person.account.available_balance.value < booking.amount.value;
    let directDebitReturn;
    let sepaDirectDebitReturn;
    if (isDirectDebit) {
        if (wouldOverdraw) {
            directDebitReturn = {
                ...booking,
                sender_iban: booking.recipient_iban,
                recipient_iban: booking.sender_iban,
                sender_name: booking.recipient_name,
                recipient_name: booking.sender_name,
                sender_bic: booking.recipient_bic,
                recipient_bic: booking.sender_bic,
                id: booking.id.split("-").reverse().join("-"),
                booking_type: types_1.BookingType.SEPA_DIRECT_DEBIT_RETURN,
                amount: {
                    value: booking.amount.value,
                    unit: "cents",
                    currency: "EUR",
                },
            };
        }
        // direct debits come with a negative value
        booking.amount.value = -Math.abs(booking.amount.value);
    }
    person.transactions.push(booking);
    if (directDebitReturn) {
        person.transactions.push(directDebitReturn);
        sepaDirectDebitReturn = sepaDirectDebitReturn_1.createSepaDirectDebitReturn(person, directDebitReturn);
        await db_1.saveSepaDirectDebitReturn(sepaDirectDebitReturn);
        if (directDebitReturn.recipient_iban === process.env.WIRECARD_IBAN) {
            const issueDDRurl = `${process.env.MOCKWIRECARD_BASE_URL}/__BACKOFFICE__/customer/${person.email}/issue_ddr`;
            log.info("processQueuedBooking() Creating Direct Debit Return on Wirecard", {
                issueDDRurl,
                amount: directDebitReturn.amount.value,
            });
            await node_fetch_1.default(issueDDRurl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: `amount=${directDebitReturn.amount.value}`,
            });
        }
    }
    if (receiver) {
        const receiverPerson = await db_1.getPerson(receiver.id);
        receiverPerson.transactions.push(booking);
        if (directDebitReturn) {
            receiverPerson.transactions.push(directDebitReturn);
        }
        await db_1.savePerson(receiverPerson);
    }
    await db_1.savePerson(person);
    await exports.triggerBookingsWebhook(person.account.id);
    if (sepaDirectDebitReturn) {
        await sepaDirectDebitReturn_1.triggerSepaDirectDebitReturnWebhook(sepaDirectDebitReturn);
    }
    return booking;
};
exports.generateBookingForPerson = (bookingData) => {
    const { person, purpose, amount, senderName, endToEndId, bookingType, iban, transactionId, bookingDate, valutaDate, status, } = bookingData;
    const recipientName = `${person.salutation} ${person.first_name} ${person.last_name}`;
    const recipientIBAN = person.account.iban;
    const recipientBIC = person.account.bic;
    const senderIBAN = iban || "ES3183888553310516236778";
    const senderBIC = process.env.SOLARIS_BIC;
    const today = moment_1.default().format("YYYY-MM-DD");
    return {
        id: node_uuid_1.default.v4(),
        amount: { value: parseInt(amount, 10) },
        valuta_date: valutaDate ? moment_1.default(valutaDate).format("YYYY-MM-DD") : today,
        description: purpose,
        booking_date: bookingDate
            ? moment_1.default(bookingDate).format("YYYY-MM-DD")
            : today,
        name: `mocksolaris-transaction-${purpose}`,
        recipient_bic: recipientBIC,
        recipient_iban: recipientIBAN,
        recipient_name: recipientName,
        sender_bic: senderBIC,
        sender_iban: senderIBAN,
        sender_name: senderName || "mocksolaris",
        end_to_end_id: endToEndId,
        booking_type: bookingType,
        transaction_id: transactionId || null,
        status,
    };
};
/**
 * Returns a Person object by either person ID or email.
 * @param {String} personIdOrEmail
 */
exports.findPersonByIdOrEmail = async (personIdOrEmail) => {
    let findPerson = () => db_1.getPerson(personIdOrEmail);
    if (personIdOrEmail.includes("@")) {
        findPerson = () => db_1.findPersonByEmail(personIdOrEmail);
    }
    return findPerson();
};
exports.queueBookingRequestHandler = async (req, res) => {
    const { accountIdOrEmail } = req.params;
    let findPerson = () => db_1.findPersonByAccountId(accountIdOrEmail);
    if (accountIdOrEmail.includes("@")) {
        findPerson = () => db_1.findPersonByEmail(accountIdOrEmail);
    }
    log.info("queueBookingRequestHandler()", "req.body", JSON.stringify(req.body), "req.params", JSON.stringify(req.params));
    let { amount, purpose, senderName } = req.body;
    const { endToEndId, hasFutureValutaDate, bookingType, iban, transactionId, bookingDate, valutaDate, status, } = req.body;
    senderName = senderName || "mocksolaris";
    purpose = purpose || "";
    amount = amount ? parseInt(amount, 10) : Math.round(Math.random() * 10000);
    const person = await findPerson();
    const queuedBooking = exports.generateBookingForPerson({
        person,
        purpose,
        amount,
        senderName,
        endToEndId,
        hasFutureValutaDate,
        bookingType,
        iban,
        transactionId,
        bookingDate,
        valutaDate,
        status,
    });
    person.queuedBookings.push(queuedBooking);
    await db_1.savePerson(person);
    if (helpers_1.shouldReturnJSON(req)) {
        res.status(201).send(queuedBooking);
    }
    else {
        res.redirect("back");
    }
};
exports.updateAccountLockingStatus = async (personId, lockingStatus) => {
    const person = await db_1.getPerson(personId);
    person.account = person.account || {};
    const previousLockingStatus = person.account.locking_status;
    person.account = {
        ...person.account,
        locking_status: lockingStatus,
    };
    await db_1.savePerson(person);
    if (lockingStatus !== previousLockingStatus) {
        await triggerAccountBlockWebhook(person);
    }
};
exports.updateAccountLockingStatusHandler = async (req, res) => {
    await exports.updateAccountLockingStatus(req.params.personId, req.body.lockingStatus);
    res.redirect("back");
};
const changeCardStatusAllowed = async (personId, cardId, newCardStatus) => {
    const person = await db_1.getPerson(personId);
    const cardData = person.account.cards.find(({ card }) => card.id === cardId);
    const { card: { status: currentCardStatus, type }, } = cardData;
    if (type.includes("VIRTUAL") &&
        newCardStatus === types_1.CardStatus.ACTIVE &&
        [types_1.CardStatus.INACTIVE, types_1.CardStatus.PROCESSING].includes(currentCardStatus)) {
        return;
    }
    if (newCardStatus === types_1.CardStatus.INACTIVE &&
        currentCardStatus !== types_1.CardStatus.PROCESSING) {
        throw new Error(`Allowed to change only from PROCESSING status`);
    }
    if (newCardStatus === types_1.CardStatus.ACTIVE &&
        [
            types_1.CardStatus.INACTIVE,
            types_1.CardStatus.PROCESSING,
            types_1.CardStatus.CLOSED,
            types_1.CardStatus.CLOSED_BY_SOLARIS,
        ].includes(cardData.card.status)) {
        throw new Error(`Can't change card status to active from current status ${cardData.card.status}`);
    }
};
exports.changeCardStatusHandler = async (req, res) => {
    const { personId, accountId, cardId, status } = req.body;
    await changeCardStatusAllowed(personId, cardId, status);
    await cards_1.changeCardStatus({ personId, accountId }, cardId, status);
    res.redirect("back");
};
exports.createReservationHandler = async (req, res) => {
    const { person_id: personId } = req.params;
    const { cardId, amount, currency, type, recipient, declineReason, posEntryMode, } = req.body;
    if (!personId) {
        throw new Error("You have to provide personId");
    }
    if (!cardId) {
        throw new Error("You have to provide cardId");
    }
    const payload = {
        personId,
        cardId,
        amount,
        currency,
        type,
        recipient,
        declineReason,
        posEntryMode,
    };
    const reservation = await (type === types_1.TransactionType.CREDIT_PRESENTMENT
        ? creditPresentment_1.createCreditPresentment(payload)
        : reservations_1.createReservation(payload));
    if (helpers_1.shouldReturnJSON(req)) {
        res.status(201).send(reservation);
    }
    else {
        res.redirect("back");
    }
};
exports.updateReservationHandler = async (req, res) => {
    const { person_id: personId, id: reservationId } = req.params;
    const { action, increaseAmount } = req.body;
    if (!personId) {
        throw new Error("You have to provide personId");
    }
    if (!reservationId) {
        throw new Error("You have to provide reservationId");
    }
    await reservations_1.updateReservation({
        personId,
        reservationId,
        action,
        increaseAmount,
    });
    res.redirect("back");
};
exports.changeOverdraftApplicationStatusHandler = async (req, res) => {
    const { personId, applicationId, status } = req.body;
    await overdraft_1.changeOverdraftApplicationStatus({ personId, applicationId, status });
    res.redirect("back");
};
exports.issueInterestAccruedBookingHandler = async (req, res) => {
    const { person_id: personId } = req.params;
    await overdraft_1.issueInterestAccruedBooking({ personId });
    res.redirect("back");
};
//# sourceMappingURL=backoffice.js.map