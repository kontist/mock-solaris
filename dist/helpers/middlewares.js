"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withPerson = void 0;
const node_uuid_1 = __importDefault(require("node-uuid"));
const http_status_1 = __importDefault(require("http-status"));
const db_1 = require("../db");
exports.withPerson = async (req, res, next) => {
    const personId = req.params.person_id || (req.body || {}).person_id;
    if (!personId) {
        next();
        return;
    }
    const person = await db_1.getPerson(personId);
    if (!person) {
        res.status(http_status_1.default.NOT_FOUND).send({
            errors: [
                {
                    id: node_uuid_1.default.v4(),
                    status: 404,
                    code: "model_not_found",
                    title: "Model Not Found",
                    detail: `Couldn't find 'Solaris::Person' for id '${personId}'.`,
                },
            ],
        });
        return;
    }
    req.person = person;
    next();
};
//# sourceMappingURL=middlewares.js.map