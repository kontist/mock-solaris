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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FraudWatchdog = void 0;
/* eslint-disable @typescript-eslint/camelcase */
const db = __importStar(require("../db"));
const webhooks_1 = require("./webhooks");
const types_1 = require("./types");
const cardAuthorization_1 = require("./cardAuthorization");
const getReservationById = (id, reservations) => {
    return reservations.find((r) => r.id === id);
};
const now = () => new Date().getTime();
class FraudWatchdog {
    constructor(timeout = 60000) {
        this.fraudCases = {};
        this._watching = false;
        this.processFraudCases = async () => {
            this._watching = false;
            const entries = Object.entries(this.fraudCases);
            for (const [fraudCaseId, fraudCase] of entries) {
                if (fraudCase.reservationExpiresAt > now()) {
                    continue;
                }
                const person = await db.getPersonByFraudCaseId(fraudCaseId);
                const reservation = getReservationById(fraudCase.reservationId, person.account.fraudReservations);
                await webhooks_1.triggerWebhook(types_1.CardWebhookEvent.CARD_FRAUD_CASE_TIMEOUT, {
                    resolution: types_1.CaseResolution.TIMEOUT,
                    respond_until: new Date(fraudCase.reservationExpiresAt).toISOString(),
                    whitelisted_until: "null",
                    card_transaction: cardAuthorization_1.mapReservationToCardAuthorization(reservation),
                });
                await this._confirmFraud(fraudCaseId, types_1.CardStatus.BLOCKED);
            }
            if (Object.keys(this.fraudCases).length > 0) {
                this._watch();
            }
        };
        if (timeout < 1000) {
            throw new Error("Invalid timeout value provided!");
        }
        this._loadFraudCases();
        this._timeout = timeout;
    }
    watch(fraudCase) {
        this.fraudCases[fraudCase.id] = fraudCase;
        if (!this._watching) {
            this._watch();
        }
    }
    async _loadFraudCases() {
        const persons = await db.getAllPersons();
        for (const p of persons) {
            if (p.fraudCases.length === 0) {
                continue;
            }
            for (const c of p.fraudCases) {
                this.watch(c);
            }
        }
    }
    _watch() {
        if (this._watching) {
            return;
        }
        this._watching = true;
        setTimeout(this.processFraudCases, this._timeout);
    }
    async whitelistCard(fraudCaseId) {
        const fraudCase = this.fraudCases[fraudCaseId];
        if (!fraudCase) {
            return;
        }
        const person = await db.getPersonByFraudCaseId(fraudCaseId);
        if (!person) {
            return;
        }
        const reservation = getReservationById(fraudCase.reservationId, person.account.fraudReservations);
        person.account.fraudReservations = person.account.fraudReservations.filter((r) => r.id !== reservation.id);
        person.fraudCases = person.fraudCases.filter((f) => f.id !== fraudCase.id);
        delete this.fraudCases[fraudCaseId];
        await db.savePerson(person);
    }
    async confirmFraud(fraudCaseId) {
        return this._confirmFraud(fraudCaseId, types_1.CardStatus.BLOCKED_BY_SOLARIS);
    }
    async _confirmFraud(fraudCaseId, status) {
        const fraudCase = this.fraudCases[fraudCaseId];
        if (!fraudCase) {
            return;
        }
        const person = await db.getPersonByFraudCaseId(fraudCaseId);
        if (!person) {
            return;
        }
        const reservation = getReservationById(fraudCase.reservationId, person.account.fraudReservations);
        person.account.fraudReservations = person.account.fraudReservations.filter((r) => r.id !== reservation.id);
        person.fraudCases = person.fraudCases.filter((f) => f.id !== fraudCase.id);
        await db.savePerson(person);
        delete this.fraudCases[fraudCaseId];
        await this._blockCard(fraudCase.cardId, person, status);
    }
    async _blockCard(cardId, person, status) {
        const { card } = person.account.cards.find((cs) => cs.card.id === cardId);
        card.status = status;
        await db.savePerson(person);
        await webhooks_1.triggerWebhook(types_1.CardWebhookEvent.CARD_LIFECYCLE_EVENT, card);
    }
}
exports.FraudWatchdog = FraudWatchdog;
let fraudWatchdog;
const getFraudWatchdog = () => {
    if (!fraudWatchdog) {
        fraudWatchdog = new FraudWatchdog();
    }
    return fraudWatchdog;
};
exports.default = getFraudWatchdog;
//# sourceMappingURL=fraudWatchdog.js.map