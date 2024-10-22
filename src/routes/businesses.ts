import _ from "lodash";
import moment from "moment";
import HttpStatusCodes from "http-status";

import {
  saveBusiness,
  redlock,
  setBusinessOrigin,
  saveAccountToBusinessId,
  removeBusiness,
  getBusiness,
  findBusinesses,
} from "../db";

import generateID from "../helpers/id";
import { storeBusinessInSortedSet } from "../helpers/businesses";
import { BusinessWebhookEvent, MockBusiness } from "../helpers/types";
import {
  createBusinessChangeRequest,
  createChangeRequest,
} from "./changeRequest";
import { triggerWebhook } from "../helpers/webhooks";

const ERROR_NOT_FOUND_ID = "0a5ec2ea-6772-11e9-a656-02420a868404";

export const createBusiness = async (req, res) => {
  const businessId = generateID(); // Do not exceed 36 characters
  let createdBusiness;
  const businessLockKey = `redlock:${process.env.MOCKSOLARIS_REDIS_PREFIX}:business:${businessId}`;

  await redlock.using([businessLockKey], 5000, async (signal) => {
    if (signal.aborted) {
      throw signal.error;
    }
    const createdAt = moment();

    const business = {
      ...req.body,
      id: businessId,
      createdAt: createdAt.toISOString(),
    };

    createdBusiness = await saveBusiness(business).then(() => {
      res.status(200).send({
        id: businessId,
        ...req.body,
      });
    });

    await storeBusinessInSortedSet(business);

    if (business.account?.id) {
      await saveAccountToBusinessId(business.account, businessId);
    }

    if (req.headers.origin) {
      await setBusinessOrigin(businessId, req.headers.origin);
    }
  });

  return createdBusiness;
};

export const deleteBusiness = async (req, res) => {
  const { id: businessId } = req.params;
  try {
    await removeBusiness(businessId);
    res.sendStatus(HttpStatusCodes.NO_CONTENT);
  } catch (err) {
    return res.status(500).send({
      errors: [
        {
          id: ERROR_NOT_FOUND_ID,
          status: 500,
        },
      ],
    });
  }
};

export const showBusiness = async (req, res) => {
  const { business_id: businessId } = req.params;
  try {
    const business = await getBusiness(businessId);

    return res.status(200).send(business);
  } catch (err) {
    if (err.message === "did not find business") {
      const resp = {
        errors: [
          {
            id: ERROR_NOT_FOUND_ID,
            status: 404,
            code: "model_not_found",
            title: "Model Not Found",
            detail: `Couldn't find 'Solaris::Business' for id '${businessId}'.`,
          },
        ],
      };

      return res.status(404).send(resp);
    }

    return res.status(500).send({
      errors: [
        {
          id: ERROR_NOT_FOUND_ID,
          status: 500,
        },
      ],
    });
  }
};

export const showBusinesses = async (req, res) => {
  const { page: { size = 10, number = 1 } = {} } = req.query;

  const businesses = ((await findBusinesses()) || []).slice(
    (number - 1) * size,
    size * number
  );

  return res.status(200).send(businesses);
};

export const BUSINESS_UPDATE = "Patch/Business/business_id";

/**
 * Checks if the model has setted previously a value given in the input.
 * This is useful to check is a Solaris entity may be updated or not checking the full entity
 * or the desired part of the entity.
 * i.e isChangeRequestRequired(mydata, business) or isChangeRequestRequired(mydata, business.address)
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

export const updateBusiness = async (req, res) => {
  // Solaris responds with a 403 when the parameter being updated is "empty",
  // i.e., `null`. This is not yet implemented here.
  const fields = [
    "name",
    "title",
    "origin",
    "sector",
    "industry",
    "industry_key",
    "legal_form",
    "foundation_date",
    "address",
    "line_1",
    "line_2",
    "postal_code",
    "city",
    "state",
    "country",
    "tax_information",
    "tax_country",
    "tax_confirmation",
    "registration_number",
    "registration_issuer",
    "fatca_relevant",
    "fatca_crs_confirmed_at",
    "crs_company_type",
    "balance_sheet_total",
    "number_employees",
    "registration_type",
    "registration_district",
    "business_purpose",
    "terms_conditions_signed_at",
    "branch",
    "international_operativity_expectation",
    "vat_number",
    "purpose_of_account_opening",
    "source_of_funds",
    "expected_annual_revenue",
    "expected_annual_incoming_funds",
    "company_status",
  ];

  const editableFields = [
    "name",
    "title",
    "origin",
    "sector",
    "industry",
    "industry_key",
    "legal_form",
    "foundation_date",
    "address",
    "line_1",
    "line_2",
    "postal_code",
    "city",
    "state",
    "country",
    "tax_information",
    "tax_country",
    "tax_confirmation",
    "registration_number",
    "registration_issuer",
    "fatca_relevant",
    "fatca_crs_confirmed_at",
    "crs_company_type",
    "balance_sheet_total",
    "number_employees",
    "registration_type",
    "registration_district",
    "business_purpose",
    "terms_conditions_signed_at",
    "branch",
    "international_operativity_expectation",
    "vat_number",
    "purpose_of_account_opening",
    "source_of_funds",
    "expected_annual_revenue",
    "expected_annual_incoming_funds",
    "company_status",
  ];

  const {
    params: { business_id: businessId },
    body,
  } = req;
  const data = _.pick(body, fields);

  let business;
  const businessLockKey = `redlock:${process.env.MOCKSOLARIS_REDIS_PREFIX}:business:${businessId}`;
  await redlock.using([businessLockKey], 5000, async (signal) => {
    if (signal.aborted) {
      throw signal.error;
    }
    business = (await getBusiness(businessId)) as MockBusiness;

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

    if (isChangeRequestRequired(editable, business)) {
      return createBusinessChangeRequest(
        req,
        res,
        business,
        BUSINESS_UPDATE,
        data
      );
    }

    _.merge(business, data);
    await saveBusiness(business);
  });

  await triggerWebhook({
    type: BusinessWebhookEvent.BUSINESS_CHANGED,
    payload: {},
    extraHeaders: { "solaris-entity-id": businessId },
    businessId: business.id,
  });

  return res.status(200).send(business);
};
