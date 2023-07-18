import uuid from "node-uuid";
import {
  getMobileNumber,
  saveDevice,
  getDevice,
  saveDeviceChallenge,
  getDeviceChallenge,
  deleteDeviceChallenge,
  getDevicesByPersonId,
  getPerson,
} from "../db";

const CHALLENGE_TTL_IN_MILLISECOND = 5 * 60 * 1000;

const newChallengeDates = () => ({
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + CHALLENGE_TTL_IN_MILLISECOND).toISOString(),
});

export const createDevice = async (req, res) => {
  // eslint-disable-next-line camelcase
  const { person_id, key_type, name, key } = req.body;

  const mobileNumber = await getMobileNumber(person_id);

  if (!mobileNumber) {
    res.status(400).send({
      errors: [
        {
          id: uuid.v4(),
          status: 400,
          code: "validation_error",
          title: "Validation Error",
          detail: "telephone number not found",
          source: {
            field: "number",
            message: "telephone number not found",
          },
        },
      ],
    });
    return;
  }

  const deviceId = uuid.v4();
  const device = {
    id: deviceId,
    person_id,
    name,
    key_type,
    key,
    verified: false,
    signatureChallenge: {
      id: deviceId,
      type: "signature",
      ...newChallengeDates(),
    },
  };

  await saveDevice(device);

  res.status(202).send({
    id: device.id,
    challenge: device.signatureChallenge,
  });
};

export const verifyDevice = async (req, res) => {
  const { id: deviceId } = req.params;
  const { signature } = req.body;

  const device = await getDevice(deviceId);

  if (!device || device.signatureChallenge.expires_at < Date.now()) {
    res.status(404).send({
      errors: [
        {
          id: uuid.v4(),
          status: 404,
          code: "not_found",
          title: "Not Found",
          detail: `signature challenge "${deviceId}" not found`,
        },
      ],
    });
    return;
  }

  if (!signature) {
    res.status(400).send({
      errors: [
        {
          id: uuid.v4(),
          status: 400,
          code: "validation_error",
          title: "Validation Error",
          detail: "length (0) out of bounds (min: 1, max: 2048)",
          source: {
            field: "signature",
            message: "length (0) out of bounds (min: 1, max: 2048)",
          },
        },
      ],
    });
    return;
  }

  await saveDevice({
    ...device,
    verified: true,
  });

  res.sendStatus(204);
};

export const getDeviceInfo = async (req, res) => {
  const { id: deviceId } = req.params;

  const device = await getDevice(deviceId);

  if (!device || !device.verified) {
    res.status(404).send({
      errors: [
        {
          id: uuid.v4(),
          status: 404,
          code: "not_found",
          title: "Not Found",
          detail: `device "${deviceId}" not found`,
        },
      ],
    });
    return;
  }

  res.send({
    id: device.id,
    person_id: device.person_id,
    name: device.name,
    created_at: device.signatureChallenge.created_at,
  });
};

export const createDeviceChallenge = async (req, res) => {
  const { device_id: deviceId } = req.body;

  const device = await getDevice(deviceId);

  if (!device || !device.verified) {
    res.status(400).send({
      errors: [
        {
          id: uuid.v4(),
          status: 400,
          code: "validation_error",
          title: "Validation Error",
          detail: "device-id invalid",
          source: {
            field: "device_id",
            message: "device-id invalid",
          },
        },
      ],
    });
    return;
  }

  const deviceChallenge = {
    id: uuid.v4(),
    type: "device",
    string_to_sign: uuid.v4(),
    ...newChallengeDates(),
  };

  await saveDeviceChallenge(deviceChallenge);

  res.status(201).send(deviceChallenge);
};

export const verifyDeviceChallenge = async (req, res) => {
  const { id: deviceChallengeId } = req.params;
  const { signature } = req.body;

  const deviceChallenge = await getDeviceChallenge(deviceChallengeId);

  if (!deviceChallenge || deviceChallengeId.expires_at < Date.now()) {
    res.status(404).send({
      errors: [
        {
          id: uuid.v4(),
          status: 404,
          code: "not_found",
          title: "Not Found",
          detail: `device challenge "${deviceChallengeId}" not found`,
        },
      ],
    });
    return;
  }

  if (!signature) {
    res.status(400).send({
      errors: [
        {
          id: uuid.v4(),
          status: 400,
          code: "validation_error",
          title: "Validation Error",
          detail: "length (0) out of bounds (min: 1, max: 2048)",
          source: {
            field: "signature",
            message: "length (0) out of bounds (min: 1, max: 2048)",
          },
        },
      ],
    });
    return;
  }

  await deleteDeviceChallenge(deviceChallengeId);

  res.status(204).send("Challenge successful");
};

export const listDeviceKeys = async (req, res) => {
  const { id: deviceId } = req.params;

  const device = await getDevice(deviceId);

  if (!device || !device.verified) {
    res.status(404).send({
      errors: [
        {
          id: uuid.v4(),
          status: 404,
          code: "not_found",
          title: "Not Found",
          detail: `device "${deviceId}" not found`,
        },
      ],
    });
    return;
  }

  const deviceKeys = device.keys || [
    {
      person_id: device.person_id,
      device_id: deviceId,
      name: device.name,
      keys: [{ key_id: uuid.v4(), key_purpose: "unrestricted" }],
    },
  ];

  res.status(200).send(deviceKeys);
};

export const addDeviceKey = async (req, res) => {
  const { id: deviceId } = req.params;
  const keyData: {
    key: string;
    key_type: "ecdsa-p256";
    key_purpose: "restricted" | "unrestricted";
    device_signature: {
      signature_key_purpose: "restricted" | "unrestricted";
      signature: string;
    };
  } = req.body;

  const device = await getDevice(deviceId);

  if (!device || !device.verified) {
    res.status(404).send({
      errors: [
        {
          id: uuid.v4(),
          status: 404,
          code: "not_found",
          title: "Not Found",
          detail: `device "${deviceId}" not found`,
        },
      ],
    });
    return;
  }

  const deviceKeys = device.keys || [
    {
      person_id: device.person_id,
      device_id: deviceId,
      name: device.name,
      keys: [{ key_id: uuid.v4(), key_purpose: "unrestricted" }],
    },
  ];

  const keyId = uuid.v4();

  deviceKeys.push({
    person_id: device.person_id,
    device_id: deviceId,
    name: device.name,
    keys: [{ key_id: keyId, ...keyData }],
  });

  device.keys = deviceKeys;

  await saveDevice(device);

  res.status(201).send({ id: keyId });
};

export const getDevices = async (req, res) => {
  const { person_id: personId } = req.query;

  try {
    await getPerson(personId);
  } catch (err) {
    return res.status(404).send({
      errors: [
        {
          id: uuid.v4(),
          status: 404,
          code: "not_found",
          title: "Not Found",
          detail: `person "${personId}" not found`,
        },
      ],
    });
  }

  const devices = await getDevicesByPersonId(personId);

  res.status(200).send(devices);
};
