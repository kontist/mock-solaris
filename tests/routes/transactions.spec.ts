import sinon from "sinon";
import { expect } from "chai";
import { mockReq, mockRes } from "sinon-express-mock";

import * as db from "../../src/db";
import * as transactions from "../../src/routes/transactions";
import { createPerson } from "../../src/routes/persons";

describe("Transactions", () => {
  describe("directDebitRefund", () => {
    let res;
    const createPersonReq = {
      body: {},
      headers: {},
    };

    beforeEach(async () => {
      await db.flushDb();
      res = {
        status: sinon.stub().callsFake(() => res),
        send: sinon.stub(),
      };
    });

    const req = (personId) => ({
      params: {
        person_id: personId,
        account_id: "account-id",
      },
      body: {
        booking_id: "booking-id",
      },
    });

    describe("when person exists", () => {
      it("should return change request response", async () => {
        await createPerson(createPersonReq, res);
        const personId = res.send.firstCall.args[0].id;
        await transactions.directDebitRefund(req(personId), res);

        const response = res.send.lastCall.args[0];
        expect(response.status).to.eq("AUTHORIZATION_REQUIRED");
      });

      it("should save change request in person", async () => {
        await createPerson(createPersonReq, res);
        const personId = res.send.firstCall.args[0].id;
        await transactions.directDebitRefund(req(personId), res);
        const updatedPerson = await db.getPerson(personId);

        expect(updatedPerson.changeRequest.method).to.eq(
          transactions.DIRECT_DEBIT_REFUND_METHOD
        );
      });
    });
  });

  describe("createSepaCreditTransfer", () => {
    let clock;

    after(() => {
      clock.restore();
    });

    it("should throw error if verification of payee is required and not passed", async () => {
      // 1st November 2025
      clock = sinon.useFakeTimers(new Date(2025, 10, 1).getTime());

      const req = mockReq({
        params: {
          person_id: "person-id",
          account_id: "account-id",
        },
        body: {},
      });
      const res = mockRes();

      await transactions.createSepaCreditTransfer(req, res);

      expect(res.status.calledWith(400)).to.be.true;
      expect(res.send.calledOnce).to.be.true;
      expect(res.send.args[0][0].errors[0].detail).to.deep.equal(
        "Verification of payee is required."
      );
    });
  });
});
