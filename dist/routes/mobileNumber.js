"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeMobileNumberConfirmChangeRequest = exports.removeMobileNumber = exports.confirmMobileNumber = exports.authorizeMobileNumber = exports.createMobileNumber = exports.showMobileNumber = exports.MOBILE_NUMBER_CHANGE_METHOD = void 0;
const crypto_1 = __importDefault(require("crypto"));
const log = __importStar(require("../logger"));
const db_1 = require("../db");
exports.MOBILE_NUMBER_CHANGE_METHOD = "mobile_number_change";
exports.showMobileNumber = async (req, res) => {
    const { person_id: personId } = req.params;
    const mobileNumber = await db_1.getMobileNumber(personId);
    if (!mobileNumber) {
        return res.status(404).send({
            errors: [
                {
                    id: Date.now().toString(),
                    status: 404,
                    code: "model_not_found",
                    title: "Model Not Found",
                    detail: `Couldn't find 'Solaris::MobileNumber' for id '${personId}'.`,
                },
            ],
        });
    }
    return res.status(200).send(mobileNumber);
};
exports.createMobileNumber = async (req, res) => {
    const { person_id: personId } = req.params;
    const existingMobileNumber = await db_1.getMobileNumber(personId);
    if (existingMobileNumber) {
        return res.status(409).send({
            errors: [
                {
                    id: "09bac5b1813df74838c9451147f08f34ex",
                    status: 409,
                    code: "mobile_number_exists",
                    title: "Mobile Number Exists",
                    detail: `Mobile number already added for person: ${personId}.`,
                },
            ],
        });
    }
    const { number } = req.body;
    const mobileNumberId = `mobileNumberId-${personId}-${crypto_1.default
        .createHash("md5")
        .update(JSON.stringify(req.body) + personId)
        .digest("hex")}`;
    const mobileNumber = {
        id: mobileNumberId,
        number,
        verified: false,
    };
    await db_1.saveMobileNumber(personId, mobileNumber);
    return res.status(201).send(mobileNumber);
};
exports.authorizeMobileNumber = async (req, res) => {
    const { person_id: personId } = req.params;
    const { number } = req.body;
    const person = await db_1.getPerson(personId);
    const existingMobileNumber = await db_1.getMobileNumber(personId);
    if (!existingMobileNumber || existingMobileNumber.number !== number) {
        return res.status(404).send({
            errors: [
                {
                    id: Date.now().toString(),
                    status: 404,
                    code: "model_not_found",
                    title: "Model Not Found",
                    detail: `Couldn't find 'Solaris::MobileNumber' for id '${number}'.`,
                },
            ],
        });
    }
    person.changeRequest = {
        method: exports.MOBILE_NUMBER_CHANGE_METHOD,
        token: Date.now().toString().substr(-6),
    };
    log.info(`Generated SMS token for mobile number verfication on Solaris: ${person.changeRequest.token}`);
    await db_1.savePerson(person);
    return res.status(201).send(existingMobileNumber);
};
exports.confirmMobileNumber = async (req, res) => {
    const { person_id: personId } = req.params;
    const { number, token } = req.body;
    const person = await db_1.getPerson(personId);
    const existingMobileNumber = await db_1.getMobileNumber(personId);
    if (!existingMobileNumber || existingMobileNumber.number !== number) {
        return res.status(404).send({
            errors: [
                {
                    id: Date.now().toString(),
                    status: 404,
                    code: "model_not_found",
                    title: "Model Not Found",
                    detail: `Couldn't find 'Solaris::MobileNumber' for id '${number}'.`,
                },
            ],
        });
    }
    if (person.changeRequest.token !== token) {
        return res.status(403).send({
            errors: [
                {
                    id: Date.now().toString(),
                    status: 403,
                    code: "invalid_tan",
                    title: "Invalid TAN",
                    detail: `Invalid or expired TAN for Solaris::MobileNumber with uid: '${existingMobileNumber.id}'`,
                },
            ],
        });
    }
    delete person.changeRequest;
    await db_1.savePerson(person);
    const mobileNumber = {
        ...existingMobileNumber,
        verified: true,
    };
    await db_1.saveMobileNumber(personId, mobileNumber);
    return res.status(201).send(mobileNumber);
};
exports.removeMobileNumber = async (req, res) => {
    const { person_id: personId } = req.params;
    const { number } = req.body;
    const person = await db_1.getPerson(personId);
    const existingMobileNumber = await db_1.getMobileNumber(personId);
    if (!existingMobileNumber) {
        return res.status(403).send({
            errors: [
                {
                    id: Date.now().toString(),
                    status: 403,
                    code: "unauthorized_action",
                    title: "Unauthorized Action",
                    detail: `Unauthorized action 'destroy' is not allowed for 'Solaris::Service::Person::MobileNumber'`,
                },
            ],
        });
    }
    if (number !== existingMobileNumber.number) {
        return res.status(404).send({
            errors: [
                {
                    id: Date.now().toString(),
                    status: 404,
                    code: "model_not_found",
                    title: "Model Not Found",
                    detail: `Couldn't find 'Solaris::MobileNumber' for id '${number}'.`,
                },
            ],
        });
    }
    if (existingMobileNumber.verified) {
        const changeRequestId = Date.now().toString();
        person.changeRequest = {
            id: changeRequestId,
            method: exports.MOBILE_NUMBER_CHANGE_METHOD,
        };
        await db_1.savePerson(person);
        return res.status(202).send({
            id: changeRequestId,
            status: "AUTHORIZATION_REQUIRED",
            updated_at: new Date().toISOString(),
            url: `:env/v1/change_requests/${changeRequestId}/authorize`,
        });
    }
    await db_1.deleteMobileNumber(personId);
    return res.status(200).send(existingMobileNumber);
};
exports.removeMobileNumberConfirmChangeRequest = async (person) => {
    await db_1.deleteMobileNumber(person.id);
    return db_1.getPerson(person.id);
};
//# sourceMappingURL=mobileNumber.js.map