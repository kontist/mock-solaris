import sinon from "sinon";
import { expect } from "chai";

import * as db from "../../src/db";
import * as transactions from "../../src/routes/transactions";
import { createPerson } from "../../src/routes/persons";

describe("Transactions", () => {
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

  describe("directDebitRefund", () => {
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
});
