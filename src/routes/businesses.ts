import _ from "lodash";
import moment, { Moment } from "moment";

import { saveBusiness, redlock, setBusinessOrigin } from "../db";

import generateID from "../helpers/id";
import { storeBusinessInSortedSet } from "../helpers/businesses";

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

    if (req.headers.origin) {
      await setBusinessOrigin(businessId, req.headers.origin);
    }
  });

  return createdBusiness;
};
