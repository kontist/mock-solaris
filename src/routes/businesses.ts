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
} from "../db";

import generateID from "../helpers/id";
import { storeBusinessInSortedSet } from "../helpers/businesses";

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
