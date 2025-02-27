import sinon from "sinon";
import { expect } from "chai";
import { mockReq, mockRes } from "sinon-express-mock";

import * as db from "../../src/db";

import * as accountAPI from "../../src/routes/accounts";
import { AccountType } from "../../src/helpers/types";
import { mockAccount } from "../mockData";

describe("Account", () => {
  let res: sinon.SinonSpy;
  const subaccount = {
    ...mockAccount,
    id: "subaccount-id",
    type: AccountType.CHECKING_SUBACCOUNT,
  };
  const person = {
    account: mockAccount,
    accounts: [subaccount],
  };

  before(async () => {
    await db.flushDb();
    res = mockRes();
  });

  after(() => {
    db.flushDb();
  });

  describe("showPersonAccount - subaccount", () => {
    it("should return a 404 if the account does not exist", async () => {
      const req = mockReq({
        person,
        params: {
          account_id: "non-existing-id",
        },
      });

      await accountAPI.showPersonAccount(req, res);

      expect(res.status.calledWith(404)).to.be.true;
    });

    it("should return the account", async () => {
      const req = mockReq({
        params: {
          person,
          account_id: subaccount.id,
        },
      });

      await accountAPI.showPersonAccount(req, res);

      expect(res.status.calledWith(200)).to.be.true;
      expect(res.send.lastCall.args[0].id).to.equal(subaccount.id);
    });
  });

  describe("showPersonAccount - main account", () => {
    it("should return the account", async () => {
      const req = mockReq({
        person,
        params: {
          account_id: mockAccount.id,
        },
      });

      await accountAPI.showPersonAccount(req, res);

      expect(res.status.calledWith(200)).to.be.true;
      expect(res.send.lastCall.args[0].id).to.equal(mockAccount.id);
    });
  });
});
