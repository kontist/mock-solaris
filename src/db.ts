import _ from "lodash";
import Promise from "bluebird";
import moment from "moment";
import { createClient, RedisClientType } from "redis";
import { Redis } from "ioredis";
import Redlock from "redlock";

import * as log from "./logger";
import { calculateOverdraftInterest } from "./helpers/overdraft";
import {
  Card,
  CardData,
  CustomerVettingStatus,
  DeviceActivityPayload,
  DeviceConsent,
  DeviceConsentPayload,
  MockAccount,
  MockBusiness,
  MockPerson,
  RiskClarificationStatus,
  ScreeningProgress,
} from "./helpers/types";
import generateID from "./helpers/id";
import { storePersonInSortedSet } from "./helpers/persons";
import { storeBusinessInSortedSet } from "./helpers/businesses";

const clientConfig = process.env.MOCKSOLARIS_REDIS_SERVER
  ? {
      url: process.env.MOCKSOLARIS_REDIS_SERVER ?? "", // You can pass password with the URL: redis://:pwd@localhost:port/
    }
  : {
      // Used in dockerized scenarios, where MOCKSOLARIS_REDIS_SERVER is not set
      url: "redis://mocks-redis:6379",
      password: "mockserverredispassword",
    };

const ioRedisConfig = process.env.MOCKSOLARIS_REDIS_SERVER
  ? process.env.MOCKSOLARIS_REDIS_SERVER ?? ""
  : // Used in dockerized scenarios, where MOCKSOLARIS_REDIS_SERVER is not set
    "redis://:mockserverredispassword@mocks-redis:6379";
export const redisClient: RedisClientType = createClient(clientConfig);
export const ioRedisClient = new Redis(ioRedisConfig);

redisClient
  .connect()
  .then(() => {
    log.info("Redis connection is successful");
  })
  .catch((err) => {
    log.error(err);
  });

redisClient.on("error", (err) => {
  log.error("Error " + err);
});

export const redlock = new Redlock(
  // You should have one client for each independent redis node
  // or cluster.
  [ioRedisClient],
  {
    // The expected clock drift; for more details see:
    // http://redis.io/topics/distlock
    driftFactor: 0.01, // multiplied by lock ttl to determine drift time

    // The max number of times Redlock will attempt to lock a resource
    // before erroring.
    retryCount: 10,

    // the time in ms between attempts
    retryDelay: 200, // time in ms

    // the max time in ms randomly added to retries
    // to improve performance under high contention
    // see https://www.awsarchitectureblog.com/2015/03/backoff.html
    retryJitter: 200, // time in ms

    // The minimum remaining time on a lock before an extension is automatically
    // attempted with the `using` API.
    automaticExtensionThreshold: 500, // time in ms
  }
);

