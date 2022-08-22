import uuid from "node-uuid";
import * as db from "../db";
import moment from "moment-timezone";
import { triggerWebhook } from "./webhooks";
import { CardWebhookEvent, Reservation, MockPerson } from "./types";

export const CARD_TRANSACTION_CONFIRM_METHOD = "card_transaction:confirm";
const BERLIN_TIMEZONE_IDENTIFIER = "Europe/Berlin";

export const proceedWithSCAChallenge = async (
  person: MockPerson,
  reservation: Reservation
) => {
  const metaData = JSON.parse(reservation.meta_info).cards;
  const changeRequestData = {
    declineChangeRequestId: uuid.v4(),
    authenticateChangeRequestId: uuid.v4(),
  };

  person.account.pendingReservation = reservation;
  person.changeRequest = {
    method: CARD_TRANSACTION_CONFIRM_METHOD,
    createdAt: new Date().toISOString(),
    ...changeRequestData,
  };
  await db.savePerson(person);

  await triggerWebhook({
    type: CardWebhookEvent.SCA_CHALLENGE,
    payload: {
      amount: reservation.amount,
      merchant: {
        name: metaData.merchant.name,
        country: "276",
        url: "http://example.com",
      },
      challenged_at: moment().format(),
      expires_at: moment
        .tz(moment(), BERLIN_TIMEZONE_IDENTIFIER)
        .add(5, "minute")
        .format(),
      channel: "browser",
      card_id: metaData.card_id,
      person_id: person.id,
      authenticate_change_request_id:
        changeRequestData.authenticateChangeRequestId,
      decline_change_request_id: changeRequestData.declineChangeRequestId,
    },
    origin: person.origin,
  });
};

export const confirmCardTransaction = async (person: MockPerson) => {
  const reservation = person.account.pendingReservation;

  person.account.reservations.push(reservation);
  delete person.account.pendingReservation;
  await db.savePerson(person);

  return triggerWebhook({
    type: CardWebhookEvent.CARD_AUTHORIZATION,
    payload: reservation,
    origin: person.origin,
  });
};

export const declineCardTransaction = async (person: MockPerson) => {
  delete person.account.pendingReservation;

  await db.savePerson(person);
};
