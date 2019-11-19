/* eslint-disable @typescript-eslint/camelcase */

import * as db from "../db";
import moment from "moment";

import { generateMetaInfo } from "./reservations";
import { creteBookingFromReservation } from "../routes/transactions";
import { TransactionType, FxRate } from "./types";

export const createCreditPresentment = async ({
  personId,
  cardId,
  amount,
  currency,
  type,
  recipient
}: {
  personId: string;
  cardId: string;
  amount: string;
  currency: string;
  type: TransactionType;
  recipient: string;
}) => {
  const person = await db.getPerson(personId);
  const cardData = person.account.cards.find(({ card }) => card.id === cardId);

  if (!cardData) {
    throw new Error("Card not found");
  }

  const date = moment().toDate();
  const convertedAmount = Math.abs(parseInt(amount, 10));

  const metaInfo = generateMetaInfo({
    originalAmount: convertedAmount,
    originalCurrency: currency,
    recipient,
    cardId,
    date,
    type,
    incoming: true
  });

  const booking = creteBookingFromReservation(
    person,
    {
      amount: { value: Math.round(convertedAmount * FxRate[currency]) },
      description: recipient,
      meta_info: metaInfo
    },
    true
  );

  person.transactions.push(booking);

  await db.savePerson(person);
};
