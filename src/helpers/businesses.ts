import moment from "moment";
import { MockBusiness } from "./types";
import { redisClient } from "../db";

export const storeBusinessInSortedSet = async (business: MockBusiness) => {
  const score = moment(business.createdAt).valueOf();
  // Use zAdd to add the business to the sorted set
  const key = `${process.env.MOCKSOLARIS_REDIS_PREFIX}:businesses`;
  const member = { score, value: business.id };
  await redisClient.zAdd(key, member);
};
