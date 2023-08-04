import sinon from "sinon";
import { expect } from "chai";
import { mockReq, mockRes } from "sinon-express-mock";

import * as db from "../../src/db";

import * as timedOrdersApi from "../../src/routes/timedOrders";
import { createPerson } from "../../src/routes/persons";
import * as changeRequestApi from "../../src/routes/changeRequest";
import { DeliveryMethod } from "../../src/helpers/types";

describe("Timed Orders", () => {
  describe("createTimedOrder", () => {
    let res: sinon.SinonSpy;
    let personId: string;
    let changeRequestId: string;

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

      const req = mockReq({
        params: {
          person_id: personId,
        },
        body: {
          change_request_enabled: true,
          execute_at: "2021-01-01T00:00:00.000Z",
          transaction: {
            recipient_name: "John Doe",
            recipient_iban: "DE89370400440532013000",
            reference: "Test",
            amount: {
              value: 100,
              unit: "cents",
              currency: "EUR",
            },
          },
        },
      });

      await timedOrdersApi.createTimedOrder(req, res);
    });

    it("should return confirmation id", async () => {
      const lastCall = res.send.args[res.send.args.length - 1];
      changeRequestId = lastCall[0].id;
      expect(changeRequestId).to.be.a("string");
    });

    it("should create a timed order", async () => {
      const person = await db.getPerson(personId);
      expect(person.timedOrders).to.have.length(1);
      expect(person.changeRequest).to.be.an("object");
    });

    describe("confirmTimedOrder by change request flow", () => {
      it("should return timed order", async () => {
        const changeReq = mockReq({
          params: {
            change_request_id: changeRequestId,
          },
          body: {
            person_id: personId,
            delivery_method: DeliveryMethod.MOBILE_NUMBER,
          },
        });
        await changeRequestApi.authorizeChangeRequest(changeReq, res);

        let person = await db.getPerson(personId);
        const tan = person.changeRequest.token;

        const confirmReq = mockReq({
          params: {
            change_request_id: changeRequestId,
          },
          body: {
            person_id: personId,
            tan,
          },
        });
        await changeRequestApi.confirmChangeRequest(confirmReq, res);

        const response = res.send.args[res.send.args.length - 1][0];
        expect(response.status).to.equal("COMPLETED");
        expect(response.id).to.equal(changeRequestId);
        expect(response.response_body).to.be.an("object");
        expect(response.response_body.status).to.equal("SCHEDULED");
        expect(response.response_body.scheduled_transaction).to.be.an("object");

        person = await db.getPerson(personId);
        expect(person.changeRequest).to.be.undefined;
        expect(person.timedOrders).to.have.length(1);
        expect(person.timedOrders[0].status).to.equal("SCHEDULED");
      });
    });
  });

  after(db.flushDb);
});