export const migrate = async () => {
  try {
    await getPerson("mockpersonkontistgmbh");
    await getBusiness("mockbusinesskontistgmbh");
    throw new Error("during development, we create it every time");
  } catch (error) {
    log.warning("kontistGmbHAccount not found, creating");

    const kontistAccountPerson: MockPerson = {
      salutation: "MR",
      first_name: "Kontist",
      last_name: "GmbH",
      createdAt: new Date("2015-01-01").toISOString(),
      birth_date: "1998-01-01T00:00:00.000Z",
      birth_city: "Copenhagen",
      nationality: "DE",
      employment_status: "FREELANCER",
      birth_country: "DE",
      address: {
        line_1: "Torstraße 177",
        postal_code: "10155",
        city: "Berlin",
        country: "DE",
      },
      fatca_relevant: true,
      email: "kontistgmbh@mocksolaris.example.com",
      mobile_number: "+49123123223",
      id: "mockpersonkontistgmbh",
      identifications: {
        "identify-mock691f4e49fc43b913bd8ede668e187e9a-1509032370615": {
          id: "identify-mock691f4e49fc43b913bd8ede668e187e9a-1509032370615",
          reference: null,
          url: "https://go.test.idnow.de/kontist/identifications/identify-mock691f4e49fc43b913bd8ede668e187e9a-1509032370615",
          status: "successful",
          completed_at: null,
          method: "idnow",
          identificationLinkCreatedAt: "2017-10-26T15:39:31.327Z",
          person_id: "mock691f4e49fc43b913bd8ede668e187e9a",
          startUrl:
            "https://api.test.idnow.de/api/v1/kontist/identifications/identify-mock691f4e49fc43b913bd8ede668e187e9a-1509032370615/start",
          email: "i1@kontist.com",
        },
        "identify-mock691f4e49fc43b913bd8ede668e187e9a-1509032371343": {
          id: "identify-mock691f4e49fc43b913bd8ede668e187e9a-1509032371343",
          reference: null,
          url: null,
          status: "created",
          completed_at: null,
          method: "idnow",
        },
      },
      screening_progress: ScreeningProgress.SCREENED_ACCEPTED,
      risk_classification_status: RiskClarificationStatus.RISK_ACCEPTED,
      customer_vetting_status: CustomerVettingStatus.RISK_ACCEPTED,
      transactions: [
        {
          id: "e0492abb-87fd-42a2-9303-708026b90c8e",
          amount: {
            value: 100,
            currency: "EUR",
            unit: "cents",
          },
          valuta_date: "2017-12-24",
          description: "kauf dir was",
          booking_date: "2017-09-25",
          name: "topping up the dunning account",
          recipient_bic: process.env.SOLARIS_BIC,
          recipient_iban: "ES0254451416043911355892",
          recipient_name: "Kontist GmbH",
          sender_bic: process.env.SOLARIS_BIC,
          sender_iban: "DE00000000002901",
          sender_name: "Alexander Baatz Retirement Fund",
          creation_date: "2017-12-24",
          booking_type: "SEPA_CREDIT_TRANSFER",
          end_to_end_id: "mockendtoendid",
          transaction_id: "mocktransactionid",
          meta_info: null,
        },
      ],
      account: {
        id: process.env.SOLARIS_KONTIST_ACCOUNT_ID,
        iban: "DE58110101002263909949",
        bic: process.env.SOLARIS_BIC,
        type: "CHECKING_SOLE_PROPRIETOR",
        person_id: "mockpersonkontistgmbh",
        balance: {
          value: 100,
          unit: "cents",
          currency: "EUR",
        },
        locking_status: "",
        available_balance: {
          value: 100,
          unit: "cents",
          currency: "EUR",
        },
        seizure_protection: null,
        cards: [],
        reservations: [],
        fraudReservations: [],
        pendingReservation: null,
      },
      billing_account: {
        id: process.env.SOLARIS_KONTIST_BILLING_ACCOUNT_ID,
        iban: "DE58110101002263909949",
        bic: process.env.SOLARIS_BIC,
        type: "CHECKING_SOLE_PROPRIETOR",
        person_id: "mockpersonkontistgmbh",
        balance: {
          value: 100,
          unit: "cents",
          currency: "EUR",
        },
        locking_status: "",
        available_balance: {
          value: 100,
          unit: "cents",
          currency: "EUR",
        },
      },
    };

    await savePerson(kontistAccountPerson);
    await storePersonInSortedSet(kontistAccountPerson);

    const kontistAccountBusiness: MockBusiness = {
      id: "mockbusinesskontistgmbh",
      name: "Kontist GmbH",
      createdAt: new Date("2024-01-01").toISOString(),
    };

    await saveBusiness(kontistAccountBusiness);
    await storeBusinessInSortedSet(kontistAccountBusiness);
  }
};

const jsonToPerson = (value: string) => {
  if (!value) {
    throw new Error("Person was not found");
  }
  const person = JSON.parse(value);
  person.transactions = person.transactions || [];
  return person;
};

const jsonToBusiness = (value: string) => {
  if (!value) {
    throw new Error("Business was not found");
  }
  const business = JSON.parse(value);
  return business;
};

export const getPerson = async (personId: string): Promise<MockPerson> => {
  const personJSON = await redisClient.get(
    `${process.env.MOCKSOLARIS_REDIS_PREFIX}:person:${personId}`
  );
  if (!personJSON) {
    throw new Error(
      `Person who has personID: ${personId} was not found in redis`
    );
  }
  const person = jsonToPerson(personJSON);
  return augmentPerson(person);
};

export const getBusiness = async (
  businessId: string
): Promise<MockBusiness> => {
  const businessJSON = await redisClient.get(
    `${process.env.MOCKSOLARIS_REDIS_PREFIX}:business:${businessId}`
  );
  if (!businessJSON) {
    throw new Error(
      `Business which has businessId: ${businessId} was not found in redis`
    );
  }
  const business = jsonToBusiness(businessJSON);
  return augmentBusiness(business);
};

