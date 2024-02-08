import sinon from "sinon";
import { expect } from "chai";
import { mockReq, mockRes } from "sinon-express-mock";

import * as db from "../../src/db";

import * as instantCreditTransferApi from "../../src/routes/instantCreditTransfer";
import { createPerson } from "../../src/routes/persons";
import * as changeRequestApi from "../../src/routes/changeRequest";
import {
  DeliveryMethod,
  InstantCreditTransferStatus,
} from "../../src/helpers/types";
import * as backofficeHelpers from "../../src/routes/backoffice";

describe("Instant Credit Transfer", () => {
  let personId: string;
  let changeRequestId: string;
  let res: sinon.SinonSpy;
  let triggerWebhookStub: sinon.SinonStub;

  const accountId = "1234";

  before(async () => {
    await db.flushDb();
    res = mockRes();

    triggerWebhookStub = sinon.stub(
      backofficeHelpers,
      "triggerBookingsWebhook"
    );

    await createPerson(
      {
        body: {
          account: { id: accountId, iban: "DE1234567890" },
        },
        headers: {},
      },
      res
    );

    personId = res.send.args[0][0].id;
  });

  after(() => {
    db.flushDb();
    triggerWebhookStub.restore();
  });

  describe("createInstantCreditTransfer", () => {
    before(async () => {
      const req = mockReq({
        params: {
          accountId,
        },
        body: {
          creditor_iban: "DE89370400440532013000",
          creditor_name: "John Doe",
          idempotency_key: "12345",
          description: "test",
          end_to_end_id: "123456",
          amount: {
            value: 100,
            currency: "EUR",
          },
        },
      });

      await instantCreditTransferApi.createInstantCreditTransfer(req, res);
    });

    it("should return confirmation id", async () => {
      const lastCall = res.send.args[res.send.args.length - 1];
      changeRequestId = lastCall[0].change_request.id;
      expect(changeRequestId).to.be.a("string");
    });

    it("should create a instantCreditTransfer", async () => {
      const person = await db.getPerson(personId);
      expect(person.instantCreditTransfers).to.have.length(1);
      expect(person.changeRequest).to.be.an("object");
    });

    describe("confirmInstantCreditTransfer by change request flow", () => {
      it("should return instantCreditTransfer id", async () => {
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
        expect(response.response_body.id).to.be.a("string");

        person = await db.getPerson(personId);
        expect(person.changeRequest).to.be.undefined;
        expect(person.instantCreditTransfers).to.have.length(1);
        expect(person.instantCreditTransfers[0].status).to.equal(
          InstantCreditTransferStatus.CLEARED
        );
        expect(person.transactions).to.have.length(1);
        expect(triggerWebhookStub.calledOnce).to.be.true;
      });
    });
  });
});
