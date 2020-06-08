import uuid from "node-uuid";
import moment from "moment";

import * as log from "../logger";
import { getPerson, savePerson } from "../db";
import { triggerWebhook } from "../helpers/webhooks";
import { updateAccountLockingStatus } from "./backoffice";
import { PersonWebhookEvent } from "../helpers/types";

export const SEIZURE_STATUSES = {
  ACTIVE: "ACTIVE",
  FULFILLED: "FULFILLED",
};

const SEIZURE_CUSTOMER_TYPES = {
  PERSON: "Person",
};

const SEIZURE_EXAMPLE = {
  id: "1e5aa01b337234b9cf9e687947aa9db1seiz",
  delivery_date: "2019-01-31",
  enactment_date: "2019-01-28",
  authority_name: "Court",
  resolution_case_number: "Number 212121212",
  seizure_type: "COURT_SEIZURE",
  status: SEIZURE_STATUSES.ACTIVE,
  amount: {
    value: 42,
    unit: "cents",
    currency: "EUR",
  },
  additional_cost: {
    value: 42,
    unit: "cents",
    currency: "EUR",
  },
  debtor: {
    name: "Ben Wiseley",
    address: "Wisestrasse 34",
    postal_code: "10249",
    city: "Berlin",
    country: "DE",
    state: "BE",
  },
  creditor: {
    name: "Betflix LLC",
    address: "Bethousestrasse 43",
    postal_code: "10409",
    city: "Berlin",
    country: "DE",
    state: "BE",
    iban: "DE72110101001000014344",
  },
  creditor_representative: {
    name: "Lawyer LLC",
    address: "Gunsterstrasse 22",
    postal_code: "10409",
    city: "Berlin",
    country: "DE",
    state: "BE",
    case_number: "42ABC-2",
    iban: "DE72110101001000014344",
  },
};

export const createSeizure = async (personId) => {
  const person = await getPerson(personId);

  const today = moment().format("YYYY-MM-DD");
  person.seizure = {
    ...SEIZURE_EXAMPLE,
    id: uuid.v4(),
    enactment_date: today,
    delivery_date: today,
  };

  await savePerson(person);
  return person;
};

export const createSeizureRequestHandler = async (req, res) => {
  const { person_id: personId } = req.params;

  log.info("createSeizureRequestHandler()", {
    reqBody: req.body,
    reqParams: req.params,
  });

  const person = await createSeizure(personId);

  await triggerPersonSeizureCreatedWebhook(person.id, person.seizure);
  await updateAccountLockingStatus(person.id, "BLOCK");

  res.redirect("back");
};

export const getSeizuresRequestHandler = async (req, res) => {
  const { person_id: personId } = req.params;

  log.info("getSeizuresRequestHandler()", {
    reqBody: req.body,
    reqParams: req.params,
  });

  const person = await getPerson(personId);
  const seizures = person.seizure ? [person.seizure] : [];
  return res.status(200).send(seizures);
};

export const deleteSeizureRequestHandler = async (req, res) => {
  const { person_id: personId } = req.params;

  log.info("deleteSeizureRequestHandler()", {
    reqBody: req.body,
    reqParams: req.params,
  });

  const person = await getPerson(personId);
  const deletedSeizure = person.seizure;
  person.seizure = null;

  await savePerson(person);
  await triggerPersonSeizureDeletedWebhook(person.id, deletedSeizure);
  await updateAccountLockingStatus(person.id, "NO_BLOCK");

  res.redirect("back");
};

export const fulfillSeizureRequestHandler = async (req, res) => {
  const { person_id: personId } = req.params;

  log.info("fulfillSeizureRequestHandler()", {
    reqBody: req.body,
    reqParams: req.params,
  });

  const person = await getPerson(personId);
  person.seizure.status = SEIZURE_STATUSES.FULFILLED;

  await savePerson(person);
  await updateAccountLockingStatus(person.id, "NO_BLOCK");

  res.redirect("back");
};

const triggerPersonSeizureCreatedWebhook = async (personId, seizure) => {
  const payload = getSeizureWebhookPayload(personId, seizure);
  await triggerWebhook(PersonWebhookEvent.PERSON_SEIZURE_CREATED, payload);
};

const triggerPersonSeizureDeletedWebhook = async (personId, seizure) => {
  const payload = getSeizureWebhookPayload(personId, seizure);
  await triggerWebhook(PersonWebhookEvent.PERSON_SEIZURE_DELETED, payload);
};

const getSeizureWebhookPayload = (personId, seizure) => ({
  ...seizure,
  customer_id: personId,
  customer_type: SEIZURE_CUSTOMER_TYPES.PERSON,
});