export const removePerson = async (personId: string) => {
  const person = await getPerson(personId);
  const score = moment(person.createdAt).valueOf();
  const key = `${process.env.MOCKSOLARIS_REDIS_PREFIX}:persons`;
  await redisClient.zRemRangeByScore(key, score, score);
  await redisClient.del(
    `${process.env.MOCKSOLARIS_REDIS_PREFIX}:person:${personId}`
  );
  await redisClient.del(
    `${process.env.MOCKSOLARIS_REDIS_PREFIX}:taxIdentifications:${personId}`
  );
  await redisClient.del(
    `${process.env.MOCKSOLARIS_REDIS_PREFIX}:mobileNumber:${personId}`
  );

  await deletePersonDevices(personId);
};

export const getTechnicalUserPerson = () => getPerson("mockpersonkontistgmbh");

const addAmountValues = (a, b) => a + b.amount.value;

/**
 * Consider using locks using the redlock package,
 * in functions which load from redis and then save to redis
 */
export const savePerson = async (person, skipInterest = false) => {
  person.address = person.address || { country: null };

  let _person: MockPerson;
  // checking if person stored in redis has account,
  // so this account is used in case of parallel requests
  // to save person resource
  if (person.id && !person.account) {
    // we need to catch here because initial person has id
    // assigned and if it's not saved in redis yet,
    // we will get an error
    _person = await getPerson(person.id).catch(() => {
      // silence the error here
    });
    if (_person?.account) {
      log.warning(
        `Person ${person.id} is missing account, using account from redis`
      );
    }
  }

  const account = person.account || _person?.account;

  if (account) {
    const transactions = person.transactions || _person?.transactions || [];
    const queuedBookings =
      person.queuedBookings || _person?.queuedBookings || [];
    const reservations = account.reservations || [];
    const now = new Date().getTime();
    const transactionsBalance = transactions
      .filter(
        (transaction) => new Date(transaction.valuta_date).getTime() < now
      )
      .reduce(addAmountValues, 0);
    const confirmedTransfersBalance = queuedBookings
      .filter((booking) => booking.status === "accepted")
      .reduce(addAmountValues, 0);
    const reservationsBalance = reservations.reduce(addAmountValues, 0);
    const limitBalance =
      (account.account_limit && account.account_limit.value) || 0;

    if (transactionsBalance < 0 && !skipInterest) {
      calculateOverdraftInterest(account, transactionsBalance);
    }

    /**
     * mockBalanceValue is used for e2e tests to simulate a balance
     * If account has mockBalanceValue, we use it as a balance
     */
    const accountBalance = account.mockBalanceValue
      ? !transactions.length
        ? account.mockBalanceValue
        : account.mockBalanceValue + transactionsBalance // in case made some transactions(transfers negative amounts)
      : transactionsBalance;

    account.balance = {
      value: accountBalance,
    };

    account.available_balance = {
      // Confirmed transfers amounts are negative
      value:
        limitBalance +
        accountBalance +
        confirmedTransfersBalance -
        reservationsBalance,
    };

    person.account = account;
    person.timedOrders = person.timedOrders || [];
  }

  return setPerson(person);
};

/**
 * Consider using locks using the redlock package,
 * in functions which load from redis and then save to redis
 */
export const saveBusiness = async (business) => {
  business.address = business.address || { country: null };

  return setBusiness(business);
};

export const setPerson = async (person) => {
  return redisClient.set(
    `${process.env.MOCKSOLARIS_REDIS_PREFIX}:person:${person.id}`,
    JSON.stringify(person, undefined, 2)
  );
};

export const setBusiness = async (business) => {
  return redisClient.set(
    `${process.env.MOCKSOLARIS_REDIS_PREFIX}:business:${business.id}`,
    JSON.stringify(business, undefined, 2)
  );
};

export const getTaxIdentifications = async (personId) =>
  JSON.parse(
    (await redisClient.get(
      `${process.env.MOCKSOLARIS_REDIS_PREFIX}:taxIdentifications:${personId}`
    )) || "[]"
  );

export const saveTaxIdentifications = async (personId, data) =>
  redisClient.set(
    `${process.env.MOCKSOLARIS_REDIS_PREFIX}:taxIdentifications:${personId}`,
    JSON.stringify(data, undefined, 2)
  );

