import moment from "moment";
import { MockPerson } from "./types";
import { redisClient } from "../db";

export const storePersonInSortedSet = async (person: MockPerson) => {
  const score = moment(person.createdAt).valueOf();
  // Use zAdd to add the person to the sorted set
  const key = `${process.env.MOCKSOLARIS_REDIS_PREFIX}:persons`;
  const member = { score, value: person.id };
  await redisClient.zAdd(key, member);
};
