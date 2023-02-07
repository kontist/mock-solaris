import { expect } from "chai";
import { mockReq, mockRes } from "sinon-express-mock";

import * as db from "../src/db";
import * as deviceMonitoring from "../src/routes/deviceMonitoring";
import {
  DeviceActivityType,
  DeviceConsentEventType,
} from "../src/helpers/types";

describe("device monitoring", () => {
  before(db.flushDb);
  after(db.flushDb);

  let deviceConsentId: string;
  const personId = "1234";

  describe("createDeviceConsent", () => {
    it("should create device consent", async () => {
      const req = mockReq({
        person: {
          id: personId,
        },
        body: {
          event_type: DeviceConsentEventType.REJECTED,
          confirmed_at: new Date(0).toISOString(),
        },
      });
      const res = mockRes();

      await deviceMonitoring.createDeviceConsent(req, res);

      const consents = await db.getDeviceConsents(personId);

      expect(consents.length).to.equal(1);
      const [consent] = consents;
      expect(consent.event_type).to.equal(req.body.event_type);
      expect(consent.confirmed_at).to.equal(req.body.confirmed_at);
      expect(res.status.getCall(0).args[0]).to.equal(201);
      expect(res.send.getCall(0).args[0]).to.deep.equal(consent);
      deviceConsentId = consent.id;
    });
  });

  describe("updateDeviceConsent", () => {
    it("should update device consent", async () => {
      const req = mockReq({
        person: {
          id: personId,
        },
        params: {
          device_consent_id: deviceConsentId,
        },
        body: {
          event_type: DeviceConsentEventType.APPROVED,
          confirmed_at: new Date(0).toISOString(),
        },
      });
      const res = mockRes();

      await deviceMonitoring.updateDeviceConsent(req, res);

      const consents = await db.getDeviceConsents(personId);

      expect(consents.length).to.equal(1);
      const [consent] = consents;
      expect(consent.event_type).to.equal(req.body.event_type);
      expect(consent.confirmed_at).to.equal(req.body.confirmed_at);
      expect(res.status.getCall(0).args[0]).to.equal(201);
      expect(res.send.getCall(0).args[0].length).to.equal(1);
    });
  });

  describe("createUserActivity", () => {
    it("should create device activity", async () => {
      const deviceData = "some data";
      const req = mockReq({
        person: {
          id: personId,
        },
        body: {
          device_data: deviceData,
          activity_type: DeviceActivityType.APP_START,
        },
      });
      const res = mockRes();

      await deviceMonitoring.createUserActivity(req, res);

      const activities = await db.getDeviceActivities(personId);

      expect(activities.length).to.equal(1);
      const [activity] = activities;
      expect(activity.device_data).to.equal(req.body.device_data);
      expect(activity.activity_type).to.equal(req.body.activity_type);
      expect(res.status.getCall(0).args[0]).to.equal(201);
      expect(res.send.getCall(0).args[0].length).to.equal(1);
    });
  });
});
