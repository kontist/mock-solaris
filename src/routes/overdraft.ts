/* eslint-disable @typescript-eslint/camelcase */
import uuid from "node-uuid";
import { getPerson, savePerson } from "../db";

import {
  generateEntityNotFoundPayload,
  changeOverdraftApplicationStatus,
  OVERDRAFT_LIMIT,
  INTEREST_ACCRUAL_RATE,
  OVERDRAFT_RATE,
} from "../helpers/overdraft";
import {
  AccountWebhookEvent,
  OverdraftApplicationStatus,
  OverdraftStatus,
} from "../helpers/types";
import { triggerWebhook } from "../helpers/webhooks";

export const createOverdraftApplication = async (req, res) => {
  const {
    body: { credit_record_id: creditRecordId },
    params: { person_id: personId },
  } = req;

  const person = await getPerson(personId);

  if (!person) {
    return res
      .status(404)
      .send(generateEntityNotFoundPayload("person_id", personId));
  }

  if (person.creditRecordId !== creditRecordId) {
    return res
      .status(404)
      .send(generateEntityNotFoundPayload("credit_record_id", creditRecordId));
  }

  const overdraftApplication = {
    id: uuid.v4(),
    person_id: personId,
    credit_record_id: creditRecordId,
    overdraft_id: null,
    status: OverdraftApplicationStatus.ACCOUNT_SNAPSHOT_PENDING,
    decision: null,
    partner_risk_class: null,
    partner_reference_number: null,
    partner_contact_number: null,
    partner_contact_name: null,
    rejection_reasons: [],
    limit: null,
    interest_accrual_rate: INTEREST_ACCRUAL_RATE,
    overdraft_rate: OVERDRAFT_RATE,
    interest_conditions_enabled: true,
    created_at: new Date().toISOString(),
    account_snapshot_id: null,
  };

  person.account.overdraftApplications =
    person.account.overdraftApplications || [];
  person.account.overdraftApplications.push(overdraftApplication);
  await savePerson(person);

  return res.status(200).send(overdraftApplication);
};

export const getOverdraftApplication = async (req, res) => {
  const {
    params: { person_id: personId, id: applicationId },
  } = req;

  const person = await getPerson(personId);

  const overdraftApplication = person.account.overdraftApplications.find(
    (app) => app.id === applicationId
  );

  if (!overdraftApplication) {
    return res
      .status(404)
      .send(generateEntityNotFoundPayload("application_id", applicationId));
  }

  return res.status(200).send(overdraftApplication);
};

export const linkOverdraftApplicationSnapshot = async (req, res) => {
  const {
    body: { account_snapshot_id: accountSnapshotId },
    params: { person_id: personId, id: applicationId },
  } = req;

  const person = await getPerson(personId);

  const overdraftApplication = person.account.overdraftApplications.find(
    (app) => app.id === applicationId
  );

  if (!overdraftApplication) {
    return res
      .status(404)
      .send(generateEntityNotFoundPayload("application_id", applicationId));
  }

  const { snapshot } = person.account;

  if (!snapshot || snapshot.id !== accountSnapshotId) {
    return res
      .status(404)
      .send(
        generateEntityNotFoundPayload("account_snapshot_id", accountSnapshotId)
      );
  }

  overdraftApplication.account_snapshot_id = accountSnapshotId;

  await changeOverdraftApplicationStatus({
    person,
    applicationId: overdraftApplication.id,
    status: OverdraftApplicationStatus.ACCOUNT_SNAPSHOT_VERIFICATION_PENDING,
  });

  res.sendStatus(204);
};

export const createOverdraft = async (req, res) => {
  const {
    body: { account_id: accountId },
    params: { person_id: personId, id: applicationId },
  } = req;

  const person = await getPerson(personId);

  const overdraftApplication = person.account.overdraftApplications.find(
    (app) => app.id === applicationId
  );

  if (!overdraftApplication) {
    return res
      .status(404)
      .send(generateEntityNotFoundPayload("application_id", applicationId));
  }

  const { account } = person;

  if (person.account.id !== accountId) {
    return res
      .status(404)
      .send(generateEntityNotFoundPayload("account_id", accountId));
  }

  const overdraft = {
    id: uuid.v4(),
    status: OverdraftStatus.LIMIT_SET,
    person_id: personId,
    limit: OVERDRAFT_LIMIT,
    interest_accrual_rate: INTEREST_ACCRUAL_RATE,
    overdraft_rate: OVERDRAFT_RATE,
    interest_conditions_enabled: true,
    created_at: new Date().toISOString(),
    account_id: accountId,
  };

  account.overdraft = overdraft;
  account.account_limit = OVERDRAFT_LIMIT;

  overdraftApplication.overdraft_id = overdraft.id;

  await changeOverdraftApplicationStatus({
    person,
    applicationId: overdraftApplication.id,
    status: OverdraftApplicationStatus.OVERDRAFT_CREATED,
  });

  await triggerWebhook({
    type: AccountWebhookEvent.ACCOUNT_LIMIT_CHANGE,
    payload: {
      account_id: accountId,
    },
  });

  res.status(201).send({
    ...overdraft,
    status: OverdraftStatus.CREATED,
  });
};
