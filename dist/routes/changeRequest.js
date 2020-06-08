"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmChangeRequest = exports.authorizeChangeRequest = exports.createChangeRequest = void 0;
const lodash_1 = __importDefault(require("lodash"));
const moment_1 = __importDefault(require("moment"));
const db_1 = require("../db");
const mobileNumber_1 = require("./mobileNumber");
const standingOrders_1 = require("./standingOrders");
const persons_1 = require("./persons");
const taxIdentifications_1 = require("./taxIdentifications");
const timedOrders_1 = require("./timedOrders");
const batchTransfers_1 = require("./batchTransfers");
const cards_1 = require("../helpers/cards");
const cards_2 = require("./cards");
const MAX_CHANGE_REQUEST_AGE_IN_MINUTES = 5;
exports.createChangeRequest = async (req, res, person, method, delta) => {
    const personId = person.id;
    const mobileNumber = await db_1.getMobileNumber(personId);
    if (!mobileNumber) {
        return res.status(403).send({
            id: Date.now().toString(),
            status: 403,
            code: "Unauthorized Change Request",
            title: "Unauthorized Change Request",
            detail: "Unauthorized change request for Solaris::Person " +
                personId +
                ". While authorization required, no entity with a possibility to authorize data change is present.",
        });
    }
    const changeRequestId = Date.now().toString();
    person.changeRequest = {
        id: changeRequestId,
        method: method,
        delta: delta,
    };
    await db_1.savePerson(person);
    return res.status(202).send({
        id: changeRequestId,
        status: "AUTHORIZATION_REQUIRED",
        updated_at: new Date().toISOString(),
        url: `:env/v1/change_requests/${changeRequestId}/authorize`,
    });
};
exports.authorizeChangeRequest = async (req, res) => {
    const { person_id: personId, delivery_method: deliveryMethod } = req.body;
    const changeRequestId = req.params.change_request_id;
    const person = await db_1.getPerson(personId);
    const changeRequestMethod = person.changeRequest.method;
    if (personId && deliveryMethod === "mobile_number") {
        if (changeRequestMethod === mobileNumber_1.MOBILE_NUMBER_CHANGE_METHOD) {
            const existingMobileNumber = await db_1.getMobileNumber(personId);
            if (!existingMobileNumber) {
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
        }
        await assignAuthorizationToken(person);
        return res.status(201).send({
            id: changeRequestId,
            status: "CONFIRMATION_REQUIRED",
            updated_at: new Date().toISOString(),
        });
    }
    return res.status(404).send({
        errors: [
            {
                id: Date.now().toString(),
                status: 401,
                code: "invalid_token",
                title: "Invalid Token",
                detail: "Token is invalid",
            },
        ],
    });
};
exports.confirmChangeRequest = async (req, res) => {
    const { change_request_id: changeRequestId } = req.params;
    const { person_id: personId, tan } = req.body;
    const person = await db_1.getPerson(personId);
    const age = moment_1.default().diff(moment_1.default(lodash_1.default.get(person, "changeRequest.createdAt")), "minutes");
    // A change request older than 5 minutes doesn't exist
    if (!person.changeRequest || age > MAX_CHANGE_REQUEST_AGE_IN_MINUTES) {
        return res.status(422).send({
            errors: [
                {
                    id: Date.now().toString(),
                    status: 422,
                    code: "unprocessable_entity",
                    title: "Unprocessable Entity",
                    detail: `Unknown change request for Solaris::Person ${personId}`,
                },
            ],
        });
    }
    if (tan !== person.changeRequest.token) {
        // An invalid TAN also invalidates the action it is meant to authorize
        delete person.changeRequest;
        await db_1.savePerson(person);
        return res.status(403).send({
            errors: [
                {
                    id: Date.now().toString(),
                    status: 403,
                    code: "invalid_tan",
                    title: "Invalid TAN",
                    detail: `Invalid or expired TAN for Solaris`,
                },
            ],
        });
    }
    let status = 201;
    let response = { status: "COMPLETED", response_code: status };
    switch (person.changeRequest.method) {
        case mobileNumber_1.MOBILE_NUMBER_CHANGE_METHOD:
            response.response_body = await mobileNumber_1.removeMobileNumberConfirmChangeRequest(person);
            break;
        case standingOrders_1.STANDING_ORDER_CREATE_METHOD:
            response.response_body = await standingOrders_1.confirmStandingOrderCreation(person, changeRequestId);
            break;
        case standingOrders_1.STANDING_ORDER_UPDATE_METHOD:
            response.response_body = await standingOrders_1.confirmStandingOrderUpdate(person);
            break;
        case standingOrders_1.STANDING_ORDER_CANCEL_METHOD:
            response.response_body = await standingOrders_1.confirmStandingOrderCancelation(person);
            break;
        case persons_1.PERSON_UPDATE:
            lodash_1.default.merge(person, person.changeRequest.delta);
            response.response_body = person;
            break;
        case taxIdentifications_1.TIN_UPDATE:
            response.response_body = await taxIdentifications_1.processChangeRequest(person);
            break;
        case timedOrders_1.TIMED_ORDER_CREATE:
            // TODO: FIX response.response_body = await confirmTimedOrder(person);
            break;
        case batchTransfers_1.BATCH_TRANSFER_CREATE_METHOD:
            response.response_body = await batchTransfers_1.confirmBatchTransfer(person, changeRequestId);
            break;
        case cards_1.CHANGE_REQUEST_CHANGE_CARD_PIN:
            return cards_2.confirmChangeCardPINHandler(req, res);
        default:
            status = 400;
            response = { message: "Unknown method!" };
            break;
    }
    delete person.changeRequest;
    await db_1.savePerson(person);
    return res.status(status).send(response);
};
const assignAuthorizationToken = async (person) => {
    person.changeRequest.token = Date.now().toString().substr(-6);
    await db_1.savePerson(person);
};
//# sourceMappingURL=changeRequest.js.map