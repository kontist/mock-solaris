import sinon from "sinon";
import { expect } from "chai";
import { mockReq, mockRes } from "sinon-express-mock";

import * as db from "../../src/db";
import * as webhookHelpers from "../../src/helpers/webhooks";
import { createPerson } from "../../src/routes/persons";
import * as scheduledTransfersApi from "../../src/routes/scheduledTransfers";
import * as changeRequestApi from "../../src/routes/changeRequest";
import {
  AccountType,
  EXECUTION_SCHEDULE,
  SCHEDULED_TRANSFER_STATUS,
  TransactionWebhookEvent,
} from "../../src/helpers/types";

describe("Scheduled transfers", () => {
  describe("update", () => {
    const accountId = "scheduled-transfer-account-id";
    let personId: string;
    let scheduledTransferId: string;
    let triggerWebhookStub: sinon.SinonStub;

    const patch = async (
      body,
      id = scheduledTransferId,
      account = accountId
    ) => {
      const res = mockRes();
      await scheduledTransfersApi.updateScheduledTransferRequestHandler(
        mockReq({ params: { account_id: account, id }, body }),
        res
      );
      return res;
    };

    const confirm = async (changeRequestId: string, tan?: string) => {
      const res = mockRes();
      await changeRequestApi.confirmChangeRequest(
        mockReq({
          params: { change_request_id: changeRequestId },
          body: { person_id: personId, tan },
        }),
        res
      );
      return res;
    };

    const getTransfer = async () =>
      (await db.getPerson(personId)).account.scheduledTransfers[0];

    beforeEach(async () => {
      await db.flushDb();
      triggerWebhookStub = sinon.stub(webhookHelpers, "triggerWebhook");

      const res = mockRes();
      await createPerson(
        {
          body: {
            first_name: "Sam",
            last_name: "Winchester",
            account: {
              id: accountId,
              type: AccountType.CHECKING_SOLE_PROPRIETOR,
            },
          },
          headers: {},
        },
        res
      );
      personId = res.send.args[0][0].id;

      const changeRequest = await scheduledTransfersApi.createScheduledTransfer(
        {
          accountId,
          transferType: "SCT",
          initiatorReference: "ref",
          creditorIban: "DE89370400440532013000",
          creditorName: "John Doe",
          amount: { value: 1000, currency: "EUR" },
          description: "Rent",
          executionSchedule: EXECUTION_SCHEDULE.MONTHLY,
          activeFrom: "2099-01-01",
          activeTo: "2099-12-01",
          authorizerId: personId,
        }
      );
      await scheduledTransfersApi.confirmScheduledTransferCreation(
        await db.getPerson(personId),
        changeRequest.id
      );
      scheduledTransferId = (await getTransfer()).id;
    });

    afterEach(() => {
      triggerWebhookStub.restore();
    });

    it("returns 202 with a change request", async () => {
      const res = await patch({
        amount: { value: 2000, currency: "EUR" },
        authorizer_id: personId,
      });

      expect(res.status.calledWith(202)).to.equal(true);
      const body = res.send.args[0][0];
      expect(body.id).to.equal(scheduledTransferId);
      expect(body.change_request.status).to.equal("AUTHORIZATION_REQUIRED");
      expect(body.change_request.id).to.be.a("string");

      // nothing is applied before confirmation
      expect((await getTransfer()).amount.value).to.equal(1000);
    });

    it("rejects fields that cannot be updated", async () => {
      for (const body of [
        { creditor_iban: "DE00" },
        { transfer_type: "SCT_INSTANT" },
        { execution_schedule: "WEEKLY" },
        { active_from: "2099-02-01" },
      ]) {
        const res = await patch(body);
        expect(res.status.calledWith(400)).to.equal(true);
        expect(res.send.args[0][0].errors[0].code).to.equal("validation_error");
      }
    });

    it("rejects invalid values", async () => {
      for (const body of [
        { amount: { value: 0, currency: "EUR" } },
        { amount: { value: -5, currency: "EUR" } },
        { amount: { value: 10.5, currency: "EUR" } },
        { description: "a".repeat(141) },
        { active_to: "not-a-date" },
        { active_to: "2098-01-01" },
      ]) {
        const res = await patch(body);
        expect(res.status.calledWith(400), JSON.stringify(body)).to.equal(true);
      }
    });

    it("returns 404 for unknown account or scheduled transfer", async () => {
      const unknownId = await patch({ description: "x" }, "unknown-id");
      expect(unknownId.status.calledWith(404)).to.equal(true);
      expect(unknownId.send.args[0][0].errors[0].code).to.equal("not_found");

      const unknownAccount = await patch(
        { description: "x" },
        scheduledTransferId,
        "unknown-account"
      );
      expect(unknownAccount.status.calledWith(404)).to.equal(true);
    });

    it("applies the update on confirmation, keeps omitted fields and emits the UPDATE webhook", async () => {
      const res = await patch({
        amount: { value: 2500, currency: "EUR" },
        active_to: "2099-06-01",
      });
      const changeRequestId = res.send.args[0][0].change_request.id;

      const confirmRes = await confirm(changeRequestId);
      expect(confirmRes.status.calledWith(202)).to.equal(true);
      expect(confirmRes.send.args[0][0].response_body.id).to.equal(
        scheduledTransferId
      );

      const transfer = await getTransfer();
      expect(transfer.amount).to.deep.equal({ value: 2500, currency: "EUR" });
      expect(transfer.active_to).to.equal("2099-06-01");
      expect(transfer.description).to.equal("Rent");
      expect(transfer.status).to.equal(SCHEDULED_TRANSFER_STATUS.ACTIVE);

      expect(triggerWebhookStub.calledOnce).to.equal(true);
      const { type, payload } = triggerWebhookStub.args[0][0];
      expect(type).to.equal(TransactionWebhookEvent.SCHEDULED_TRANSFER_UPDATED);
      expect(payload).to.deep.equal({
        id: scheduledTransferId,
        account_id: accountId,
        type: "UPDATE",
        amount: { value: 2500, currency: "EUR" },
        active_to: "2099-06-01",
        next_execution_date: "2099-01-01",
      });
    });

    it("emits the FAILURE webhook and changes nothing when the TAN is invalid", async () => {
      const res = await patch({ description: "New" });
      const changeRequestId = res.send.args[0][0].change_request.id;

      const confirmRes = await confirm(changeRequestId, "invalid");
      expect(confirmRes.status.calledWith(403)).to.equal(true);

      expect((await getTransfer()).description).to.equal("Rent");
      const { type, payload } = triggerWebhookStub.args[0][0];
      expect(type).to.equal(TransactionWebhookEvent.SCHEDULED_TRANSFER_UPDATED);
      expect(payload).to.include({
        id: scheduledTransferId,
        account_id: accountId,
        type: "FAILURE",
      });
      expect(payload.reason).to.be.a("string");
    });
  });
});
