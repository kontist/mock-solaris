import { expect } from "chai";
import sinon from "sinon";
import { mockReq, mockRes } from "sinon-express-mock";
import * as db from "../../../src/db";

import * as businessesAPI from "../../../src/routes/business/businesses";
import { createPerson } from "../../../src/routes/persons";
import { createBusinessIdentification } from "../../../src/routes/business/identification";
import {
  BusinessIdentificationStatus,
  LegalIdentificationStatus,
} from "../../../src/helpers/types";

describe("createBusinessIdentification", () => {
  let res: sinon.SinonSpy;

  describe("success case", () => {
    let businessId: string;
    let personId: string;
    let req;

    before(async () => {
      await db.flushDb();
      res = mockRes();

      req = mockReq({
        body: {
          email: "superuser@kontist.com",
        },
        headers: {},
      });
      await createPerson(req, res);

      personId = res.send.args[0][0].id;

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

      businessId = res.send.lastCall.args[0].id;

      req = mockReq({
        params: {
          business_id: businessId,
        },
        business: {
          id: businessId,
          legalRepresentatives: [
            {
              id: "1234abcdef",
              legal_representative_id: personId,
            },
          ],
        },
      });

      await createBusinessIdentification(req, res);
    });

    it("should return created business identification", () => {
      const response = res.send.lastCall.args[0];

      expect(response.business_id).to.equal(businessId);
      expect(response.status).to.equal(BusinessIdentificationStatus.CREATED);
      expect(response.legal_identification_status).to.equal(
        LegalIdentificationStatus.CREATED
      );
      expect(response.legal_representatives.length).to.equal(1);

      const legalRep = response.legal_representatives[0];
      expect(legalRep.person_id).to.equal(personId);
      expect(legalRep.identifications.length).to.equal(1);

      const identification = legalRep.identifications[0];
      expect(identification.status).to.equal("pending");
      expect(identification.url).to.be.a("string");
    });

    it("should store identification on business", async () => {
      const business = await db.getBusiness(businessId);

      expect(business.identifications.length).to.equal(1);
    });

    it("should store identification on person", async () => {
      const person = await db.getPerson(personId);

      expect(Object.values(person.identifications).length).to.equal(1);
    });
  });
});
