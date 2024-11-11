import { expect } from "chai";
import sinon from "sinon";
import { mockReq, mockRes } from "sinon-express-mock";
import * as db from "../../../src/db";

import * as businessesAPI from "../../../src/routes/business/businesses";
import { createLegalRepresentative } from "../../../src/routes/business/legalRepresentative";

describe("createLegalRepresentative", () => {
  let res: sinon.SinonSpy;

  describe("when business is not found", () => {
    before(async () => {
      await db.flushDb();
      res = mockRes();
      const req = mockReq({
        params: {
          business_id: "1234abc",
        },
        body: {
          person_id: "1234abcdef",
          voting_share: 0.5,
          fictitious: false,
          relationship_to_business: "owner",
        },
      });
      await createLegalRepresentative(req, res);
    });

    it("should return 404", () => {
      expect(res.send.args[0][0].errors[0].status).to.equal(404);
    });
  });

  describe("when business is found", () => {
    let businessId: string;
    let req;

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
      req = mockReq({
        params: {
          business_id: businessId,
        },
        body: {
          person_id: "1234abcdef",
          voting_share: 0.5,
          fictitious: false,
          relationship_to_business: "owner",
        },
      });
      await createLegalRepresentative(req, res);
    });

    it("should return created legal representative", () => {
      const lastCall = res.send.args[res.send.args.length - 1];
      expect(lastCall[0].business_id).to.equal(businessId);
      expect(lastCall[0].legal_representative_id).to.equal(req.body.person_id);
    });

    it("should add legal representative to business", async () => {
      const business = await db.getBusiness(businessId);
      expect(business.legalRepresentatives.length).to.equal(1);
      expect(business.legalRepresentatives[0].business_id).to.equal(businessId);
      expect(business.legalRepresentatives[0].legal_representative_id).to.equal(
        req.body.person_id
      );
    });
  });
});
