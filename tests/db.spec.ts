import { expect } from "chai";
import { mockReq, mockRes } from "sinon-express-mock";
import {
  findPerson,
  findPersonByAccountId,
  findPersons,
  flushDb,
  getCardData,
  getPersonByFraudCaseId,
  getPersonBySpendingLimitId,
} from "../src/db";
import { createPerson } from "../src/routes/persons";
import { MockAccount, MockCreatePerson } from "../src/helpers/types";

import {
  mockAccount,
  mockCard,
  mockCardSpendingLimitControl,
  mockCreatePerson,
  mockFraudCase,
  mockPostboxItem,
} from "./mockData";
import { getPostboxItemById } from "../src/routes/postbox";

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
      await createPerson(req, res);
    }
    const persons = await findPersons();
    expect(persons.length).to.equal(numPersons);
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

  it("findPerson() returns NULL if the person is not found", async () => {
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

  describe("findPersonByAccountId()", async () => {
    it("findPersonByAccountId finds person by account id if account id is set", async () => {
      const body = { ...mockCreatePerson, account: mockAccount };
      const req = mockReq({ body, headers });
      const res = mockRes();
      await createPerson(req, res);
      const person = await findPersonByAccountId(body.account.id);
      expect(person).to.be.ok;
    });

    it("findPersonByAccountId finds person by account id if billing_account is set", async () => {
      const body: MockCreatePerson = {
        ...mockCreatePerson,
        account: mockAccount,
        billing_account: { id: "billingAccount1" },
      };
      const reqBillingAccount = mockReq({ body, headers });
      const resBillingAccount = mockRes();
      await createPerson(reqBillingAccount, resBillingAccount);
      const person = await findPersonByAccountId(body.billing_account.id);
      expect(person).to.be.ok;
    });

    it("findPersonByAccountId doesn't throw and returns null if no users have an account with the specified account id", async () => {
      const body: MockCreatePerson = {
        ...mockCreatePerson,
        account: mockAccount,
      };
      delete body.account;
      const reqNoProp = mockReq({ body, headers });
      const resNoProp = mockRes();
      await createPerson(reqNoProp, resNoProp);
      const person = await findPersonByAccountId("N/A");
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

    it("getCardData() returns card data if card data is not set", async () => {
      const body: MockCreatePerson = {
        ...mockCreatePerson,
        account: mockAccount,
      };
      const req = mockReq({ body, headers });
      const res = mockRes();
      await createPerson(req, res);
      const cardData = await getCardData("N/A");
      expect(cardData).to.be.null;
    });

    it("getPersonByFraudCaseId() returns person by fraud case id if fraud case exists", async () => {
      const body: MockCreatePerson = {
        ...mockCreatePerson,
        account: mockAccount,
      };
      body.fraudCases.push(mockFraudCase);
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
      const person = await getPersonByFraudCaseId(mockFraudCase.id);
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
      expect(person).to.be.ok;
    });

    it("getPersonBySpendingLimitId() returns null if spending limit is not applied", async () => {
      const body: MockCreatePerson = {
        ...mockCreatePerson,
        account: { ...mockAccount, cards: [{ ...mockCard, controls: [] }] },
      };
      const req = mockReq({ body, headers });
      const res = mockRes();
      await createPerson(req, res);
      const person = await getPersonBySpendingLimitId(
        mockCardSpendingLimitControl.id
      );
      expect(person).to.be.null;
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

    it("getPostboxItemById() doesn't throw and returns null if postbox item is not found", async () => {
      const body: MockCreatePerson = {
        ...mockCreatePerson,
        account: mockAccount,
        postboxItems: undefined,
      };
      const req = mockReq({ body, headers });
      const res = mockRes();
      await createPerson(req, res);
      const postboxItem = await getPostboxItemById(mockPostboxItem.id);
      expect(postboxItem).to.be.null;
    });
  });
});
