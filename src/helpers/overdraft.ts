import { getPerson, savePerson } from "../db";
import { triggerWebhook } from "./webhooks";

import {
  OverdraftApplication,
  OverdraftApplicationStatus,
  OverdraftApplicationDecision,
  OverdraftApplicationWebhookEvent
} from "../helpers/types";

export const changeOverdraftApplicationStatus = async (
  personId: string,
  applicationId: string,
  newStatus: OverdraftApplicationStatus
): Promise<OverdraftApplication> => {
  const person = await getPerson(personId);

  const overdraftApplication = person.account.overdraftApplications.find(
    app => app.id === applicationId
  );

  if (overdraftApplication.status === newStatus) {
    return overdraftApplication;
  }

  overdraftApplication.status = newStatus;

  if (newStatus === OverdraftApplicationStatus.REJECTED) {
    overdraftApplication.decision = OverdraftApplicationDecision.REJECTED;
  }

  await savePerson(person);
  await triggerWebhook(
    OverdraftApplicationWebhookEvent.OVERDRAFT_APPLICATION,
    overdraftApplication
  );

  return overdraftApplication;
};
