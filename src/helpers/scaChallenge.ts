import uuid from "node-uuid";
import * as db from "../db";
import moment from "moment";
import { triggerWebhook } from "./webhooks";
import { CardWebhookEvent, Reservation, MockPerson } from "./types";

export const CARD_TRANSACTION_CONFIRM_METHOD = "card_transaction:confirm";

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

  await triggerWebhook(CardWebhookEvent.SCA_CHALLENGE, {
    amount: reservation.amount,
    merchant: {
      name: metaData.merchant.name,
      country: "276",
      url: "http://example.com",
    },
    challenged_at: moment().toDate().toISOString(),
    expires_at: moment().add(5, "minute").toDate().toISOString(),
    channel: "browser",
    card_id: metaData.card_id,
    person_id: person.id,
    authenticate_change_request_id:
      changeRequestData.authenticateChangeRequestId,
    decline_change_request_id: changeRequestData.declineChangeRequestId,
  });
};

export const confirmCardTransaction = async (person: MockPerson) => {
  const reservation = person.account.pendingReservation;

  person.account.reservations.push(reservation);
  delete person.account.pendingReservation;
  await db.savePerson(person);

  return triggerWebhook(CardWebhookEvent.CARD_AUTHORIZATION, reservation);
};

export const declineCardTransaction = async (person: MockPerson) => {
  delete person.account.pendingReservation;

  await db.savePerson(person);
};
