/* eslint-disable @typescript-eslint/camelcase */
import uuid from "uuid";
import { getPerson, savePerson } from "../db";

import { generateEntityNotFoundPayload } from "../helpers";
import {
  OverdraftApplicationStatus,
  OverdraftApplicationDecision
} from "../helpers/types";

const INTEREST_RATE = 11.0;

export const createOverdraftApplication = async (req, res) => {
  const {
    body: { credit_record_id: creditRecordId },
    params: { person_id: personId }
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
    status: OverdraftApplicationStatus.CREATED,
    decision: OverdraftApplicationDecision.OFFERED,
    partner_risk_class: null,
    partner_reference_number: null,
    partner_contact_number: null,
    partner_contact_name: null,
    rejection_reasons: [],
    limit: null,
    interest_rate: INTEREST_RATE,
    created_at: new Date().toISOString(),
    account_snapshot_id: null
  };

  person.account.overdraftApplications =
    person.account.overdraftApplications || [];
  person.account.overdraftApplications.push(overdraftApplication);
  await savePerson(person);

  return res.status(200).send(overdraftApplication);
};

export const getOverdraftApplication = async (req, res) => {
  const {
    params: { person_id: personId, id: applicationId }
  } = req;

  const person = await getPerson(personId);

  const overdraftApplication = person.account.overdraftApplications.find(
    app => app.id === applicationId
  );

  if (!overdraftApplication) {
    return res
      .status(404)
      .send(generateEntityNotFoundPayload("application_id", applicationId));
  }

  return res.status(200).send(overdraftApplication);
};
