import { expect } from "chai";
import { mockReq, mockRes } from "sinon-express-mock";
import Bluebird from "bluebird";

import {
  findBusiness,
  findBusinesses,
  findPerson,
  findPersonByAccount,
  findPersons,
  flushDb,
  getCardData,
  getPersonByFraudCaseId,
  getPersonBySpendingLimitId,
} from "../src/db";
import { createPerson } from "../src/routes/persons";
import { MockCreatePerson } from "../src/helpers/types";

import {
  mockAccount,
  mockCard,
  mockCardSpendingLimitControl,
  mockCreatePerson,
  mockFraudCase,
  mockPostboxItem,
} from "./mockData";
import { getPostboxItemById } from "../src/routes/postbox";
import { createBusiness } from "../src/routes/business";

describe("getPersons()", async () => {
  const headers = { origin: "Kontist HQ" };
  beforeEach(flushDb);
  afterEach(flushDb);

  it(`findPersons() returns all persons`, async () => {
    const numPersons = 5;
    for (let i = 1; i <= numPersons; i++) {
      const req = mockReq({
        body: {
          email: `user${i}@kontist.com`,
        },
        headers,
      });
      const res = mockRes();
      await Bluebird.delay(10);
      await createPerson(req, res);
    }
    const persons = await findPersons();
    expect(persons.length).to.equal(numPersons);
    expect(persons[0].email).to.equal(`user${numPersons}@kontist.com`);
  });

  it(`findPersons() filter when cb function is provided, but not limit`, async () => {
    const req = mockReq({
      body: {
        email: `superuser@kontist.com`,
      },
      headers,
    });
    const res = mockRes();
    await createPerson(req, res);
    const persons = await findPersons({
      callbackFn: (person) => person.email.endsWith("@kontist.com"),
    });
    expect(persons.length).to.equal(1);
  });

  it("findPerson() returns a person if the person is found", async () => {
    const email = `person@person.com`;
    const req = mockReq({
      body: {
        email,
      },
      headers,
    });
    const res = mockRes();
    await createPerson(req, res);
    const person = await findPerson((p) => p.email === email);
    expect(person).to.be.ok;
  });

  it("findPerson() returns null if the person is not found", async () => {
    const email = `person@person.com`;
    const req = mockReq({
      body: {
        email,
      },
      headers,
    });
    const res = mockRes();
    await createPerson(req, res);
    const person = await findPerson((p) => p.email === `notTheSame${email}`);
    expect(person).to.be.null;
  });

  it("findPersonByAccount finds person by account id if account id is set", async () => {
    const body = { ...mockCreatePerson, account: mockAccount };
    const req = mockReq({ body, headers });
    const res = mockRes();
    await createPerson(req, res);
    const person = await findPersonByAccount({ id: body.account.id });
    expect(person).to.be.ok;
  });

  it("findPersonByAccount finds person by IBAN", async () => {
    const body = { ...mockCreatePerson, account: mockAccount };
    const req = mockReq({ body, headers });
    const res = mockRes();
    await createPerson(req, res);
    const person = await findPersonByAccount({ iban: mockAccount.iban });
    expect(person).to.be.ok;
  });

  it("findPersonByAccount doesn't throw and returns null if no users have an account with the specified account id", async () => {
    const body: MockCreatePerson = {
      ...mockCreatePerson,
      account: mockAccount,
    };
    delete body.account;
    const reqNoProp = mockReq({ body, headers });
    const resNoProp = mockRes();
    await createPerson(reqNoProp, resNoProp);
    const person = await findPersonByAccount({ id: "N/A" });
    expect(person).to.be.null;
  });

  it("getCardData() returns card data if card data is set", async () => {
    const body: MockCreatePerson = {
      ...mockCreatePerson,
      account: mockAccount,
    };
    body.account.cards.push({ ...mockCard });

    const req = mockReq({ body, headers });
    const res = mockRes();
    await createPerson(req, res);
    const cardData = await getCardData(mockCard.card.id);
    expect(cardData).to.be.ok;
  });

  it("getCardData() returns falsy value if card data is not set", async () => {
    const body: MockCreatePerson = {
      ...mockCreatePerson,
      account: mockAccount,
    };
    const req = mockReq({ body, headers });
    const res = mockRes();
    await createPerson(req, res);
    const cardData = await getCardData("N/A");
    expect(cardData).not.to.be.ok;
  });

  it("getPersonByFraudCaseId() returns person by fraud case id if fraud case exists", async () => {
    const body: MockCreatePerson = {
      ...mockCreatePerson,
      account: mockAccount,
      fraudCases: [mockFraudCase],
    };
    const req = mockReq({ body, headers });
    const res = mockRes();
    await createPerson(req, res);
    const person = await getPersonByFraudCaseId(mockFraudCase.id);
    expect(person).to.be.ok;
  });

  it("getPersonByFraudCaseId() returns null if fraud case doesn't exist", async () => {
    const body: MockCreatePerson = {
      ...mockCreatePerson,
      account: mockAccount,
    };
    const req = mockReq({ body, headers });
    const res = mockRes();
    await createPerson(req, res);
    const person = await getPersonByFraudCaseId("N/A");
    expect(person).to.be.null;
  });

  it("getPersonBySpendingLimitId() returns person if spending limit is applied", async () => {
    const body: MockCreatePerson = {
      ...mockCreatePerson,
      account: {
        ...mockAccount,
        cards: [{ ...mockCard, controls: [mockCardSpendingLimitControl] }],
      },
    };
    const req = mockReq({ body, headers });
    const res = mockRes();
    await createPerson(req, res);
    const person = await getPersonBySpendingLimitId(
      mockCardSpendingLimitControl.id
    );
    expect(person.person).to.be.ok;
    expect(person.cardData).to.be.ok;
  });

  it("getPersonBySpendingLimitId() returns falsy values if spending limit is not applied", async () => {
    const body: MockCreatePerson = {
      ...mockCreatePerson,
      account: { ...mockAccount, cards: [{ ...mockCard, controls: [] }] },
    };
    const req = mockReq({ body, headers });
    const res = mockRes();
    await createPerson(req, res);
    const response = await getPersonBySpendingLimitId("N/A");
    expect(response.person).not.to.be.ok;
    expect(response.cardData).not.to.be.ok;
  });

  it("getPostboxItemById() returns postbox items by id if postbox item is found", async () => {
    const body: MockCreatePerson = {
      ...mockCreatePerson,
      account: mockAccount,
      postboxItems: [mockPostboxItem],
    };
    const req = mockReq({ body, headers });
    const res = mockRes();
    await createPerson(req, res);
    const person = await getPostboxItemById(mockPostboxItem.id);
    expect(person).to.be.ok;
  });

  it("getPostboxItemById() doesn't throw and returns undefined if postbox item is not found", async () => {
    const body: MockCreatePerson = {
      ...mockCreatePerson,
      account: mockAccount,
      postboxItems: undefined,
    };
    const req = mockReq({ body, headers });
    const res = mockRes();
    await createPerson(req, res);
    const postboxItem = await getPostboxItemById(mockPostboxItem.id);
    expect(postboxItem).to.be.undefined;
  });
});

