import { expect } from "chai";
import sinon from "sinon";
import { mockReq, mockRes } from "sinon-express-mock";
import * as db from "../../../src/db";

import * as businessesAPI from "../../../src/routes/business/businesses";
import * as personsAPI from "../../../src/routes/persons";
import { createLegalRepresentative } from "../../../src/routes/business/legalRepresentative";

describe("createLegalRepresentative", () => {
  let res: sinon.SinonSpy;

  describe("when business is found", () => {
    let businessId: string;
    let personId: string;
    let req;

    before(async () => {
      await db.flushDb();
      res = mockRes();

      res = mockRes();
      await personsAPI.createPerson(
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

      businessId = res.send.args[0][0].id;

      res = mockRes();
      req = mockReq({
        params: {
          business_id: businessId,
        },
        body: {
          legal_representative_id: personId,
          type_of_representation: "ALONE",
        },
        business: {
          id: businessId,
        },
        person: {
          id: personId,
        },
      });
      await createLegalRepresentative(req, res);
    });

    it("should return created legal representative", () => {
      const lastCall = res.send.args[res.send.args.length - 1];
      expect(lastCall[0].business_id).to.equal(businessId);
      expect(lastCall[0].legal_representative_id).to.equal(
        req.body.legal_representative_id
      );
    });

    it("should add legal representative to business", async () => {
      const business = await db.getBusiness(businessId);
      expect(business.legalRepresentatives.length).to.equal(1);
      expect(business.legalRepresentatives[0].business_id).to.equal(businessId);
      expect(business.legalRepresentatives[0].legal_representative_id).to.equal(
        req.body.legal_representative_id
      );
    });

    it("should add business id to person", async () => {
      const person = await db.getPerson(personId);
      expect(person.businessId).to.equal(businessId);
    });
  });
});
