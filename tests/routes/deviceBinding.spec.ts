import sinon from "sinon";
import { expect } from "chai";

import * as db from "../../src/db";
import * as deviceBinding from "../../src/routes/deviceBinding";

describe("Device Binding", () => {
  let res;
  const addDeviceKeyReq = {
    params: {
      id: "device-id",
    },
    body: {
      key: "key",
      key_type: "ecdsa-p256",
      key_purpose: "restricted",
      device_signature: {
        signature_key_purpose: "restricted",
        signature: "signature",
      },
    },
  };

  beforeEach(async () => {
    await db.flushDb();
    res = {
      status: sinon.stub().callsFake(() => res),
      send: sinon.stub(),
    };
  });

  describe("addDeviceKey", () => {
    const req = addDeviceKeyReq;

    it("should return 404 if device is not found", async () => {
      await deviceBinding.addDeviceKey(req, res);

      expect(res.status.firstCall.args[0]).to.equal(404);
    });

    it("should return 404 if device is not verified", async () => {
      await db.saveDevice({
        id: "device-id",
        person_id: "person-id",
        name: "device-name",
      });

      await deviceBinding.addDeviceKey(req, res);

      expect(res.status.firstCall.args[0]).to.equal(404);
    });

    it("should return 201 if device is found and verified", async () => {
      await db.saveDevice({
        id: "device-id",
        person_id: "person-id",
        name: "device-name",
        verified: true,
      });

      await deviceBinding.addDeviceKey(req, res);

      expect(res.status.firstCall.args[0]).to.equal(201);
    });
  });

  describe("listDeviceKeys", () => {
    const req = {
      params: {
        id: "device-id",
      },
    };

    it("should return 404 if device is not found", async () => {
      await deviceBinding.listDeviceKeys(req, res);

      expect(res.status.firstCall.args[0]).to.equal(404);
    });

    it("should return 404 if device is not verified", async () => {
      await db.saveDevice({
        id: "device-id",
        person_id: "person-id",
        name: "device-name",
      });

      await deviceBinding.listDeviceKeys(req, res);

      expect(res.status.firstCall.args[0]).to.equal(404);
    });

    it("should return 200 if device is found and verified", async () => {
      await db.saveDevice({
        id: "device-id",
        person_id: "person-id",
        name: "device-name",
        verified: true,
      });

      await deviceBinding.addDeviceKey(addDeviceKeyReq, res);
      await deviceBinding.listDeviceKeys(req, res);

      expect(res.status.lastCall.args[0]).to.equal(200);
      expect(res.send.lastCall.args[0].length).to.eq(2);
    });
  });
});
