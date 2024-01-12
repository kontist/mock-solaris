import _ from "lodash";
import moment, { Moment } from "moment";

import {
  getPerson,
  findPersons,
  savePerson,
  setPersonOrigin,
  saveAccountToPersonId,
  redlock,
} from "../db";

import { createChangeRequest } from "./changeRequest";
import { triggerWebhook } from "../helpers/webhooks";
import { MockPerson, PersonWebhookEvent } from "../helpers/types";
import generateID from "../helpers/id";
import { storePersonInSortedSet } from "../helpers/persons";

const format = (date: Moment): string => date.format("YYYY-MM-DD");

/**
 * Creates a person
 * @deprecated Expected to be removed by 11.09.2023
 * @see {@link "https://docs.solarisgroup.com/api-reference/onboarding/account-creation/#tag/Person-accounts/paths/~1v1~1persons~1{person_id}~1accounts/post"}
 */
export const createPerson = async (req, res) => {
  const personId = generateID(); // Do not exceed 36 characters
  let createdPerson;
  const personLockKey = `redlock:${process.env.MOCKSOLARIS_REDIS_PREFIX}:person:${personId}`;
  await redlock.using([personLockKey], 5000, async (signal) => {
    if (signal.aborted) {
      throw signal.error;
    }
    const createdAt = moment();

    const person = {
      ...req.body,
      id: personId,
      identifications: {},
      transactions: [],
      statements: [],
      queuedBookings: [],
      createdAt: createdAt.toISOString(),
      aml_confirmed_on: format(createdAt),
      aml_follow_up_date: format(createdAt.add(2, "year")),
    };

    createdPerson = await savePerson(person).then(() => {
      res.status(200).send({
        id: personId,
        ...req.body,
      });
    });

    await storePersonInSortedSet(person);

    if (person.account?.id) {
      await saveAccountToPersonId(person.account, personId);
    }

    if (req.headers.origin) {
      await setPersonOrigin(personId, req.headers.origin);
    }
  });

  return createdPerson;
};

export const showPerson = async (req, res) => {
  const { person_id: personId } = req.params;
  try {
    const person = await getPerson(personId);

    return res.status(200).send(person);
  } catch (err) {
    if (err.message === "did not find person") {
      const resp = {
        errors: [
          {
            id: "0a5ec2ea-6772-11e9-a656-02420a868404",
            status: 404,
            code: "model_not_found",
            title: "Model Not Found",
            detail: `Couldn't find 'Solaris::Person' for id '${personId}'.`,
          },
        ],
      };

      return res.status(404).send(resp);
    }

    return res.status(500).send({
      errors: [
        {
          id: "0a5ec2ea-6772-11e9-a656-02420a868404",
          status: 500,
        },
      ],
    });
  }
};

export const showPersons = async (req, res) => {
  const { page: { size = 10, number = 1 } = {} } = req.query;

  const persons = ((await findPersons()) || []).slice(
    (number - 1) * size,
    size * number
  );

  return res.status(200).send(persons);
};

export const PERSON_UPDATE = "Patch/Persons/person_id";

/**
 * Checks if the model has setted previously a value given in the input.
 * This is useful to check is a Solaris entity may be updated or not checking the full entity
 * or the desired part of the entity.
 * i.e isChangeRequestRequired(mydata, person) or isChangeRequestRequired(mydata, person.address)
 * @param {$Request} req
 * @param {$Response} res
 */
const isChangeRequestRequired = (input, model) => {
  let flag = false;

  if (input && model) {
    Object.keys(input).forEach((key) => {
      if (typeof input[key] === "object" && model[key]) {
        flag = flag || isChangeRequestRequired(input[key], model[key]);
      } else if (model[key]) {
        flag = true;
      }
    });
  }

  return flag;
};

