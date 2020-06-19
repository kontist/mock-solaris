"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processChangeRequest = exports.listTaxIdentifications = exports.showTaxIdentification = exports.updateTaxIdentification = exports.submitTaxIdentification = exports.TIN_UPDATE = void 0;
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("../db");
const changeRequest_1 = require("./changeRequest");
exports.TIN_UPDATE = "Patch/tax-indentifications/id";
exports.submitTaxIdentification = async (req, res) => {
    const { person_id: personId } = req.params;
    const tins = await db_1.getTaxIdentifications(personId);
    const id = `taxid-${personId}-${crypto_1.default
        .createHash("md5")
        .update(JSON.stringify(req.body) + tins.length)
        .digest("hex")}`;
    const tinNew = {
        id,
        country: null,
        number: null,
        primary: null,
        reason_no_tin: null,
        reason_description: null,
    };
    const tin = { ...tinNew, ...req.body };
    if (!tinValidate(tin)) {
        return res.status(400).send({
            errors: [
                {
                    id: Date.now().toString(),
                    status: 400,
                    code: "",
                    title: "",
                    detail: "invalid tax_identification",
                },
            ],
        });
    }
    if (tins.length) {
        if (tins.find((tinRow) => tinRow.country === tin.country)) {
            return res.status(400).send({
                errors: [
                    {
                        id: Date.now().toString(),
                        status: 400,
                        code: "invalid_model",
                        title: "Invalid Model",
                        detail: "country has already been taken",
                    },
                ],
            });
        }
    }
    if (!tins.length && !tin.primary) {
        return res.status(400).send({
            errors: [
                {
                    id: Date.now().toString(),
                    status: 400,
                    code: "invalid_model",
                    title: "Invalid Model",
                    detail: "primary can't be false when no other primary is available",
                },
            ],
        });
    }
    if (tin.primary)
        makeTinsNoPrimary(tins);
    await db_1.saveTaxIdentifications(personId, tins.concat([tin]));
    res.status(201).send(tin);
};
exports.updateTaxIdentification = async (req, res) => {
    const { person_id: personId, id } = req.params;
    const person = await db_1.getPerson(personId);
    const tins = await db_1.getTaxIdentifications(personId);
    const storedTin = tins.find((tinRow) => tinRow.id === id);
    if (!storedTin) {
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
    const tin = { ...storedTin, ...req.body };
    if (!tinValidate(tin)) {
        return res.status(400).send({
            errors: [
                {
                    id: Date.now().toString(),
                    status: 400,
                    code: "",
                    title: "",
                    detail: "invalid tax_identification",
                },
            ],
        });
    }
    if (!tin.primary) {
        if (!tins.find((tinRow) => tinRow.primary === true)) {
            return res.status(400).send({
                errors: [
                    {
                        id: Date.now().toString(),
                        status: 400,
                        code: "",
                        title: "",
                        detail: "at least one has to be primary",
                    },
                ],
            });
        }
    }
    return changeRequest_1.createChangeRequest(req, res, person, exports.TIN_UPDATE, tin);
};
exports.showTaxIdentification = async (req, res) => {
    const { person_id: personId, id } = req.params;
    const identification = (await db_1.getTaxIdentifications(personId)).find((tin) => tin.id === id);
    res.status(200).send(identification);
};
exports.listTaxIdentifications = async (req, res) => {
    const { person_id: personId } = req.params;
    const identifications = await db_1.getTaxIdentifications(personId);
    res.status(200).send(identifications);
};
exports.processChangeRequest = async (person) => {
    const tins = await db_1.getTaxIdentifications(person.id);
    const id = person.changeRequest.delta.id;
    const storedTin = tins.find((tinRow) => tinRow.id === id);
    const tin = { ...storedTin, ...person.changeRequest.delta };
    const indexAt = tins.findIndex((t) => t.id === id);
    if (tin.primary)
        makeTinsNoPrimary(tins);
    tins[indexAt] = tin;
    await db_1.saveTaxIdentifications(person.id, tins);
    return tin;
};
const makeTinsNoPrimary = (tins) => {
    /*
    "In case a consequent tax_identification is submitted as primary"
    "the latest one holds the primary flag and the previously submitted ones lose it."
    */
    for (const tin of tins) {
        tin.primary = false;
    }
};
const tinValidate = (tin) => {
    // Either the tax identification contains a number or
    // it does not and reason_no_tin has then to be provided
    if (!tin.number && !tin.reason_no_tin) {
        return false;
    }
    // If the chosen enum for reason_no_tin is OTHER, a reason_description is mandatory
    if (!tin.number && tin.reason_no_tin === "OTHER" && !tin.reason_description) {
        return false;
    }
    return true;
};
//# sourceMappingURL=taxIdentifications.js.map