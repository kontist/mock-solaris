import sinon from "sinon";
import { expect } from "chai";
import { mockReq, mockRes } from "sinon-express-mock";

import { verifyPayee } from "../../src/routes/verificationOfPayee";

describe("VerificationOfPayee", () => {
  describe("verifyPayee", () => {
    describe("should throw validation errors", () => {
      it("should return a 400 error if IBAN is missing", async () => {
        const req = mockReq({
          body: {
            name: "John Doe",
          },
        });
        const res = mockRes();

        await verifyPayee(req, res);

        expect(res.status.calledWith(400)).to.be.true;
        expect(res.send.calledOnce).to.be.true;
      });

      it("should return a 400 error if name is missing", async () => {
        const req = mockReq({
          body: {
            iban: "DE89370400440532013000",
          },
        });
        const res = mockRes();

        await verifyPayee(req, res);

        expect(res.status.calledWith(400)).to.be.true;
        expect(res.send.calledOnce).to.be.true;
      });

      it("should return a 400 error if name is invalid", async () => {
        const req = mockReq({
          body: {
            iban: "DE89370400440532013000",
            name: "Tooooooooo looooooooooooooong of a naaaaaaaaaaaaaaame Tooooooooo looooooooooooooong of a naaaaaaaaaaaaaaame Tooooooooo looooooooooooooong of a naaaaaaaaaaaaaaame",
          },
        });
        const res = mockRes();

        await verifyPayee(req, res);

        expect(res.status.calledWith(400)).to.be.true;
        expect(res.send.calledOnce).to.be.true;
      });
    });

    describe("should return the correct payload with appropriate status", () => {
      it("should return MATCH for any default name", async () => {
        const req = mockReq({
          body: {
            iban: "DE89370400440532013000",
            name: "John Doe",
          },
        });
        const res = mockRes();

        await verifyPayee(req, res);

        expect(res.status.calledWith(200)).to.be.true;
        expect(res.send.calledOnce).to.be.true;
        expect(res.send.args[0][0].payee.iban).to.deep.equal(
          "DE89370400440532013000"
        );
        expect(res.send.args[0][0].payee.name).to.deep.equal("John Doe");
        expect(res.send.args[0][0].result.status).to.deep.equal("MATCH");
      });

      it("should return NO_MATCH for a specific name", async () => {
        const req = mockReq({
          body: {
            iban: "DE89370400440532013000",
            name: "John no match",
          },
        });
        const res = mockRes();

        await verifyPayee(req, res);

        expect(res.status.calledWith(200)).to.be.true;
        expect(res.send.calledOnce).to.be.true;
        expect(res.send.args[0][0].payee.iban).to.deep.equal(
          "DE89370400440532013000"
        );
        expect(res.send.args[0][0].payee.name).to.deep.equal("John no match");
        expect(res.send.args[0][0].result.status).to.deep.equal("NO_MATCH");
      });

      it("should return VERIFICATION_NOT_POSSIBLE for a specific name", async () => {
        const req = mockReq({
          body: {
            iban: "DE89370400440532013000",
            name: "John not possible",
          },
        });
        const res = mockRes();

        await verifyPayee(req, res);

        expect(res.status.calledWith(200)).to.be.true;
        expect(res.send.calledOnce).to.be.true;
        expect(res.send.args[0][0].payee.iban).to.deep.equal(
          "DE89370400440532013000"
        );
        expect(res.send.args[0][0].payee.name).to.deep.equal(
          "John not possible"
        );
        expect(res.send.args[0][0].result.status).to.deep.equal(
          "VERIFICATION_NOT_POSSIBLE"
        );
      });

      it("should return CLOSE_MATCH for a specific name", async () => {
        const req = mockReq({
          body: {
            iban: "DE89370400440532013000",
            name: "John close match",
          },
        });
        const res = mockRes();

        await verifyPayee(req, res);

        expect(res.status.calledWith(200)).to.be.true;
        expect(res.send.calledOnce).to.be.true;
        expect(res.send.args[0][0].payee.iban).to.deep.equal(
          "DE89370400440532013000"
        );
        expect(res.send.args[0][0].payee.name).to.deep.equal(
          "John close match"
        );
        expect(res.send.args[0][0].result.status).to.deep.equal("CLOSE_MATCH");
        expect(res.send.args[0][0].result.suggested_name).to.deep.equal(
          "Giovanni Kontistini"
        );
      });
    });
  });
});
