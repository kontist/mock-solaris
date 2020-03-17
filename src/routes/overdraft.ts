/* eslint-disable @typescript-eslint/camelcase */
import uuid from "uuid";
import { getPerson, savePerson } from "../db";

import {
  OvedraftApplicationStatus,
  OverdraftApplicationDecision
} from "../helpers/types";

export const createOverdraftApplication = async (req, res) => {
  const {
    body: { credit_record_id: creditRecordId },
    params: { person_id: personId }
  } = req;

  const person = await getPerson(personId);

  if (!person) {
    return res.status(400).send({
      id: uuid.v4(),
      status: 404,
      code: "not_found",
      title: "Not Found",
      detail: `Value: ${personId} for field: 'person_id' not found`,
      source: {
        message: "not found",
        field: "person_id"
      }
    });
  }

  const overdraftApplication = {
    id: uuid.v4(),
    person_id: personId,
    credit_record_id: creditRecordId,
    overdraft_id: null,
    status: OvedraftApplicationStatus.CREATED,
    decision: OverdraftApplicationDecision.OFFERED,
    partner_risk_class: null,
    partner_reference_number: null,
    partner_contact_number: null,
    partner_contact_name: null,
    rejection_reasons: [],
    limit: null,
    interest_rate: 11.0,
    created_at: new Date().toISOString(),
    account_snapshot_id: null
  };

  person.account.overdraftApplication = overdraftApplication;
  await savePerson(person);

  return res.status(200).send(overdraftApplication);
};
