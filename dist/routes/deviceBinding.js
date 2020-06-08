"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyDeviceChallenge = exports.createDeviceChallenge = exports.getDeviceInfo = exports.verifyDevice = exports.createDevice = void 0;
const node_uuid_1 = __importDefault(require("node-uuid"));
const db_1 = require("../db");
const CHALLENGE_TTL_IN_MILLISECOND = 5 * 60 * 1000;
const newChallengeDates = () => ({
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + CHALLENGE_TTL_IN_MILLISECOND).toISOString(),
});
exports.createDevice = async (req, res) => {
    // eslint-disable-next-line camelcase
    const { person_id, key_type, name, key } = req.body;
    const mobileNumber = await db_1.getMobileNumber(person_id);
    if (!mobileNumber) {
        res.status(400).send({
            errors: [
                {
                    id: node_uuid_1.default.v4(),
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
    const deviceId = node_uuid_1.default.v4();
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
    await db_1.saveDevice(device);
    res.status(202).send({
        id: device.id,
        challenge: device.signatureChallenge,
    });
};
exports.verifyDevice = async (req, res) => {
    const { id: deviceId } = req.params;
    const { signature } = req.body;
    const device = await db_1.getDevice(deviceId);
    if (!device || device.signatureChallenge.expires_at < Date.now()) {
        res.status(404).send({
            errors: [
                {
                    id: node_uuid_1.default.v4(),
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
                    id: node_uuid_1.default.v4(),
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
    await db_1.saveDevice({
        ...device,
        verified: true,
    });
    res.sendStatus(204);
};
exports.getDeviceInfo = async (req, res) => {
    const { id: deviceId } = req.params;
    const device = await db_1.getDevice(deviceId);
    if (!device || !device.verified) {
        res.status(404).send({
            errors: [
                {
                    id: node_uuid_1.default.v4(),
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
exports.createDeviceChallenge = async (req, res) => {
    const { device_id: deviceId } = req.body;
    const device = await db_1.getDevice(deviceId);
    if (!device || !device.verified) {
        res.status(400).send({
            errors: [
                {
                    id: node_uuid_1.default.v4(),
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
        id: node_uuid_1.default.v4(),
        type: "device",
        string_to_sign: node_uuid_1.default.v4(),
        ...newChallengeDates(),
    };
    await db_1.saveDeviceChallenge(deviceChallenge);
    res.status(201).send(deviceChallenge);
};
exports.verifyDeviceChallenge = async (req, res) => {
    const { id: deviceChallengeId } = req.params;
    const { signature } = req.body;
    const deviceChallenge = await db_1.getDeviceChallenge(deviceChallengeId);
    if (!deviceChallenge || deviceChallengeId.expires_at < Date.now()) {
        res.status(404).send({
            errors: [
                {
                    id: node_uuid_1.default.v4(),
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
                    id: node_uuid_1.default.v4(),
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
    await db_1.deleteDeviceChallenge(deviceChallengeId);
    res.status(204).send("Challenge successful");
};
//# sourceMappingURL=deviceBinding.js.map