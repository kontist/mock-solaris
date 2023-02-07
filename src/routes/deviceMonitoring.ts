import uuid from "node-uuid";
import moment from "moment";

import {
  DeviceActivityPayload,
  DeviceActivityType,
  DeviceConsentEventType,
  DeviceConsentPayload,
} from "../helpers/types";
import * as db from "../db";
import { Response } from "express";
import { RequestWithPerson } from "../helpers/middlewares";

const sendValidationError = (res: Response) => {
  res.status(400).send({
    id: uuid.v4(),
    status: 400,
    code: "validation_error",
    title: "Validation Error",
    details: "You sent invalid data.",
  });
};

export const createDeviceConsent = async (
  req: RequestWithPerson,
  res: Response
) => {
  const { person } = req;
  const deviceConsent: DeviceConsentPayload = req.body;

  if (
    !DeviceConsentEventType[deviceConsent.event_type] ||
    !moment(deviceConsent.confirmed_at).isValid
  ) {
    return sendValidationError(res);
  }

  const consent = await db.createDeviceConsent(person.id, deviceConsent);

  res.status(201).send(consent);
};

export const updateDeviceConsent = async (
  req: RequestWithPerson,
  res: Response
) => {
  const { person } = req;
  const { device_consent_id: deviceConsentId } = req.params;
  const deviceConsent: DeviceConsentPayload = req.body;

  if (
    !DeviceConsentEventType[deviceConsent.event_type] ||
    !moment(deviceConsent.confirmed_at).isValid
  ) {
    return sendValidationError(res);
  }

  const consent = await db.updateDeviceConsent(
    person.id,
    deviceConsentId,
    deviceConsent
  );

  res.status(201).send([consent]);
};

export const createUserActivity = async (
  req: RequestWithPerson,
  res: Response
) => {
  const { person } = req;
  const deviceActivity: DeviceActivityPayload = req.body;

  if (
    !DeviceActivityType[deviceActivity.activity_type] ||
    !deviceActivity.device_data
  ) {
    return sendValidationError(res);
  }

  const activity = await db.createDeviceActivity(person.id, deviceActivity);

  res.status(201).send([activity]);
};
