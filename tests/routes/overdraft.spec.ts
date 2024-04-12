import sinon from "sinon";
import { expect } from "chai";
import { mockReq, mockRes } from "sinon-express-mock";

import { OVERDRAFT_LIMIT } from "../../src/helpers/overdraft";
import * as db from "../../src/db";
import { createPerson } from "../../src/routes/persons";
import { AccountWebhookEvent, OverdraftStatus } from "../../src/helpers/types";
import * as overdraftApi from "../../src/routes/overdraft";
import * as webhooksHelpers from "../../src/helpers/webhooks";

describe("Overdraft", () => {
  describe("Overdraft termination", () => {
    let res: sinon.SinonSpy;
    let triggerWebhookStub: sinon.SinonStub;
    let personId: string;
    const overdraftId = "1234";

    before(async () => {
      await db.flushDb();
      res = mockRes();

      triggerWebhookStub = sinon.stub(webhooksHelpers, "triggerWebhook");

      await createPerson(
        {
          body: {
            account: {
              iban: "DE1234567890",
              overdraft: { id: overdraftId, status: OverdraftStatus.LIMIT_SET },
              account_limit: OVERDRAFT_LIMIT,
            },
          },
          headers: {},
        },
        res
      );

      personId = res.send.args[0][0].id;

      const req = mockReq({
        params: {
          person_id: personId,
          overdraft_id: overdraftId,
        },
      });

      await overdraftApi.terminateOverdraft(req, res);
    });

    after(() => {
      db.flushDb();
      triggerWebhookStub.restore();
    });

    it("should set account_limit to 0 and overdraft status to terminated", async () => {
      const person = await db.getPerson(personId);
      const account = person.account;
      const overdraft = account.overdraft;

      expect(account.account_limit.value).to.equal(0);
      expect(overdraft.status).to.equal(OverdraftStatus.TERMINATED);
    });

    it("should trigger webhook", async () => {
      expect(triggerWebhookStub.calledOnce).to.be.true;
      expect(triggerWebhookStub.getCall(0).args[0].type).to.equal(
        AccountWebhookEvent.ACCOUNT_LIMIT_CHANGE
      );
    });
  });
});
