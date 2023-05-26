/* eslint-disable @typescript-eslint/camelcase */
import * as db from "../db";
import { triggerWebhook } from "./webhooks";
import {
  Reservation,
  CardStatus,
  CardWebhookEvent,
  MockPerson,
  FraudCase,
  CaseResolution,
} from "./types";
import { mapReservationToCardAuthorization } from "./cardAuthorization";

const getReservationById = (id: string, reservations: Reservation[]) => {
  return reservations.find((r) => r.id === id);
};

const now = () => new Date().getTime();

export class FraudWatchdog {
  fraudCases: { string?: FraudCase } = {};
  private _timeout;
  private _watching = false;

  constructor(timeout = 60000) {
    if (timeout < 1000) {
      throw new Error("Invalid timeout value provided!");
    }
    this._loadFraudCases();
    this._timeout = timeout;
  }

  watch(fraudCase: FraudCase) {
    this.fraudCases[fraudCase.id] = fraudCase;
    if (!this._watching) {
      this._watch();
    }
  }

  private async _loadFraudCases() {
    const persons = await db.getPersons({
      sort: false,
      callbackFn: (p) => !!p.fraudCases?.length,
    });
    if (persons?.length) return;
    persons.forEach((p) => p.fraudCases.forEach((fc) => this.watch(fc)));
  }

  public processFraudCases = async () => {
    this._watching = false;
    const entries = Object.entries(this.fraudCases);
    for (const [fraudCaseId, fraudCase] of entries) {
      if (fraudCase.reservationExpiresAt > now()) {
        continue;
      }

      const person = await db.getPersonByFraudCaseId(fraudCaseId);

      const reservation = getReservationById(
        fraudCase.reservationId,
        person.account.fraudReservations
      );
      await triggerWebhook({
        type: CardWebhookEvent.CARD_FRAUD_CASE_TIMEOUT,
        payload: {
          resolution: CaseResolution.TIMEOUT,
          respond_until: new Date(fraudCase.reservationExpiresAt).toISOString(),
          whitelisted_until: "null",
          card_transaction: mapReservationToCardAuthorization(reservation),
        },
        personId: person.id,
      });
      await this._confirmFraud(fraudCaseId, CardStatus.BLOCKED);
    }
    if (Object.keys(this.fraudCases).length > 0) {
      this._watch();
    }
  };

  private _watch() {
    if (this._watching) {
      return;
    }
    this._watching = true;
    setTimeout(this.processFraudCases, this._timeout);
  }

  async whitelistCard(fraudCaseId: string) {
    const fraudCase = this.fraudCases[fraudCaseId];
    if (!fraudCase) {
      return;
    }
    const person = await db.getPersonByFraudCaseId(fraudCaseId);
    if (!person) {
      return;
    }

    const reservation = getReservationById(
      fraudCase.reservationId,
      person.account.fraudReservations
    );
    person.account.fraudReservations = person.account.fraudReservations.filter(
      (r) => r.id !== reservation.id
    );
    person.fraudCases = person.fraudCases.filter((f) => f.id !== fraudCase.id);
    delete this.fraudCases[fraudCaseId];
    await db.savePerson(person);
  }

  async confirmFraud(fraudCaseId: string) {
    return this._confirmFraud(fraudCaseId, CardStatus.BLOCKED_BY_SOLARIS);
  }

  async _confirmFraud(fraudCaseId: string, status: CardStatus) {
    const fraudCase = this.fraudCases[fraudCaseId];
    if (!fraudCase) {
      return;
    }
    const person = await db.getPersonByFraudCaseId(fraudCaseId);
    if (!person) {
      return;
    }
    const reservation = getReservationById(
      fraudCase.reservationId,
      person.account.fraudReservations
    );

    person.account.fraudReservations = person.account.fraudReservations.filter(
      (r) => r.id !== reservation.id
    );
    person.fraudCases = person.fraudCases.filter((f) => f.id !== fraudCase.id);
    await db.savePerson(person);
    delete this.fraudCases[fraudCaseId];

    await this._blockCard(fraudCase.cardId, person, status);
  }

  private async _blockCard(
    cardId: string,
    person: MockPerson,
    status: CardStatus
  ) {
    const { card } = person.account.cards.find((cs) => cs.card.id === cardId);
    card.status = status;
    await db.savePerson(person);
    await triggerWebhook({
      type: CardWebhookEvent.CARD_LIFECYCLE_EVENT,
      payload: card,
      personId: person.id,
    });
  }
}

let fraudWatchdog;

const getFraudWatchdog = () => {
  if (!fraudWatchdog) {
    fraudWatchdog = new FraudWatchdog();
  }
  return fraudWatchdog;
};

export default getFraudWatchdog;