export const getMobileNumber = async (personId) =>
  JSON.parse(
    await redisClient.get(
      `${process.env.MOCKSOLARIS_REDIS_PREFIX}:mobileNumber:${personId}`
    )
  );

export const saveMobileNumber = async (personId, data) =>
  redisClient.set(
    `${process.env.MOCKSOLARIS_REDIS_PREFIX}:mobileNumber:${personId}`,
    JSON.stringify(data, undefined, 2)
  );

export const deleteMobileNumber = async (personId) =>
  redisClient.del(
    `${process.env.MOCKSOLARIS_REDIS_PREFIX}:mobileNumber:${personId}`
  );

export const getDevice = async (deviceId) =>
  JSON.parse(
    await redisClient.get(
      `${process.env.MOCKSOLARIS_REDIS_PREFIX}:device:${deviceId}`
    )
  );

// @deprecated
export const _getAllDevices = async () => {
  const devices = [];
  const pattern = `${process.env.MOCKSOLARIS_REDIS_PREFIX}:device:*`;
  for await (const key of redisClient.scanIterator({ MATCH: pattern })) {
    const value = await redisClient.get(key);
    devices.push(JSON.parse(value));
  }
  return devices;
};

export const getDevicesByPersonId = (personId: string) => {
  const deviceIds = redisClient.lRange(
    `${process.env.MOCKSOLARIS_REDIS_PREFIX}:person-deviceIds:${personId}`,
    0,
    -1
  );

  return Promise.map(deviceIds, getDevice);
};

export const deletePersonDevices = async (personId: string) => {
  const deviceIds = await redisClient.lRange(
    `${process.env.MOCKSOLARIS_REDIS_PREFIX}:person-deviceIds:${personId}`,
    0,
    -1
  );

  await Promise.map(deviceIds, async (deviceId) => {
    await deleteDevice(deviceId, personId);
  });
};

export const saveDevice = async (device) => {
  await redisClient.set(
    `${process.env.MOCKSOLARIS_REDIS_PREFIX}:device:${device.id}`,
    JSON.stringify(device, undefined, 2)
  );

  await saveDeviceIdToPersonId(device.person_id, device.id);
};

export const deleteDevice = async (deviceId: string, personId: string) => {
  await redisClient.del(
    `${process.env.MOCKSOLARIS_REDIS_PREFIX}:device:${deviceId}`
  );
  await redisClient.lRem(
    `${process.env.MOCKSOLARIS_REDIS_PREFIX}:person-deviceIds:${personId}`,
    0,
    deviceId
  );
};

export const getDeviceChallenge = async (challengeId) =>
  JSON.parse(
    await redisClient.get(
      `${process.env.MOCKSOLARIS_REDIS_PREFIX}:deviceChallenge:${challengeId}`
    )
  );

export const deleteDeviceChallenge = async (challengeId) =>
  redisClient.del(
    `${process.env.MOCKSOLARIS_REDIS_PREFIX}:deviceChallenge:${challengeId}`
  );

export const saveDeviceChallenge = async (challenge) =>
  redisClient.set(
    `${process.env.MOCKSOLARIS_REDIS_PREFIX}:deviceChallenge:${challenge.id}`,
    JSON.stringify(challenge, undefined, 2)
  );

export const saveBooking = async (accountId, booking) => {
  let person;
  const personId = await getPersonIdByAccount({ id: accountId });
  const personLockKey = `redlock:${process.env.MOCKSOLARIS_REDIS_PREFIX}:person:${personId}`;
  await redlock.using([personLockKey], 5000, async (signal) => {
    if (signal.aborted) {
      throw signal.error;
    }
    person = await findPersonByAccount({ id: accountId });
    person.transactions.push(booking);
    await savePerson(person);
  });
  return person;
};

export const _getPersons = async () => {
  const persons = [];
  const pattern = `${process.env.MOCKSOLARIS_REDIS_PREFIX}:person:*`;
  for await (const key of redisClient.scanIterator({ MATCH: pattern })) {
    const value = await redisClient.get(key);
    persons.push(JSON.parse(value));
  }
  return persons;
};

const DEFAULT_LIMIT = 999999;

/**
 * Finds persons. When callbackFn is not supplied, loads all persons.
 * Notes:
 *  Avoid using this function without a callbackFn
 *  If you need to find one person, you can use findPerson() instead
 * @param limit
 * @param callbackFn
 */
