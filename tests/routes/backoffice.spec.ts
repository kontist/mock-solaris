import sinon from "sinon";
import { expect } from "chai";
import { mockReq, mockRes } from "sinon-express-mock";

import * as db from "../../src/db";
import { createMaps } from "../../src/routes/backoffice";

describe("Backoffice", () => {
  describe("createMaps", () => {
    let req: sinon.SinonSpy;
    let res: sinon.SinonSpy;
    const personId = "person_id";
    const accountId = "account_id";
    const deviceId = "device_id";
    const person = {
      id: personId,
      account: {
        id: accountId,
      },
    };
    const device = {
      id: deviceId,
      person_id: personId,
    };

    after(db.flushDb);
    before(async () => {
      await db.flushDb();
      await db.savePerson(person);
      await db.saveDevice(device);

      res = mockRes();
      req = mockReq({
        body: {
          devices: true,
          accounts: true,
        },
      });

      await createMaps(req, res);
    });

    it("should return HTTP 201", async () => {
      expect(res.status.args[0][0]).to.equal(201);
    });

    it("should set proper map values in redis", async () => {
      const devices = await db.getDevicesByPersonId(personId);
      expect(devices[0].id).to.equal(deviceId);
      const fetchedPerson = await db.findPersonByAccountId(accountId);
      expect(fetchedPerson.id).to.equal(personId);
    });
  });
});
