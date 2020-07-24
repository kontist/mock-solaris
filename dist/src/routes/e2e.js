"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePerson = void 0;
const db_1 = require("../db");
exports.updatePerson = async (req, res) => {
    const { params: { person_id: personId }, body, } = req;
    const person = {
        ...(await db_1.getPerson(personId)),
        ...body,
    };
    await db_1.savePerson(person);
    return res.status(200).send(person);
};
//# sourceMappingURL=e2e.js.map