import { expect } from "chai";
import sinon from "sinon";
import { mockReq, mockRes } from "sinon-express-mock";
import * as db from "../../../src/db";
import * as businessTaxIdentifications from "../../../src/routes/business/taxIdentifications";
import generateID from "../../../src/helpers/id";

describe("Business Tax Identifications API", () => {
  let req: any;
  let res: any;
  let sandbox: sinon.SinonSandbox;
  let saveBusinessSpy: sinon.SinonSpy;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    res = mockRes();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("createBusinessTaxIdentification", () => {
    beforeEach(() => {
      req = mockReq({
        business: { taxIdentifications: [] },
        body: {
          number: "123456789",
          country: "DE",
          primary: true,
        },
      });

      saveBusinessSpy = sandbox.spy(db, "saveBusiness");
    });

    it("should create a new tax identification", async () => {
      await businessTaxIdentifications.createBusinessTaxIdentification(
        req,
        res
      );

      const response = res.send.lastCall.args[0];
      expect(response).to.have.property("id").that.is.a("string");
      expect(response).to.have.property("number", "123456789");
      expect(response).to.have.property("country", "DE");
      expect(saveBusinessSpy.calledOnce).to.be.true;
    });
  });

  describe("updateBusinessTaxIdentification", () => {
    let existingId: string;

    beforeEach(() => {
      existingId = generateID();

      req = mockReq({
        params: { id: existingId },
        business: {
          taxIdentifications: [
            {
              id: existingId,
              number: "123456789",
              country: "DE",
              primary: true,
            },
          ],
        },
        body: {
          number: "987654321",
        },
      });

      saveBusinessSpy = sandbox.spy(db, "saveBusiness");
    });

    it("should update an existing tax identification", async () => {
      await businessTaxIdentifications.updateBusinessTaxIdentification(
        req,
        res
      );

      const response = res.send.lastCall.args[0];
      expect(response).to.have.property("number", "987654321");
      expect(saveBusinessSpy.calledOnce).to.be.true;
    });

    it("should return 404 if tax identification is not found", async () => {
      req.params.id = "non-existent-id";

      await businessTaxIdentifications.updateBusinessTaxIdentification(
        req,
        res
      );

      const response = res.send.lastCall.args[0];
      expect(response.errors[0]).to.have.property("status", 404);
    });
  });

  describe("listBusinessTaxIdentifications", () => {
    beforeEach(() => {
      req = mockReq({
        business: {
          taxIdentifications: [
            { id: generateID(), number: "123456789", country: "DE" },
            { id: generateID(), number: "987654321", country: "FR" },
          ],
        },
      });
    });

    it("should return a list of tax identifications", async () => {
      await businessTaxIdentifications.listBusinessTaxIdentifications(req, res);

      const response = res.send.lastCall.args[0];
      expect(response).to.be.an("array").with.lengthOf(2);
    });
  });

  describe("getBusinessTaxIdentification", () => {
    let existingId: string;

    beforeEach(() => {
      existingId = generateID();

      req = mockReq({
        params: { id: existingId },
        business: {
          taxIdentifications: [
            { id: existingId, number: "123456789", country: "DE" },
          ],
        },
      });
    });

    it("should return a tax identification by ID", async () => {
      await businessTaxIdentifications.getBusinessTaxIdentification(req, res);

      const response = res.send.lastCall.args[0];
      expect(response).to.have.property("number", "123456789");
      expect(response).to.have.property("country", "DE");
    });

    it("should return 404 if tax identification is not found", async () => {
      req.params.id = "non-existent-id";

      await businessTaxIdentifications.getBusinessTaxIdentification(req, res);

      const response = res.send.lastCall.args[0];
      expect(response.errors[0]).to.have.property("status", 404);
    });
  });
});
