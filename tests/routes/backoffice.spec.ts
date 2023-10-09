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
    const iban = "DE1234";
    const person = {
      id: personId,
      createdAt: "2020-01-01",
      account: {
        id: accountId,
        iban,
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
          sortPersons: true,
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
      const fetchedPersonById = await db.findPersonByAccount({ id: accountId });
      expect(fetchedPersonById.id).to.equal(personId);
      const fetchedPersonByIBAN = await db.findPersonByAccount({ iban });
      expect(fetchedPersonByIBAN.id).to.equal(personId);
    });
  });
});