describe("Gets Businesses", async () => {
  const headers = { origin: "Kontist HQ" };
  beforeEach(flushDb);
  afterEach(flushDb);

  it(`findBusinesses() returns all businesses`, async () => {
    const numBusinesses = 5;
    for (let i = 1; i <= numBusinesses; i++) {
      const req = mockReq({
        body: {
          name: `Konstist ${i}`,
        },
        headers,
      });
      const res = mockRes();
      await Bluebird.delay(10);
      await createBusiness(req, res);
    }

    const businesses = await findBusinesses();
    expect(businesses.length).to.equal(numBusinesses);
    expect(businesses[0].name).to.equal(`Konstist ${numBusinesses}`);
  });

  it(`findBusinesses() filter when cb function is provided, but not limit`, async () => {
    const req = mockReq({
      body: {
        name: `Kontist GmbH`,
      },
      headers,
    });
    const res = mockRes();
    await createBusiness(req, res);

    const businesses = await findBusinesses({
      callbackFn: (business) => business.name.endsWith("GmbH"),
    });
    expect(businesses.length).to.equal(1);
  });

  it("findBusiness() returns a business if the business is found", async () => {
    const name = `Kontist GmbH`;
    const req = mockReq({
      body: {
        name,
      },
      headers,
    });
    const res = mockRes();
    await createBusiness(req, res);

    const business = await findBusiness((b) => b.name === name);
    expect(business).to.be.ok;
  });

  it("findBusiness() returns null if the business is not found", async () => {
    const name = `Kontist GmbH`;
    const req = mockReq({
      body: {
        name,
      },
      headers,
    });
    const res = mockRes();
    await createBusiness(req, res);

    const business = await findBusiness((b) => b.name === "Different Name");
    expect(business).to.be.null;
  });
});
