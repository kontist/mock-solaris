import uuid from "node-uuid";
import { getPerson, savePerson } from "../db";
import { triggerWebhook } from "./webhooks";

import {
  OverdraftApplication,
  OverdraftApplicationStatus,
  OverdraftApplicationDecision,
  OverdraftApplicationWebhookEvent,
  MockPerson,
  MockAccount,
  BookingType,
} from "../helpers/types";
import {
  triggerBookingsWebhook,
  generateBookingForPerson,
} from "../routes/backoffice";

export const INTEREST_ACCRUAL_RATE = 0.11;
export const OVERDRAFT_RATE = 0.03;

export const OVERDRAFT_LIMIT = {
  value: 50000,
  unit: "cents",
  currency: "EUR",
};

export const generateEntityNotFoundPayload = (
  field: string,
  value: string
) => ({
  id: uuid.v4(),
  status: 404,
  code: "not_found",
  title: "Not Found",
  detail: `Value: '${value}' for field: '${field}' not found`,
  source: {
    message: "not found",
    field,
  },
});

type ChangeOverdraftApplicationStatusOptions = {
  personId?: string;
  person?: MockPerson;
  applicationId: string;
  status: OverdraftApplicationStatus;
};

export const changeOverdraftApplicationStatus = async ({
  personId,
  person,
  applicationId,
  status,
}: ChangeOverdraftApplicationStatusOptions): Promise<OverdraftApplication> => {
  if (!person) {
    person = await getPerson(personId);
  }

  const overdraftApplication = person.account.overdraftApplications.find(
    (app) => app.id === applicationId
  );

  if (overdraftApplication.status === status) {
    return overdraftApplication;
  }

  overdraftApplication.status = status;

  switch (status) {
    case OverdraftApplicationStatus.REJECTED: {
      overdraftApplication.decision = OverdraftApplicationDecision.REJECTED;
      break;
    }
    case OverdraftApplicationStatus.OFFERED: {
      overdraftApplication.limit = OVERDRAFT_LIMIT;
      overdraftApplication.decision = OverdraftApplicationDecision.OFFERED;
      break;
    }
  }

  await savePerson(person);
  await triggerWebhook({
    type: OverdraftApplicationWebhookEvent.OVERDRAFT_APPLICATION,
    payload: overdraftApplication,
    personId: person.id,
  });

  return overdraftApplication;
};

export const calculateOverdraftInterest = (
  account: MockAccount,
  balance: number
) => {
  const daysInYear = 365;
  const interest = Math.floor(
    (Math.abs(balance) * INTEREST_ACCRUAL_RATE) / daysInYear
  );
  account.overdraftInterest = (account.overdraftInterest || 0) + interest;
};

export const issueInterestAccruedBooking = async ({
  personId,
}: {
  personId: string;
}) => {
  const person = await getPerson(personId);

  const booking = generateBookingForPerson({
    person,
    amount: -person.account.overdraftInterest,
    purpose: "Overdraft interest accrued on the account",
    bookingType: BookingType.INTEREST_ACCRUED,
  });

  person.account.overdraftInterest = 0;
  person.transactions.push(booking);
  // we don't want to calculate interest again for this transaction
  const skipInterest = true;

  await savePerson(person, skipInterest);
  await triggerBookingsWebhook(person);
};
