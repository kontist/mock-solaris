import { expect } from "chai";
import sinon from "sinon";
import { mockReq, mockRes } from "sinon-express-mock";
import * as db from "../../../src/db";

import * as businessesAPI from "../../../src/routes/business/businesses";
import { createAuthorizedPerson } from "../../../src/routes/business/authorizedPerson";
import {
  AccountType,
  CustomerType,
  ProductType,
} from "../../../src/helpers/types";
import { createAccount } from "../../../src/routes/accounts";
import { createPerson } from "../../../src/routes/persons";

describe("createAuthorizedPerson", () => {
  let res: sinon.SinonSpy;
  let personId: string;
  let businessId: string;
  let accountId: string;
  let req;

  before(async () => {
    await db.flushDb();
    res = mockRes();

    await createPerson(
      {
        body: {},
        headers: {},
      },
      res
    );

    personId = res.send.args[0][0].id;

    await businessesAPI.createBusiness(
      {
        body: {
          name: "Kontist GmbH",
        },
        headers: {},
      },
      res
    );

    businessId = res.send.args[1][0].id;

    const account = await createAccount(
      businessId,
      {
        product_name: ProductType.CURRENT_ACCOUNT_BUSINESS_GERMANY,
        account_type: AccountType.CHECKING_BUSINESS,
        account_currency: "EUR",
        account_purpose: "primary",
        account_bic: process.env.SOLARIS_BIC,
      },
      CustomerType.BUSINESS
    );
    accountId = account.id;
  });

  describe("success case", () => {
    before(async () => {
      req = mockReq({
        params: {
          business_id: businessId,
          account_id: accountId,
        },
        body: {
          authorized_person_id: personId,
        },
        business: {
          id: businessId,
        },
      });

      await createAuthorizedPerson(req, res);
    });
    it("should return created authorized person", () => {
      const lastCall = res.send.args[res.send.args.length - 1];
      expect(lastCall[0].authorized_person_id).to.equal(
        req.body.authorized_person_id
      );
    });

    it("should add authorized person to business", async () => {
      const business = await db.getBusiness(businessId);
      expect(business.authorizedPersons.length).to.equal(1);
      expect(business.authorizedPersons[0].authorized_person_id).to.equal(
        req.body.authorized_person_id
      );
    });
  });

  describe("error case", () => {
    it("should return 400 if authorized_person_id is missing", async () => {
      res = mockRes();
      req = mockReq({
        params: {
          business_id: businessId,
          account_id: accountId,
        },
        body: {},
        business: {
          id: businessId,
        },
      });
      await createAuthorizedPerson(req, res);

      const lastCall = res.send.args[res.send.args.length - 1];
      expect(lastCall[0].errors[0].status).to.equal(400);
      expect(lastCall[0].errors[0].code).to.equal("missing_field");
      expect(lastCall[0].errors[0].title).to.equal("Missing Field");
      expect(lastCall[0].errors[0].detail).to.equal("Invalid request.");
    });

    it("should return 403 if businessId and accountId does not belong to each other", async () => {
      res = mockRes();
      req = mockReq({
        params: {
          business_id: businessId,
          account_id: "invalid_account_id",
        },
        body: {
          authorized_person_id: personId,
        },
        business: {
          id: businessId,
        },
      });
      await createAuthorizedPerson(req, res);

      const lastCall = res.send.args[res.send.args.length - 1];
      expect(lastCall[0].errors[0].status).to.equal(403);
      expect(lastCall[0].errors[0].code).to.equal("forbidden");
      expect(lastCall[0].errors[0].title).to.equal("Forbidden");
      expect(lastCall[0].errors[0].detail).to.equal(
        "You are not authorized to perform this action."
      );
    });
  });
});