export const findPersons = async (
  {
    callbackFn,
    limit,
  }: {
    callbackFn?: (person: MockPerson) => Promise<boolean>;
    limit?: number;
  } = { callbackFn: null, limit: DEFAULT_LIMIT }
): Promise<MockPerson[]> => {
  try {
    const persons = [];

    // Use zRange with REV: true to get the most recent persons based on their createdAt timestamp
    const keys = (await redisClient.sendCommand([
      "ZREVRANGEBYSCORE",
      `${process.env.MOCKSOLARIS_REDIS_PREFIX}:persons`,
      "+inf",
      "-inf",
      "LIMIT",
      "0",
      String(limit || DEFAULT_LIMIT),
    ])) as string[];

    for (const key of keys) {
      const value = await redisClient.get(
        `${process.env.MOCKSOLARIS_REDIS_PREFIX}:person:${key}`
      );
      const person = jsonToPerson(value);
      const shouldSelectPerson = callbackFn ? await callbackFn(person) : true;
      if (shouldSelectPerson) {
        persons.push(person);
      }
    }

    return persons.map((person) => augmentPerson(person));
  } catch (err) {
    log.error("findPersons", err);
    throw err;
  }
};

export const findPerson = async (
  callbackFn: (person: MockPerson) => Promise<boolean>
): Promise<MockPerson | null> => {
  for await (const key of redisClient.scanIterator({
    MATCH: `${process.env.MOCKSOLARIS_REDIS_PREFIX}:person:*`,
  })) {
    const value = await redisClient.get(key);
    const person = jsonToPerson(value);
    const shouldSelectPerson = await callbackFn(person);
    if (shouldSelectPerson) {
      return augmentPerson(person);
    }
  }
  return null;
};

const augmentPerson = (person: MockPerson): MockPerson => {
  const augmented = _.cloneDeep(person);
  augmented.fraudCases = augmented.fraudCases || [];
  augmented.timedOrders = augmented.timedOrders || [];
  augmented.queuedBookings = person.queuedBookings || [];
  augmented.transactions = augmented.transactions || [];

  if (augmented.account) {
    augmented.account.reservations = augmented.account.reservations || [];
    augmented.account.fraudReservations =
      augmented.account.fraudReservations || [];
    augmented.account.pendingReservation =
      augmented.account.pendingReservation || {};
  }
  return augmented;
};

const augmentBusiness = (business: MockBusiness): MockBusiness => {
  const augmented = _.cloneDeep(business);

  return augmented;
};

export const getWebhooks = async () => {
  const webHooks = [];
  for await (const key of redisClient.scanIterator({
    MATCH: `${process.env.MOCKSOLARIS_REDIS_PREFIX}:webhook:*`,
  })) {
    const value = await redisClient.get(key);
    webHooks.push(JSON.parse(value));
  }
  return webHooks;
};

export const getWebhookByType = async (type) => {
  const value = await redisClient.get(
    `${process.env.MOCKSOLARIS_REDIS_PREFIX}:webhook:${type}`
  );
  return value ? JSON.parse(value) : null;
};

export const getSepaDirectDebitReturns = async () => {
  const sepaDirectDebitReturns = JSON.parse(
    (await redisClient.get(
      `${process.env.MOCKSOLARIS_REDIS_PREFIX}:sepa_direct_debit_returns`
    )) || "[]"
  );

  return sepaDirectDebitReturns;
};

export const saveSepaDirectDebitReturn = async (sepaDirectDebitReturn) => {
  const sepaDirectDebitReturns = await getSepaDirectDebitReturns();
  sepaDirectDebitReturns.push(sepaDirectDebitReturn);

  log.info(
    "(mockSolaris/saveSepaDirectDebitReturn) Saving Sepa Direct Debit Return",
    sepaDirectDebitReturn
  );

  await redisClient.set(
    `${process.env.MOCKSOLARIS_REDIS_PREFIX}:sepa_direct_debit_returns`,
    JSON.stringify(sepaDirectDebitReturns)
  );
};

export const saveWebhook = (webhook) => {
  return redisClient.set(
    `${process.env.MOCKSOLARIS_REDIS_PREFIX}:webhook:${webhook.event_type}`,
    JSON.stringify(webhook, undefined, 2)
  );
};

