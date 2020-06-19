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
exports.fulfillSeizureRequestHandler = exports.deleteSeizureRequestHandler = exports.getSeizuresRequestHandler = exports.createSeizureRequestHandler = exports.createSeizure = exports.SEIZURE_STATUSES = void 0;
const node_uuid_1 = __importDefault(require("node-uuid"));
const moment_1 = __importDefault(require("moment"));
const log = __importStar(require("../logger"));
const db_1 = require("../db");
const webhooks_1 = require("../helpers/webhooks");
const backoffice_1 = require("./backoffice");
const types_1 = require("../helpers/types");
exports.SEIZURE_STATUSES = {
    ACTIVE: "ACTIVE",
    FULFILLED: "FULFILLED",
};
const SEIZURE_CUSTOMER_TYPES = {
    PERSON: "Person",
};
const SEIZURE_EXAMPLE = {
    id: "1e5aa01b337234b9cf9e687947aa9db1seiz",
    delivery_date: "2019-01-31",
    enactment_date: "2019-01-28",
    authority_name: "Court",
    resolution_case_number: "Number 212121212",
    seizure_type: "COURT_SEIZURE",
    status: exports.SEIZURE_STATUSES.ACTIVE,
    amount: {
        value: 42,
        unit: "cents",
        currency: "EUR",
    },
    additional_cost: {
        value: 42,
        unit: "cents",
        currency: "EUR",
    },
    debtor: {
        name: "Ben Wiseley",
        address: "Wisestrasse 34",
        postal_code: "10249",
        city: "Berlin",
        country: "DE",
        state: "BE",
    },
    creditor: {
        name: "Betflix LLC",
        address: "Bethousestrasse 43",
        postal_code: "10409",
        city: "Berlin",
        country: "DE",
        state: "BE",
        iban: "DE72110101001000014344",
    },
    creditor_representative: {
        name: "Lawyer LLC",
        address: "Gunsterstrasse 22",
        postal_code: "10409",
        city: "Berlin",
        country: "DE",
        state: "BE",
        case_number: "42ABC-2",
        iban: "DE72110101001000014344",
    },
};
exports.createSeizure = async (personId) => {
    const person = await db_1.getPerson(personId);
    const today = moment_1.default().format("YYYY-MM-DD");
    person.seizure = {
        ...SEIZURE_EXAMPLE,
        id: node_uuid_1.default.v4(),
        enactment_date: today,
        delivery_date: today,
    };
    await db_1.savePerson(person);
    return person;
};
exports.createSeizureRequestHandler = async (req, res) => {
    const { person_id: personId } = req.params;
    log.info("createSeizureRequestHandler()", {
        reqBody: req.body,
        reqParams: req.params,
    });
    const person = await exports.createSeizure(personId);
    await triggerPersonSeizureCreatedWebhook(person.id, person.seizure);
    await backoffice_1.updateAccountLockingStatus(person.id, "BLOCK");
    res.redirect("back");
};
exports.getSeizuresRequestHandler = async (req, res) => {
    const { person_id: personId } = req.params;
    log.info("getSeizuresRequestHandler()", {
        reqBody: req.body,
        reqParams: req.params,
    });
    const person = await db_1.getPerson(personId);
    const seizures = person.seizure ? [person.seizure] : [];
    return res.status(200).send(seizures);
};
exports.deleteSeizureRequestHandler = async (req, res) => {
    const { person_id: personId } = req.params;
    log.info("deleteSeizureRequestHandler()", {
        reqBody: req.body,
        reqParams: req.params,
    });
    const person = await db_1.getPerson(personId);
    const deletedSeizure = person.seizure;
    person.seizure = null;
    await db_1.savePerson(person);
    await triggerPersonSeizureDeletedWebhook(person.id, deletedSeizure);
    await backoffice_1.updateAccountLockingStatus(person.id, "NO_BLOCK");
    res.redirect("back");
};
exports.fulfillSeizureRequestHandler = async (req, res) => {
    const { person_id: personId } = req.params;
    log.info("fulfillSeizureRequestHandler()", {
        reqBody: req.body,
        reqParams: req.params,
    });
    const person = await db_1.getPerson(personId);
    person.seizure.status = exports.SEIZURE_STATUSES.FULFILLED;
    await db_1.savePerson(person);
    await backoffice_1.updateAccountLockingStatus(person.id, "NO_BLOCK");
    res.redirect("back");
};
const triggerPersonSeizureCreatedWebhook = async (personId, seizure) => {
    const payload = getSeizureWebhookPayload(personId, seizure);
    await webhooks_1.triggerWebhook(types_1.PersonWebhookEvent.PERSON_SEIZURE_CREATED, payload);
};
const triggerPersonSeizureDeletedWebhook = async (personId, seizure) => {
    const payload = getSeizureWebhookPayload(personId, seizure);
    await webhooks_1.triggerWebhook(types_1.PersonWebhookEvent.PERSON_SEIZURE_DELETED, payload);
};
const getSeizureWebhookPayload = (personId, seizure) => ({
    ...seizure,
    customer_id: personId,
    customer_type: SEIZURE_CUSTOMER_TYPES.PERSON,
});
//# sourceMappingURL=seizures.js.map