"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCreditRecord = exports.updatePerson = exports.PERSON_UPDATE = exports.showPersons = exports.showPerson = exports.createPerson = void 0;
const crypto_1 = __importDefault(require("crypto"));
const lodash_1 = __importDefault(require("lodash"));
const node_uuid_1 = __importDefault(require("node-uuid"));
const db_1 = require("../db");
const changeRequest_1 = require("./changeRequest");
const webhooks_1 = require("../helpers/webhooks");
const types_1 = require("../helpers/types");
exports.createPerson = (req, res) => {
    const personId = "mock" +
        crypto_1.default.createHash("md5").update(JSON.stringify(req.body)).digest("hex");
    const person = {
        ...req.body,
        id: personId,
        identifications: {},
        transactions: [],
        statements: [],
        queuedBookings: [],
        createdAt: new Date().toISOString(),
    };
    return db_1.savePerson(person).then(() => {
        res.status(200).send({
            id: personId,
            ...req.body,
        });
    });
};
exports.showPerson = async (req, res) => {
    const { person_id: personId } = req.params;
    try {
        const person = await db_1.getPerson(personId);
        return res.status(200).send(person);
    }
    catch (err) {
        if (err.message === "did not find person") {
            const resp = {
                errors: [
                    {
                        id: "0a5ec2ea-6772-11e9-a656-02420a868404",
                        status: 404,
                        code: "model_not_found",
                        title: "Model Not Found",
                        detail: `Couldn't find 'Solaris::Person' for id '${personId}'.`,
                    },
                ],
            };
            return res.status(404).send(resp);
        }
        return res.status(500).send({
            errors: [
                {
                    id: "0a5ec2ea-6772-11e9-a656-02420a868404",
                    status: 500,
                },
            ],
        });
    }
};
exports.showPersons = async (req, res) => {
    const { page: { size = 10, number = 1 } = {} } = req.query;
    const persons = ((await db_1.getAllPersons()) || []).slice((number - 1) * size, size * number);
    return res.status(200).send(persons);
};
exports.PERSON_UPDATE = "Patch/Persons/person_id";
/**
 * Checks if the model has setted previously a value given in the input.
 * This is useful to check is a Solaris entity may be updated or not checking the full entity
 * or the desired part of the entity.
 * i.e isTanRequired(mydata, person) or isTanRequired(mydata, person.address)
 * @param {$Request} req
 * @param {$Response} res
 */
const isTanRequired = (input, model) => {
    let flag = false;
    if (input && model) {
        Object.keys(input).forEach((key) => {
            if (typeof input[key] === "object" && model[key]) {
                flag = flag || isTanRequired(input[key], model[key]);
            }
            else if (model[key]) {
                flag = true;
            }
        });
    }
    return flag;
};
exports.updatePerson = async (req, res) => {
    // Solaris responds with a 403 when the parameter being updated is "empty",
    // i.e., `null`. This is not yet implemented here.
    const fields = [
        "salutation",
        "title",
        "first_name",
        "last_name",
        "address",
        "line_1",
        "line_2",
        "postal_code",
        "city",
        "state",
        "country",
        "contact_address",
        "email",
        "mobile_number",
        "birth_name",
        "birth_date",
        "birth_city",
        "birth_country",
        "nationality",
        "employment_status",
        "job_title",
        "tax_information",
        "tax_assessment",
        "marital_status",
        "fatca_relevant",
        "fatca_crs_confirmed_at",
        "business_purpose",
        "industry",
        "industry_key",
        "terms_conditions_signed_at",
        "own_economic_interest_signed_at",
        "business_trading_name",
    ];
    const editableFields = [
        "title",
        "salutation",
        "address",
        "line_1",
        "line_2",
        "postal_code",
        "city",
        "state",
        "country",
        "contact_address",
        "employment_status",
        "job_title",
        "email",
        "tax_information",
        "fatca_relevant",
        "fatca_crs_confirmed_at",
        "fatca_relevant",
        "fatca_crs_confirmed_at",
        "business_purpose",
        "industry",
        "industry_key",
        "terms_conditions_signed_at",
        "business_trading_name",
    ];
    const { params: { person_id: personId }, body, } = req;
    const data = lodash_1.default.pick(body, fields);
    const person = await db_1.getPerson(personId);
    const fieldsBanned = [];
    Object.keys(data).forEach((key) => {
        if (!editableFields.includes(key))
            fieldsBanned.push(key);
    });
    if (fieldsBanned.length) {
        return res.status(400).send({
            id: "f0487cda-5a03-11e9-8ebd-02420a86840b",
            status: 400,
            code: "deprecated_params",
            title: "Deprecated Parameters",
            detail: `Updating ${fieldsBanned[0]} is deprecated.`,
        });
    }
    const editable = lodash_1.default.pick(data, editableFields);
    editable.address = lodash_1.default.pick(data.address, editableFields);
    editable.contact_address = lodash_1.default.pick(data.contact_address, editableFields);
    editable.tax_information = lodash_1.default.pick(data.tax_information, editableFields);
    if (isTanRequired(editable, person)) {
        return changeRequest_1.createChangeRequest(req, res, person, exports.PERSON_UPDATE, data);
    }
    lodash_1.default.merge(person, data);
    await db_1.savePerson(person);
    await webhooks_1.triggerWebhook(types_1.PersonWebhookEvent.PERSON_CHANGED, {}, { "solaris-entity-id": personId });
    return res.status(200).send(person);
};
exports.createCreditRecord = async (req, res) => {
    const { body: { source }, params: { person_id: personId }, } = req;
    const person = await db_1.getPerson(personId);
    if (source !== "solarisBank") {
        return res.status(400).send({
            id: node_uuid_1.default.v4(),
            status: 400,
            code: "bad_request",
            title: "Bad Request",
            detail: `/source: Invalid value for enum`,
            source: {
                message: "Invalid value for enum",
                field: "/source",
            },
        });
    }
    const creditRecordId = node_uuid_1.default.v4();
    person.creditRecordId = creditRecordId;
    await db_1.savePerson(person);
    return res.status(201).send({
        status: "available",
        person_id: req.params.person_id,
        id: creditRecordId,
        created_at: new Date().toISOString(),
    });
};
//# sourceMappingURL=persons.js.map