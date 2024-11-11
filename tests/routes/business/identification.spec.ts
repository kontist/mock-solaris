import { expect } from "chai";
import sinon from "sinon";
import { mockReq, mockRes } from "sinon-express-mock";
import * as db from "../../../src/db";

import * as businessesAPI from "../../../src/routes/business/businesses";
import { createPerson } from "../../../src/routes/persons";
import {
  createBusinessIdentification,
  retrieveBusinessIdentification,
} from "../../../src/routes/business/identification";
import {
  BusinessIdentificationStatus,
  LegalIdentificationStatus,
} from "../../../src/helpers/types";

describe("Business Identification", () => {
  let res: sinon.SinonSpy;
  let businessId: string;
  let personId: string;
  let req;

  const createIdentification = async () => {
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
  };

  describe("createBusinessIdentification", () => {
    describe("success case", () => {
      createIdentification();

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

  describe("retrieveBusinessIdentification", () => {
    createIdentification();

    describe("success case", () => {
      let identificationId: string;

      before(async () => {
        const business = await db.getBusiness(businessId);
        identificationId = business.identifications[0].id;

        res = mockRes();
        req = mockReq({
          params: {
            business_id: businessId,
            identification_id: identificationId,
          },
          business,
        });

        await retrieveBusinessIdentification(req, res);
      });

      it("should return business identification", () => {
        const response = res.send.lastCall.args[0];

        expect(response.id).to.equal(identificationId);
      });
    });

    describe("when identification is not found", () => {
      before(async () => {
        const business = await db.getBusiness(businessId);

        res = mockRes();
        req = mockReq({
          params: {
            business_id: businessId,
            identification_id: "random-id",
          },
          business,
        });

        await retrieveBusinessIdentification(req, res);
      });

      it("should throw an error", () => {
        const response = res.send.lastCall.args[0];
        expect(response.errors[0].status).to.equal(404);
      });
    });
  });
});
