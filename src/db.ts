import _ from "lodash";
import Promise from "bluebird";
import moment from "moment";
import { createClient, RedisClientType } from "redis";

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
  MockPerson,
  RiskClarificationStatus,
  ScreeningProgress,
} from "./helpers/types";
import generateID from "./helpers/id";
import { storePersonInSortedSet } from "./helpers/persons";

const clientConfig = process.env.MOCKSOLARIS_REDIS_SERVER
  ? {
      url: process.env.MOCKSOLARIS_REDIS_SERVER ?? "", // You can pass password with the URL: redis://:pwd@localhost:port/
    }
  : {
      // Used in dockerized scenarios, where MOCKSOLARIS_REDIS_SERVER is not set
      url: "redis://mocks-redis:6379",
      password: "mockserverredispassword",
    };
export const redisClient: RedisClientType = createClient(clientConfig);

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

export const migrate = async () => {
  try {
    await getPerson("mockpersonkontistgmbh");
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
    await saveAccountToPersonId(
      kontistAccountPerson.account,
      kontistAccountPerson.id
    );
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

export const getTechnicalUserPerson = () => getPerson("mockpersonkontistgmbh");

const addAmountValues = (a, b) => a + b.amount.value;

export const savePerson = async (person, skipInterest = false) => {
  person.address = person.address || { country: null };

  const account = person.account;

  if (account) {
    const transactions = person.transactions || [];
    const queuedBookings = person.queuedBookings || [];
    const reservations = person.account.reservations || [];
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

    account.balance = {
      value: transactionsBalance,
    };

    account.available_balance = {
      // Confirmed transfers amounts are negative
      value:
        limitBalance +
        transactionsBalance +
        confirmedTransfersBalance -
        reservationsBalance,
    };

    person.account = account;
    person.timedOrders = person.timedOrders || [];
  }

  const response = await redisClient.set(
    `${process.env.MOCKSOLARIS_REDIS_PREFIX}:person:${person.id}`,
    JSON.stringify(person, undefined, 2)
  );

  return response;
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

export const saveBooking = (accountId, booking) => {
  return findPersonByAccount({ id: accountId })
    .then((person) => {
      person.transactions.push(booking);
      return person;
    })
    .then(savePerson);
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
