import _ from "lodash";
import moment from "moment";
import uuid from "node-uuid";
import type { Response } from "express";

import {
  saveBusiness,
  redlock,
  setBusinessOrigin,
  getBusiness,
  findBusinesses,
} from "../../db";

import generateID from "../../helpers/id";
import { storeBusinessInSortedSet } from "../../helpers/businesses";
import { BusinessWebhookEvent, MockBusiness } from "../../helpers/types";
import { triggerWebhook } from "../../helpers/webhooks";
import { RequestWithBusiness } from "../../helpers/middlewares";

const businessObjectFields = [
  "id",
  "createdAt",
  "name",
  "sector",
  "industry",
  "industry_key",
  "nace_code",
  "legal_form",
  "foundation_date",
  "address.line_1",
  "address.line_2",
  "address.postal_code",
  "address.city",
  "address.state",
  "address.country",
  "tax_information.tax_country",
  "tax_information.tax_confirmation",
  "tax_information.registration_number",
  "tax_information.registration_issuer",
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
      res.status(201).send({
        id: businessId,
        ...req.body,
      });
    });

    await storeBusinessInSortedSet(business);

    if (req.headers?.origin) {
      await setBusinessOrigin(businessId, req.headers.origin);
    }
  });

  return createdBusiness;
};

export const showBusiness = async (req, res) => {
  const { business_id: businessId } = req.params;
  try {
    const business = await getBusiness(businessId);

    const mappedBusiness = _.pick(business, businessObjectFields);

    return res.status(200).send(mappedBusiness);
  } catch (err) {
    if (
      err.message ===
      `Business which has businessId: ${businessId} was not found in redis`
    ) {
      const resp = {
        errors: [
          {
            id: uuid.v4(),
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
          id: uuid.v4(),
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

  const mappedBusinesses = businesses.map((business) =>
    _.pick(business, businessObjectFields)
  );

  return res.status(200).send(mappedBusinesses);
};

export const updateBusiness = async (req, res) => {
  const fields = [
    "name",
    "sector",
    "industry",
    "industry_key",
    "nace_code",
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
    "sector",
    "nace_code",
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

export const getBusinessAccount = async (
  req: RequestWithBusiness,
  res: Response
) => {
  const { id } = req.params;
  const {
    business: { account },
  } = req;

  if (!account) {
    res.status(404).send({
      errors: [
        {
          id: generateID(),
          status: 404,
          code: "model_not_found",
          title: "Model Not Found",
          detail: `Couldn't find 'Account' for id '${id}'.`,
        },
      ],
    });
    return;
  }

  res.status(201).send(account);
};
