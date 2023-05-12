import { expect } from "chai";
import { mockReq, mockRes } from "sinon-express-mock";
import { getAllPersons, flushDb } from "../src/db";
import { createPerson } from "../src/routes/persons";

describe("getAllPersons()", async () => {
  before(flushDb);
  after(flushDb);

  const numPersons = 5;
  it(`When ${numPersons} persons are added, getAllPersons() returns ${numPersons} persons`, async () => {
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
    const persons = await getAllPersons();
    expect(persons.length).to.equal(numPersons);
  });
});