export const deleteWebhook = (webhookType: string) => {
  return redisClient.del(
    `${process.env.MOCKSOLARIS_REDIS_PREFIX}:webhook:${webhookType}`
  );
};

export const flushDb = async () => {
  return redisClient.flushDb();
};

const fillMissingCurrencyForLegacyBooking = (booking) => ({
  ...booking,
  amount: {
    ...booking.amount,
    currency: booking.amount.currency || "EUR",
  },
});

export const getPersonBookings = (person) => {
  return (person.transactions || []).map(fillMissingCurrencyForLegacyBooking);
};

export const getSmsToken = async (personId: string) => {
  const person = await getPerson(personId);
  return _.get(person, "changeRequest.token", null);
};

export const getCardReferences = async () =>
  JSON.parse(
    (await redisClient.get(
      `${process.env.MOCKSOLARIS_REDIS_PREFIX}:cardReferences`
    )) || "[]"
  );

export const hasCardReference = async (cardRef) => {
  const cardReferences = await getCardReferences();
  return cardReferences.includes(cardRef);
};

export const saveCardReference = async (cardRef) => {
  if (await hasCardReference(cardRef)) {
    return false;
  }

  const cardReferences = await getCardReferences();
  cardReferences.push(cardRef);
  await redisClient.set(
    `${process.env.MOCKSOLARIS_REDIS_PREFIX}:cardReferences`,
    JSON.stringify(cardReferences)
  );

  return true;
};

export const getCardData = async (cardId: string): Promise<Card> => {
  const personWhoOwnsTheCard = await findPerson(
    (p) => !!(p?.account?.cards || []).some((cd) => cd?.card?.id === cardId)
  );
  return personWhoOwnsTheCard?.account?.cards.find(
    (card: CardData) => card?.card?.id === cardId
  );
};

export const getPersonBySpendingLimitId = async (id) => {
  const person = await findPerson((p) => {
    return (p.account?.cards ?? []).some(
      (c) => !!(c.controls ?? []).some((co) => co.id === id)
    );
  });
  const cardData = (person?.account?.cards ?? []).find((c) =>
    (c.controls ?? []).some((co) => co.id === id)
  );
  return { person, cardData };
};

export const getPersonByFraudCaseId = async (
  fraudCaseId
): Promise<MockPerson> =>
  findPerson((p) => !!(p.fraudCases ?? []).some((c) => c.id === fraudCaseId));

export const getCard = async (cardId) => (await getCardData(cardId)).card;

export const getPersonByDeviceId = async (deviceId) => {
  const device = await getDevice(deviceId);
  return getPerson(device.person_id);
};

export const setPersonOrigin = async (personId: string, origin?: string) => {
  await redisClient.set(
    `${process.env.MOCKSOLARIS_REDIS_PREFIX}:person-origin:${personId}`,
    origin || ""
  );
};

export const setBusinessOrigin = async (
  businessId: string,
  origin?: string
) => {
  await redisClient.set(
    `${process.env.MOCKSOLARIS_REDIS_PREFIX}:business-origin:${businessId}`,
    origin || ""
  );
};

export const createDeviceConsent = async (
  personId: string,
  deviceConsent: DeviceConsentPayload
): Promise<DeviceConsent> => {
  const consent = {
    id: generateID(),
    person_id: personId,
    event_type: deviceConsent.event_type,
    confirmed_at: deviceConsent.confirmed_at,
    created_at: moment().toISOString(),
  };

  await redisClient.lPush(
    `${process.env.MOCKSOLARIS_REDIS_PREFIX}:DeviceConsents:${personId}`,
    JSON.stringify(consent)
  );

  return consent;
};

export const getDeviceConsents = async (
  personId: string
): Promise<DeviceConsent[]> => {
  return (
    await redisClient.lRange(
      `${process.env.MOCKSOLARIS_REDIS_PREFIX}:DeviceConsents:${personId}`,
      0,
      -1
    )
  ).map((entry) => JSON.parse(entry));
};

export const updateDeviceConsent = async (
  personId: string,
  deviceConsentId: string,
  deviceConsent: DeviceConsentPayload
): Promise<DeviceConsent> => {
  const consents = await getDeviceConsents(personId);
  const index = consents.findIndex((c) => c.id === deviceConsentId);

  if (index < -1) {
    throw new Error("consent not found");
  }

  const consent = {
    ...consents[index],
    ...deviceConsent,
  };

  await redisClient.lSet(
    `${process.env.MOCKSOLARIS_REDIS_PREFIX}:DeviceConsents:${personId}`,
    index,
    JSON.stringify(consent)
  );

  return consent;
};

