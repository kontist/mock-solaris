import uuid from "uuid";
import { getPerson, savePerson } from "../db";
import { triggerWebhook } from "./webhooks";

import {
  OverdraftApplication,
  OverdraftApplicationStatus,
  OverdraftApplicationDecision,
  OverdraftApplicationWebhookEvent,
  MockPerson
} from "../helpers/types";

export const OVERDRAFT_LIMIT = {
  value: 50000,
  unit: "cents",
  currency: "EUR"
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
    field
  }
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
  status
}: ChangeOverdraftApplicationStatusOptions): Promise<OverdraftApplication> => {
  if (!person) {
    person = await getPerson(personId);
  }

  const overdraftApplication = person.account.overdraftApplications.find(
    app => app.id === applicationId
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
  await triggerWebhook(
    OverdraftApplicationWebhookEvent.OVERDRAFT_APPLICATION,
    overdraftApplication
  );

  return overdraftApplication;
};
