import fetch from "node-fetch";
import uuid from "uuid";
import moment from "moment";

import * as log from "../logger";
import { getPerson, savePerson, getWebhookByType } from "../db";
import { updateAccountLockingStatus } from "./backoffice";

export const SEIZURE_STATUSES = {
  ACTIVE: "ACTIVE",
  FULFILLED: "FULFILLED"
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
    currency: "EUR"
  },
  additional_cost: {
    value: 42,
    unit: "cents",
    currency: "EUR"
  },
  debtor: {
    name: "Ben Wiseley",
    address: "Wisestrasse 34",
    postal_code: "10249",
    city: "Berlin",
    country: "DE",
    state: "BE"
  },
  creditor: {
    name: "Betflix LLC",
    address: "Bethousestrasse 43",
    postal_code: "10409",
    city: "Berlin",
    country: "DE",
    state: "BE",
    iban: "DE72110101001000014344"
  },
  creditor_representative: {
    name: "Lawyer LLC",
    address: "Gunsterstrasse 22",
    postal_code: "10409",
    city: "Berlin",
    country: "DE",
    state: "BE",
    case_number: "42ABC-2",
    iban: "DE72110101001000014344"
  }
};

export const createSeizureRequestHandler = async (req, res) => {
  const { person_id: personId } = req.params;

  log.info("createSeizureRequestHandler()", {
    reqBody: req.body,
    reqParams: req.params
  });

  const person = await getPerson(personId);

  const today = moment().format("YYYY-MM-DD");
  person.seizure = {
    ...SEIZURE_EXAMPLE,
    id: uuid.v4(),
    enactment_date: today,
    delivery_date: today
  };

  await savePerson(person);
  await sendPersonSeizureCreatedWebhook(person.seizure);
  await updateAccountLockingStatus(person.id, "BLOCK");

  res.redirect("back");
};

export const getSeizuresRequestHandler = async (req, res) => {
  const { person_id: personId } = req.params;

  log.info("getSeizuresRequestHandler()", {
    reqBody: req.body,
    reqParams: req.params
  });

  const person = await getPerson(personId);
  const seizures = person.seizure ? [person.seizure] : [];
  return res.status(200).send(seizures);
};

export const deleteSeizureRequestHandler = async (req, res) => {
  const { person_id: personId } = req.params;

  log.info("deleteSeizureRequestHandler()", {
    reqBody: req.body,
    reqParams: req.params
  });

  const person = await getPerson(personId);
  const deletedSeizure = person.seizure;
  person.seizure = null;

  await savePerson(person);
  await sendPersonSeizureDeletedWebhook(deletedSeizure);
  await updateAccountLockingStatus(person.id, "NO_BLOCK");

  res.redirect("back");
};

export const fulfillSeizureRequestHandler = async (req, res) => {
  const { person_id: personId } = req.params;

  log.info("fulfillSeizureRequestHandler()", {
    reqBody: req.body,
    reqParams: req.params
  });

  const person = await getPerson(personId);
  person.seizure.status = SEIZURE_STATUSES.FULFILLED;

  await savePerson(person);
  await updateAccountLockingStatus(person.id, "NO_BLOCK");

  res.redirect("back");
};

const sendPersonSeizureCreatedWebhook = async seizure => {
  const webhook = await getWebhookByType("PERSON_SEIZURE_CREATED");

  if (!webhook) {
    log.error("(sendPersonSeizureCreatedWebhook) Webhook does not exist");
    return;
  }

  await fetch(webhook.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(seizure)
  });
};

const sendPersonSeizureDeletedWebhook = async seizure => {
  const webhook = await getWebhookByType("PERSON_SEIZURE_DELETED");

  if (!webhook) {
    log.error("(sendPersonSeizureDeletedWebhook) Webhook does not exist");
    return;
  }

  await fetch(webhook.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(seizure)
  });
};