export const createDeviceActivity = async (
  personId: string,
  deviceActivity: DeviceActivityPayload
): Promise<void> => {
  const activity = {
    id: generateID(),
    person_id: personId,
    activity_type: deviceActivity.activity_type,
    device_data: deviceActivity.device_data,
    created_at: moment().toISOString(),
  };

  await redisClient.lPush(
    `${process.env.MOCKSOLARIS_REDIS_PREFIX}:DeviceActivities:${personId}`,
    JSON.stringify(activity)
  );

  return activity;
};

export const getDeviceActivities = async (personId: string) => {
  return (
    await redisClient.lRange(
      `${process.env.MOCKSOLARIS_REDIS_PREFIX}:DeviceActivities:${personId}`,
      0,
      -1
    )
  ).map((entry) => JSON.parse(entry));
};

export const getPersonOrigin = async (
  personId: string
): Promise<string | null> => {
  return redisClient.get(
    `${process.env.MOCKSOLARIS_REDIS_PREFIX}:person-origin:${personId}`
  );
};

export const saveDeviceIdToPersonId = async (
  personId: string,
  deviceId: string
): Promise<boolean> => {
  const key = `${process.env.MOCKSOLARIS_REDIS_PREFIX}:person-deviceIds:${personId}`;
  const deviceIds = await redisClient.lRange(key, 0, -1);

  if (!deviceIds.includes(deviceId)) {
    await redisClient.lPush(key, deviceId);
    return true;
  }
  return false;
};

export const saveQuestionSetIdToPersonId = async (
  personId: string,
  questionSetId: string
): Promise<boolean> => {
  const key = `${process.env.MOCKSOLARIS_REDIS_PREFIX}:person-questionSetIds:${questionSetId}`;
  await redisClient.set(key, personId);
};

export const getPersonIdByQuestionSetId = async (
  questionSetId: string
): Promise<string> => {
  const key = `${process.env.MOCKSOLARIS_REDIS_PREFIX}:person-questionSetIds:${questionSetId}`;
  return redisClient.get(key);
};

export const saveAccountToPersonId = async (
  account: MockAccount,
  personId: string
): Promise<boolean> => {
  const idKey = `${process.env.MOCKSOLARIS_REDIS_PREFIX}:accountId-personId:${account.id}`;
  const ibanKey = `${process.env.MOCKSOLARIS_REDIS_PREFIX}:accountIBAN-personId:${account.iban}`;
  await Promise.all([
    redisClient.set(idKey, personId),
    redisClient.set(ibanKey, personId),
  ]);
};

export const getPersonIdByAccount = async ({
  id,
  iban,
}: {
  id?: string;
  iban?: string;
}) => {
  const key = id
    ? `${process.env.MOCKSOLARIS_REDIS_PREFIX}:accountId-personId:${id}`
    : `${process.env.MOCKSOLARIS_REDIS_PREFIX}:accountIBAN-personId:${iban}`;
  return redisClient.get(key);
};

export const saveAccountOpeningRequestToPersonId = async (
  accountOpeningRequestId: string,
  personId: string
) => {
  const idKey = `${process.env.MOCKSOLARIS_REDIS_PREFIX}:accountOpeningRequestId-personId:${accountOpeningRequestId}`;

  await redisClient.set(idKey, personId);
};

export const getPersonIdByAccountOpeningRequest = async (
  accountOpeningRequestId: string
) => {
  const key = `${process.env.MOCKSOLARIS_REDIS_PREFIX}:accountOpeningRequestId-personId:${accountOpeningRequestId}`;
  return redisClient.get(key);
};

export const findPersonByAccount: ({
  id,
  iban,
}: {
  id?: string;
  iban?: string;
}) => Promise<MockPerson> = async ({ id, iban }) => {
  const key = id
    ? `${process.env.MOCKSOLARIS_REDIS_PREFIX}:accountId-personId:${id}`
    : `${process.env.MOCKSOLARIS_REDIS_PREFIX}:accountIBAN-personId:${iban}`;
  const personId = await redisClient.get(key);
  if (!personId) {
    return null;
  }
  return getPerson(personId);
};
