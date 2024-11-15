import sinon from "sinon";
import { expect } from "chai";
import { mockRes } from "sinon-express-mock";

import * as db from "../../../src/db";
import * as businessesAPI from "../../../src/routes/business/businesses";

describe("Businesses", () => {
  describe("createBusiness", () => {
    let res: sinon.SinonSpy;
    let businessId: string;

    before(async () => {
      await db.flushDb();
      res = mockRes();
      await businessesAPI.createBusiness(
        {
          body: {
            name: "Kontist GmbH",
          },
          headers: {},
        },
        res
      );

      businessId = res.send.args[0][0].id;
    });

    it("should return created business", async () => {
      const lastCall = res.send.args[res.send.args.length - 1];
      expect(lastCall[0].id).to.equal(businessId);
    });
  });

  describe("showBusiness", () => {
    let res: sinon.SinonSpy;
    let businessId: string;

    before(async () => {
      await db.flushDb();
      res = mockRes();
      await businessesAPI.createBusiness(
        {
          body: {
            name: "Kontist GmbH",
          },
          headers: {},
        },
        res
      );

      businessId = res.send.args[0][0].id;

      res = mockRes();
      await businessesAPI.showBusiness(
        {
          params: {
            business_id: businessId,
          },
        },
        res
      );
    });

    it("should return business data", async () => {
      const lastCall = res.send.args[res.send.args.length - 1];
      expect(lastCall[0].id).to.equal(businessId);
    });
  });

  describe("showBusinesses", () => {
    let res: sinon.SinonSpy;

    before(async () => {
      await db.flushDb();
      res = mockRes();
      await businessesAPI.createBusiness(
        {
          body: {
            name: "Kontist GmbH",
          },
          headers: {},
        },
        res
      );

      res = mockRes();
      await businessesAPI.showBusinesses(
        {
          headers: {},
          query: { page: { size: 10, number: 1 } },
        },
        res
      );
    });

    it("should return businesses data", async () => {
      const lastCall = res.send.args[res.send.args.length - 1];
      expect(lastCall[0].length).to.equal(1);
    });
  });

  describe("updateBusiness", () => {
    let res: sinon.SinonSpy;
    let businessId: string;

    before(async () => {
      await db.flushDb();
      res = mockRes();
      await businessesAPI.createBusiness(
        {
          body: {
            name: "Kontist GmbH",
          },
          headers: {},
        },
        res
      );

      businessId = res.send.args[0][0].id;

      res = mockRes();
      await businessesAPI.updateBusiness(
        {
          params: {
            business_id: businessId,
          },
          body: {
            name: "Kontist AG",
          },
        },
        res
      );
    });

    it("should return updated business", async () => {
      const lastCall = res.send.args[res.send.args.length - 1];
      expect(lastCall[0].name).to.equal("Kontist AG");
    });

    it("should have updated the business in the db", async () => {
      const business = await db.getBusiness(businessId);
      expect(business.name).to.equal("Kontist AG");
    });
  });

  describe("Get Business Account", () => {
    let res: sinon.SinonSpy;

    it("should return error when no account", async () => {
      await db.flushDb();

      res = mockRes();
      await businessesAPI.getBusinessAccount(
        {
          params: {
            business_id: "321",
            id: "1234",
          },
          business: {
            id: "321",
          },
        },
        res
      );

      const response = res.send.lastCall.args[0];
      expect(response.errors[0]).to.have.property("status", 404);
    });

    it("should return account", async () => {
      const businessId = "321";
      const accountId = "1234";
      await db.flushDb();

      res = mockRes();
      await businessesAPI.getBusinessAccount(
        {
          params: {
            business_id: businessId,
            id: accountId,
          },
          business: {
            id: businessId,
            account: {
              id: accountId,
            },
          },
        },
        res
      );

      const lastCall = res.send.args[res.send.args.length - 1];
      expect(lastCall[0].id).to.equal(accountId);
    });
  });
});