export const updatePerson = async (req, res) => {
  // Solaris responds with a 403 when the parameter being updated is "empty",
  // i.e., `null`. This is not yet implemented here.
  const fields = [
    "salutation",
    "title",
    "first_name",
    "last_name",
    "address",
    "line_1",
    "line_2",
    "postal_code",
    "city",
    "state",
    "country",
    "contact_address",
    "email",
    "mobile_number",
    "birth_name",
    "birth_date",
    "birth_city",
    "birth_country",
    "nationality",
    "employment_status",
    "job_title",
    "tax_information",
    "tax_assessment",
    "marital_status",
    "fatca_relevant",
    "fatca_crs_confirmed_at",
    "business_purpose",
    "industry",
    "industry_key",
    "terms_conditions_signed_at",
    "own_economic_interest_signed_at",
    "business_trading_name",
    "aml_follow_up_date",
    "aml_confirmed_on",
    "nace_code",
    "website_social_media",
    "expected_monthly_revenue_cents",
    "business_address_line_1",
    "business_address_line_2",
    "business_postal_code",
    "business_city",
    "business_country",
  ];

  const editableFields = [
    "title",
    "salutation",
    "address",
    "line_1",
    "line_2",
    "postal_code",
    "city",
    "state",
    "country",
    "contact_address",
    "employment_status",
    "job_title",
    "email",
    "tax_information",
    "fatca_relevant",
    "fatca_crs_confirmed_at",
    "fatca_relevant",
    "fatca_crs_confirmed_at",
    "business_purpose",
    "industry",
    "industry_key",
    "terms_conditions_signed_at",
    "business_trading_name",
    "aml_confirmed_on",
    "nace_code",
    "website_social_media",
    "expected_monthly_revenue_cents",
    "business_address_line_1",
    "business_address_line_2",
    "business_postal_code",
    "business_city",
    "business_country",
  ];

  const {
    params: { person_id: personId },
    body,
  } = req;
  const data = _.pick(body, fields);

  let person;
  const personLockKey = `redlock:${process.env.MOCKSOLARIS_REDIS_PREFIX}:person:${personId}`;
  await redlock.using([personLockKey], 5000, async (signal) => {
    if (signal.aborted) {
      throw signal.error;
    }
    person = (await getPerson(personId)) as MockPerson;

    const fieldsBanned = [];
    Object.keys(data).forEach((key) => {
      if (!editableFields.includes(key)) fieldsBanned.push(key);
    });

    if (fieldsBanned.length) {
      return res.status(400).send({
        id: "f0487cda-5a03-11e9-8ebd-02420a86840b",
        status: 400,
        code: "deprecated_params",
        title: "Deprecated Parameters",
        detail: `Updating ${fieldsBanned[0]} is deprecated.`,
      });
    }

    const editable = _.pick(data, editableFields);
    editable.address = _.pick(data.address, editableFields);
    editable.contact_address = _.pick(data.contact_address, editableFields);
    editable.tax_information = _.pick(data.tax_information, editableFields);

    if (data.aml_confirmed_on) {
      data.aml_follow_up_date = moment(data.aml_confirmed_on).add(2, "year");
    }

    if (isChangeRequestRequired(editable, person)) {
      return createChangeRequest(req, res, person, PERSON_UPDATE, data);
    }

    _.merge(person, data);
    await savePerson(person);
  });

  await triggerWebhook({
    type: PersonWebhookEvent.PERSON_CHANGED,
    payload: {},
    extraHeaders: { "solaris-entity-id": personId },
    personId: person.id,
  });

  return res.status(200).send(person);
};

export const createCreditRecord = async (req, res) => {
  const {
    body: { source },
    params: { person_id: personId },
  } = req;

  const person = await getPerson(personId);

  if (source !== "solarisBank") {
    return res.status(400).send({
      id: generateID(),
      status: 400,
      code: "bad_request",
      title: "Bad Request",
      detail: `/source: Invalid value for enum`,
      source: {
        message: "Invalid value for enum",
        field: "/source",
      },
    });
  }
  const creditRecordId = generateID();
  person.creditRecordId = creditRecordId;
  await savePerson(person);

  return res.status(201).send({
    status: "available",
    person_id: req.params.person_id,
    id: creditRecordId,
    created_at: new Date().toISOString(),
  });
};
