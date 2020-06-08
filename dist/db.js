"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCard = exports.getPersonByFraudCaseId = exports.getCardData = exports.saveCardReference = exports.hasCardReference = exports.getCardReferences = exports.getSmsToken = exports.getPersonBookings = exports.flushDb = exports.saveWebhook = exports.saveSepaDirectDebitReturn = exports.getSepaDirectDebitReturns = exports.getWebhookByType = exports.getWebhooks = exports.findPersonByEmail = exports.findPersonByAccountIBAN = exports.findPersonByAccountId = exports.findPersonByAccountField = exports.getAllIdentifications = exports.getAllPersons = exports.saveBooking = exports.saveDeviceChallenge = exports.deleteDeviceChallenge = exports.getDeviceChallenge = exports.saveDevice = exports.getDevicesByPersonId = exports.getAllDevices = exports.getDevice = exports.deleteMobileNumber = exports.saveMobileNumber = exports.getMobileNumber = exports.saveTaxIdentifications = exports.getTaxIdentifications = exports.savePerson = exports.getTechnicalUserPerson = exports.getPerson = exports.migrate = void 0;
const lodash_1 = __importDefault(require("lodash"));
const bluebird_1 = __importDefault(require("bluebird"));
const log = __importStar(require("./logger"));
const overdraft_1 = require("./helpers/overdraft");
let redis;
if (process.env.MOCKSOLARIS_REDIS_SERVER) {
    log.info(`using redis server at ${process.env.MOCKSOLARIS_REDIS_SERVER}`);
    redis = require("redis");
    bluebird_1.default.promisifyAll(redis.RedisClient.prototype);
    bluebird_1.default.promisifyAll(redis.Multi.prototype);
}
else {
    log.info("using memory for not very persistent persistence");
    redis = bluebird_1.default.promisifyAll(require("redis-mock"));
}
const redisClient = redis.createClient(process.env.MOCKSOLARIS_REDIS_SERVER);
redisClient.on("error", function (err) {
    log.error("Error " + err);
});
exports.migrate = async () => {
    try {
        await exports.getPerson("mockpersonkontistgmbh");
        throw new Error("during development, we create it every time");
    }
    catch (error) {
        log.warn("kontistGmbHAccount not found, creating");
        await exports.savePerson({
            salutation: "MR",
            first_name: "Kontist",
            last_name: "GmbH",
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
                    startUrl: "https://api.test.idnow.de/api/v1/kontist/identifications/identify-mock691f4e49fc43b913bd8ede668e187e9a-1509032370615/start",
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
            transactions: [
                {
                    id: "e0492abb-87fd-42a2-9303-708026b90c8e",
                    amount: {
                        value: 100,
                        currency: "EUR",
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
                },
            ],
            account: {
                id: process.env.SOLARIS_KONTIST_ACCOUNT_ID,
                iban: "DE58110101002263909949",
                bic: process.env.SOLARIS_BIC,
                type: "CHECKING_BUSINESS",
                person_id: "mockpersonkontistgmbh",
                balance: {
                    value: 100,
                },
                sender_name: "unknown",
                locking_status: "",
                available_balance: {
                    value: 100,
                },
            },
            billing_account: {
                id: process.env.SOLARIS_KONTIST_BILLING_ACCOUNT_ID,
                iban: "DE58110101002263909949",
                bic: process.env.SOLARIS_BIC,
                type: "CHECKING_BUSINESS",
                person_id: "mockpersonkontistgmbh",
                balance: {
                    value: 100,
                },
                sender_name: "unknown",
                locking_status: "",
                available_balance: {
                    value: 100,
                },
            },
        });
    }
};
const jsonToPerson = (value) => {
    if (!value) {
        throw new Error("did not find person");
    }
    const person = JSON.parse(value);
    person.transactions = person.transactions || [];
    return person;
};
exports.getPerson = async (personId) => {
    const person = await redisClient
        .getAsync(`${process.env.MOCKSOLARIS_REDIS_PREFIX}:person:${personId}`)
        .then(jsonToPerson);
    return augmentPerson(person);
};
exports.getTechnicalUserPerson = () => exports.getPerson("mockpersonkontistgmbh");
const addAmountValues = (a, b) => a + b.amount.value;
exports.savePerson = async (person, skipInterest = false) => {
    person.address = person.address || { country: null };
    const account = person.account;
    if (account) {
        const transactions = person.transactions || [];
        const queuedBookings = person.queuedBookings || [];
        const reservations = person.account.reservations || [];
        const now = new Date().getTime();
        const transactionsBalance = transactions
            .filter((transaction) => new Date(transaction.valuta_date).getTime() < now)
            .reduce(addAmountValues, 0);
        const confirmedTransfersBalance = queuedBookings
            .filter((booking) => booking.status === "accepted")
            .reduce(addAmountValues, 0);
        const reservationsBalance = reservations.reduce(addAmountValues, 0);
        const limitBalance = (account.account_limit && account.account_limit.value) || 0;
        if (transactionsBalance < 0 && !skipInterest) {
            overdraft_1.calculateOverdraftInterest(account, transactionsBalance);
        }
        account.balance = {
            value: transactionsBalance,
        };
        account.available_balance = {
            // Confirmed transfers amounts are negative
            value: limitBalance +
                transactionsBalance +
                confirmedTransfersBalance -
                reservationsBalance,
        };
        person.account = account;
        person.timedOrders = person.timedOrders || [];
    }
    const response = await redisClient.setAsync(`${process.env.MOCKSOLARIS_REDIS_PREFIX}:person:${person.id}`, JSON.stringify(person, undefined, 2));
    return response;
};
exports.getTaxIdentifications = async (personId) => JSON.parse((await redisClient.getAsync(`${process.env.MOCKSOLARIS_REDIS_PREFIX}:taxIdentifications:${personId}`)) || "[]");
exports.saveTaxIdentifications = async (personId, data) => redisClient.setAsync(`${process.env.MOCKSOLARIS_REDIS_PREFIX}:taxIdentifications:${personId}`, JSON.stringify(data, undefined, 2));
exports.getMobileNumber = async (personId) => JSON.parse(await redisClient.getAsync(`${process.env.MOCKSOLARIS_REDIS_PREFIX}:mobileNumber:${personId}`));
exports.saveMobileNumber = async (personId, data) => redisClient.setAsync(`${process.env.MOCKSOLARIS_REDIS_PREFIX}:mobileNumber:${personId}`, JSON.stringify(data, undefined, 2));
exports.deleteMobileNumber = async (personId) => redisClient.delAsync(`${process.env.MOCKSOLARIS_REDIS_PREFIX}:mobileNumber:${personId}`);
exports.getDevice = async (deviceId) => JSON.parse(await redisClient.getAsync(`${process.env.MOCKSOLARIS_REDIS_PREFIX}:device:${deviceId}`));
exports.getAllDevices = () => redisClient
    .keysAsync(`${process.env.MOCKSOLARIS_REDIS_PREFIX}:device:*`)
    .then((keys) => {
    if (keys.length < 1) {
        return [];
    }
    return redisClient.mgetAsync(keys);
})
    .then((values) => values.map((value) => JSON.parse(value)));
exports.getDevicesByPersonId = (personId) => exports.getAllDevices().then((devices) => devices.filter((device) => device.person_id === personId));
exports.saveDevice = async (device) => redisClient.setAsync(`${process.env.MOCKSOLARIS_REDIS_PREFIX}:device:${device.id}`, JSON.stringify(device, undefined, 2));
exports.getDeviceChallenge = async (challengeId) => JSON.parse(await redisClient.getAsync(`${process.env.MOCKSOLARIS_REDIS_PREFIX}:deviceChallenge:${challengeId}`));
exports.deleteDeviceChallenge = async (challengeId) => redisClient.delAsync(`${process.env.MOCKSOLARIS_REDIS_PREFIX}:deviceChallenge:${challengeId}`);
exports.saveDeviceChallenge = async (challenge) => redisClient.setAsync(`${process.env.MOCKSOLARIS_REDIS_PREFIX}:deviceChallenge:${challenge.id}`, JSON.stringify(challenge, undefined, 2));
exports.saveBooking = (accountId, booking) => {
    return exports.findPersonByAccountId(accountId)
        .then((person) => {
        person.transactions.push(booking);
        return person;
    })
        .then(exports.savePerson);
};
exports.getAllPersons = () => {
    return redisClient
        .keysAsync(`${process.env.MOCKSOLARIS_REDIS_PREFIX}:person:*`)
        .then((keys) => {
        if (keys.length < 1) {
            return [];
        }
        return redisClient.mgetAsync(keys);
    })
        .then((values) => values.map(jsonToPerson))
        .then((values) => values.sort((p1, p2) => {
        if (!p1.createdAt && p2.createdAt)
            return 1;
        if (p1.createdAt && !p2.createdAt)
            return -1;
        if (!p1.createdAt && !p2.createdAt)
            return 0;
        return p1.createdAt > p2.createdAt ? -1 : 1;
    }))
        .then((results) => results.map((person) => augmentPerson(person)));
};
const augmentPerson = (person) => {
    const augmented = lodash_1.default.cloneDeep(person);
    augmented.fraudCases = augmented.fraudCases || [];
    augmented.timedOrders = augmented.timedOrders || [];
    augmented.queuedBookings = person.queuedBookings || [];
    augmented.transactions = augmented.transactions || [];
    if (augmented.account) {
        augmented.account.reservations = augmented.account.reservations || [];
        augmented.account.fraudReservations =
            augmented.account.fraudReservations || [];
    }
    return augmented;
};
exports.getAllIdentifications = () => {
    return exports.getAllPersons().then((persons) => {
        return lodash_1.default.flattenDeep(persons.map((person) => {
            const identification = Object.values(person.identifications || {});
            identification.person = person;
            return identification;
        }));
    });
};
exports.findPersonByAccountField = async (findBy) => {
    const persons = await exports.getAllPersons();
    return persons.filter((person) => person.account).find(findBy);
};
exports.findPersonByAccountId = (accountId) => exports.findPersonByAccountField((person) => person.account.id === accountId ||
    (person.billing_account || {}).id === accountId);
exports.findPersonByAccountIBAN = (iban) => exports.findPersonByAccountField((person) => person.account.iban === iban);
exports.findPersonByEmail = (email) => {
    return exports.getAllPersons().then((persons) => {
        return persons.find((person) => person.email === email);
    });
};
exports.getWebhooks = async () => {
    const webhooks = await redisClient
        .keysAsync(`${process.env.MOCKSOLARIS_REDIS_PREFIX}:webhook:*`)
        .then((keys) => {
        if (keys.length < 1) {
            return [];
        }
        return redisClient.mgetAsync(keys);
    })
        .then((values) => values.map(JSON.parse));
    return webhooks;
};
exports.getWebhookByType = async (type) => (await exports.getWebhooks()).find((webhook) => webhook.event_type === type);
exports.getSepaDirectDebitReturns = async () => {
    const sepaDirectDebitReturns = JSON.parse((await redisClient.getAsync(`${process.env.MOCKSOLARIS_REDIS_PREFIX}:sepa_direct_debit_returns`)) || "[]");
    return sepaDirectDebitReturns;
};
exports.saveSepaDirectDebitReturn = async (sepaDirectDebitReturn) => {
    const sepaDirectDebitReturns = await exports.getSepaDirectDebitReturns();
    sepaDirectDebitReturns.push(sepaDirectDebitReturn);
    log.info("(mockSolaris/saveSepaDirectDebitReturn) Saving Sepa Direct Debit Return", sepaDirectDebitReturn);
    await redisClient.setAsync(`${process.env.MOCKSOLARIS_REDIS_PREFIX}:sepa_direct_debit_returns`, JSON.stringify(sepaDirectDebitReturns));
};
exports.saveWebhook = (webhook) => {
    return redisClient.setAsync(`${process.env.MOCKSOLARIS_REDIS_PREFIX}:webhook:${webhook.event_type}`, JSON.stringify(webhook, undefined, 2));
};
exports.flushDb = () => {
    return redisClient.flushdbAsync();
};
const fillMissingCurrencyForLegacyBooking = (booking) => ({
    ...booking,
    amount: {
        ...booking.amount,
        currency: booking.amount.currency || "EUR",
    },
});
exports.getPersonBookings = (person) => {
    return (person.transactions || []).map(fillMissingCurrencyForLegacyBooking);
};
exports.getSmsToken = async (personId) => {
    const person = await exports.getPerson(personId);
    return lodash_1.default.get(person, "changeRequest.token", null);
};
exports.getCardReferences = async () => JSON.parse((await redisClient.getAsync(`${process.env.MOCKSOLARIS_REDIS_PREFIX}:cardReferences`)) || "[]");
exports.hasCardReference = async (cardRef) => {
    const cardReferences = await exports.getCardReferences();
    return cardReferences.includes(cardRef);
};
exports.saveCardReference = async (cardRef) => {
    if (await exports.hasCardReference(cardRef)) {
        return false;
    }
    const cardReferences = await exports.getCardReferences();
    cardReferences.push(cardRef);
    await redisClient.setAsync(`${process.env.MOCKSOLARIS_REDIS_PREFIX}:cardReferences`, JSON.stringify(cardReferences));
    return true;
};
exports.getCardData = async (cardId) => {
    const persons = await exports.getAllPersons();
    const cardData = lodash_1.default(persons)
        .map((person) => lodash_1.default.get(person, "account.cards", []))
        .flatten()
        .value()
        .find((cardData) => cardData.card.id === cardId);
    return cardData;
};
exports.getPersonByFraudCaseId = async (fraudCaseId) => {
    const persons = await exports.getAllPersons();
    return persons.find((p) => p.fraudCases.find((c) => c.id === fraudCaseId) !== undefined);
};
exports.getCard = async (cardId) => (await exports.getCardData(cardId)).card;
//# sourceMappingURL=db.js.map