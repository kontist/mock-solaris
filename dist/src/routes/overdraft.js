"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOverdraft = exports.linkOverdraftApplicationSnapshot = exports.getOverdraftApplication = exports.createOverdraftApplication = void 0;
/* eslint-disable @typescript-eslint/camelcase */
const node_uuid_1 = __importDefault(require("node-uuid"));
const db_1 = require("../db");
const overdraft_1 = require("../helpers/overdraft");
const types_1 = require("../helpers/types");
exports.createOverdraftApplication = async (req, res) => {
    const { body: { credit_record_id: creditRecordId }, params: { person_id: personId }, } = req;
    const person = await db_1.getPerson(personId);
    if (!person) {
        return res
            .status(404)
            .send(overdraft_1.generateEntityNotFoundPayload("person_id", personId));
    }
    if (person.creditRecordId !== creditRecordId) {
        return res
            .status(404)
            .send(overdraft_1.generateEntityNotFoundPayload("credit_record_id", creditRecordId));
    }
    const overdraftApplication = {
        id: node_uuid_1.default.v4(),
        person_id: personId,
        credit_record_id: creditRecordId,
        overdraft_id: null,
        status: types_1.OverdraftApplicationStatus.ACCOUNT_SNAPSHOT_PENDING,
        decision: null,
        partner_risk_class: null,
        partner_reference_number: null,
        partner_contact_number: null,
        partner_contact_name: null,
        rejection_reasons: [],
        limit: null,
        interest_accrual_rate: overdraft_1.INTEREST_ACCRUAL_RATE,
        overdraft_rate: overdraft_1.OVERDRAFT_RATE,
        interest_conditions_enabled: true,
        created_at: new Date().toISOString(),
        account_snapshot_id: null,
    };
    person.account.overdraftApplications =
        person.account.overdraftApplications || [];
    person.account.overdraftApplications.push(overdraftApplication);
    await db_1.savePerson(person);
    return res.status(200).send(overdraftApplication);
};
exports.getOverdraftApplication = async (req, res) => {
    const { params: { person_id: personId, id: applicationId }, } = req;
    const person = await db_1.getPerson(personId);
    const overdraftApplication = person.account.overdraftApplications.find((app) => app.id === applicationId);
    if (!overdraftApplication) {
        return res
            .status(404)
            .send(overdraft_1.generateEntityNotFoundPayload("application_id", applicationId));
    }
    return res.status(200).send(overdraftApplication);
};
exports.linkOverdraftApplicationSnapshot = async (req, res) => {
    const { body: { account_snapshot_id: accountSnapshotId }, params: { person_id: personId, id: applicationId }, } = req;
    const person = await db_1.getPerson(personId);
    const overdraftApplication = person.account.overdraftApplications.find((app) => app.id === applicationId);
    if (!overdraftApplication) {
        return res
            .status(404)
            .send(overdraft_1.generateEntityNotFoundPayload("application_id", applicationId));
    }
    const { snapshot } = person.account;
    if (!snapshot || snapshot.id !== accountSnapshotId) {
        return res
            .status(404)
            .send(overdraft_1.generateEntityNotFoundPayload("account_snapshot_id", accountSnapshotId));
    }
    overdraftApplication.account_snapshot_id = accountSnapshotId;
    await overdraft_1.changeOverdraftApplicationStatus({
        person,
        applicationId: overdraftApplication.id,
        status: types_1.OverdraftApplicationStatus.ACCOUNT_SNAPSHOT_VERIFICATION_PENDING,
    });
    res.sendStatus(204);
};
exports.createOverdraft = async (req, res) => {
    const { body: { account_id: accountId }, params: { person_id: personId, id: applicationId }, } = req;
    const person = await db_1.getPerson(personId);
    const overdraftApplication = person.account.overdraftApplications.find((app) => app.id === applicationId);
    if (!overdraftApplication) {
        return res
            .status(404)
            .send(overdraft_1.generateEntityNotFoundPayload("application_id", applicationId));
    }
    const { account } = person;
    if (person.account.id !== accountId) {
        return res
            .status(404)
            .send(overdraft_1.generateEntityNotFoundPayload("account_id", accountId));
    }
    const overdraft = {
        id: node_uuid_1.default.v4(),
        status: types_1.OverdraftStatus.LIMIT_SET,
        person_id: personId,
        limit: overdraft_1.OVERDRAFT_LIMIT,
        interest_accrual_rate: overdraft_1.INTEREST_ACCRUAL_RATE,
        overdraft_rate: overdraft_1.OVERDRAFT_RATE,
        interest_conditions_enabled: true,
        created_at: new Date().toISOString(),
        account_id: accountId,
    };
    account.overdraft = overdraft;
    account.account_limit = overdraft_1.OVERDRAFT_LIMIT;
    overdraftApplication.overdraft_id = overdraft.id;
    await overdraft_1.changeOverdraftApplicationStatus({
        person,
        applicationId: overdraftApplication.id,
        status: types_1.OverdraftApplicationStatus.OVERDRAFT_CREATED,
    });
    res.status(201).send({
        ...overdraft,
        status: types_1.OverdraftStatus.CREATED,
    });
};
//# sourceMappingURL=overdraft.js.map