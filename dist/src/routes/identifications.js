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
exports.showPersonIdentifications = exports.patchIdentification = exports.requireIdentification = void 0;
const db_1 = require("../db");
const log = __importStar(require("../logger"));
const node_uuid_1 = __importDefault(require("node-uuid"));
const node_fetch_1 = __importDefault(require("node-fetch"));
exports.requireIdentification = async (req, res) => {
    const { person_id: personId } = req.params;
    const { method } = req.body;
    const identificationId = node_uuid_1.default.v4();
    let person;
    let identification;
    return db_1.getPerson(personId)
        .then((_person) => {
        person = _person;
        identification = {
            id: identificationId,
            reference: null,
            url: null,
            createdAt: new Date(),
            status: "created",
            completed_at: null,
            method,
        };
        person.identifications[identificationId] = identification;
    })
        .then(() => db_1.savePerson(person))
        .then(() => {
        res.status(201).send(identification);
    });
};
exports.patchIdentification = async (req, res) => {
    const { person_id: personId, id: identificationId } = req.params;
    const person = (await db_1.getPerson(personId)) || {
        identifications: {},
        transactions: [],
    };
    person.identifications[identificationId] =
        person.identifications[identificationId] || {};
    let createUrl;
    let identificationUrl;
    let startUrl;
    const reference = undefined;
    if (person.identifications[identificationId].method === "idnow") {
        createUrl = `https://gateway.test.idnow.de/api/v1/kontist/identifications/${identificationId}/start`;
        identificationUrl = `https://go.test.idnow.de/kontist/identifications/${identificationId}`;
        startUrl = `https://api.test.idnow.de/api/v1/kontist/identifications/${identificationId}/start`;
        if (!process.env.MOCKSOLARIS_DISABLE_IDNOW_TESTSERVER) {
            const response = await node_fetch_1.default(createUrl, {
                method: "POST",
                headers: {
                    "X-API-KEY": "0A0KQ6KGHUAEN0RLRHLB3V3S840ZWH7ZVXE2WYZ0",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: "Hubot",
                    login: "hubot",
                    birthday: "1975-12-20",
                    birthplace: "München",
                    city: "München",
                    country: "DE",
                    custom1: "287492_23552",
                    email: "sampleuser@example.com",
                    firstname: "X-AUTOTEST-FRAUDIDENT",
                    lastname: "Berger",
                    mobilephone: "0151 23411232",
                    nationality: "DE",
                    street: "Bahnstrasse",
                    streetnumber: "27",
                    zipcode: "80127",
                }),
            });
            const text = await response.text();
            log.info("received from idnow", text);
            let idnowresponse;
            try {
                idnowresponse = JSON.parse(text);
            }
            catch (error) {
                log.error("Could not parse idnow answer as JSON:", text);
                throw error;
            }
            if (idnowresponse.errors) {
                const message = `Received error response from idnow: ${JSON.stringify(idnowresponse)}`;
                throw new Error(message);
            }
        }
    }
    person.identifications[identificationId] = {
        ...person.identifications[identificationId],
        id: identificationId,
        url: identificationUrl,
        status: "pending",
        startUrl,
        reference,
        completed_at: null,
        identificationLinkCreatedAt: new Date(),
        person_id: personId,
        email: person.email,
    };
    await db_1.savePerson(person);
    res.status(201).send({
        id: identificationId,
        url: identificationUrl,
        status: "pending",
        reference,
        completed_at: null,
        method: "idnow",
        estimated_waiting_time: Math.floor(Math.random() * 10) + 1,
    });
};
exports.showPersonIdentifications = (req, res) => {
    const personIdentifications = Object.values(req.person.identifications)
        .filter((identification) => identification.status !== "created")
        .map((identification) => {
        return {
            ...identification,
            id: identification.id.substr(0, 36),
            status: identification.status || "pending",
        };
    });
    res.status(200).send(personIdentifications);
};
//# sourceMappingURL=identifications.js.map