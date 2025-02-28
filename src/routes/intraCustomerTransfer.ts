import HttpStatusCodes from "http-status";
import moment from "moment";

import {
  getPerson,
  savePerson,
  findBusinessByAccount,
  saveBusiness,
} from "../db";
import {
  BookingType,
  MockBusiness,
  MockPerson,
  IntraCustomerTransfer,
} from "../helpers/types";
import generateID from "../helpers/id";
import { getAccountsFromEntity } from "../helpers";
import { triggerBookingsWebhook } from "./backoffice";

export const createIntraCustomerTransfer = async (req, res) => {
  const { person_id: personId, account_id: accountId } = req.params;
  const transfer: IntraCustomerTransfer = req.body;

  const business = await findBusinessByAccount({ id: accountId });
  const person = (await getPerson(personId)) as MockPerson;
  const entity: MockBusiness | MockPerson = business || person;
  const save = business ? saveBusiness : savePerson;

  const accounts = getAccountsFromEntity(entity);
  const senderAccount = accounts.find((acc) => acc.id === accountId);
  const recipientAccount = accounts.find(
    (acc) => acc.iban === transfer.recipient_iban
  );

  if (!senderAccount || !recipientAccount) {
    return res.status(404).send({
      errors: [
        {
          id: generateID(),
          status: 404,
          code: "model_not_found",
          title: "Model Not Found",
          detail: `Couldn't find 'Solaris::Account' for account id '${accountId}'.`,
        },
      ],
    });
  }

  const isDataMissing = ![
    transfer.recipient_iban,
    transfer.reference,
    transfer.amount.value,
  ].every((value) => value);

  if (isDataMissing) {
    return res.status(HttpStatusCodes.BAD_REQUEST).send({
      errors: [
        {
          id: generateID(),
          status: HttpStatusCodes.BAD_REQUEST,
          code: "validation_error",
          title: "Validation Error",
          detail: "missing required field",
        },
      ],
    });
  }

  if (senderAccount.available_balance.value < transfer.amount.value) {
    return res.status(400).send({
      errors: [
        {
          id: generateID(),
          status: 400,
          code: "insufficient_funds",
          title: "Insufficient Funds",
          detail: `There were insufficient funds to complete this action.`,
        },
      ],
    });
  }

  const name = person
    ? `${person.first_name} ${person.last_name}`
    : business.name;

  const sharedBookingData = {
    description: transfer.description,
    booking_date: moment().format("YYYY-MM-DD"),
    valuta_date: moment().format("YYYY-MM-DD"),
    booking_type: BookingType.INTRA_CUSTOMER_TRANSFER,
    recipient_iban: transfer.recipient_iban,
    recipient_name: name,
    sender_iban: senderAccount.iban,
    sender_name: name,
    reference: transfer.reference,
  };

  const outgoingBooking = {
    ...sharedBookingData,
    id: generateID(),
    amount: {
      ...transfer.amount,
      value: -transfer.amount.value,
      currency: transfer.amount.currency || "EUR",
    },
  };

  const incomingBooking = {
    ...sharedBookingData,
    id: generateID(),
    amount: {
      ...transfer.amount,
      value: transfer.amount.value,
      currency: transfer.amount.currency || "EUR",
    },
  };

  entity.transactions.push(transaction);
  await save(entity);

  res.status(HttpStatusCodes.CREATED).send({
    id: generateID(),
    created_at: new Date().toISOString(),
    ...transfer,
  });

  await triggerBookingsWebhook(entity, incomingBooking);
  await triggerBookingsWebhook(entity, outgoingBooking);
};
