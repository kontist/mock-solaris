import { expect } from "chai";
import { mockReq, mockRes } from "sinon-express-mock";
import { getPersons, flushDb } from "../src/db";
import { createPerson } from "../src/routes/persons";

describe("getPersons()", async () => {
  before(flushDb);
  after(flushDb);

  it(`getAllPersons() returns all persons`, async () => {
    const numPersons = 5;
    for (let i = 1; i <= numPersons; i++) {
      const req = mockReq({
        body: {
          email: `user${i}@kontist.com`,
        },
        headers: { origin: "Tatooine" },
      });
      const res = mockRes();
      await createPerson(req, res);
    }
    const persons = await getPersons();
    expect(persons.length).to.equal(numPersons);
  });
});
