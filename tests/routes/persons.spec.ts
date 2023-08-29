import sinon from "sinon";
import { expect } from "chai";
import { mockReq, mockRes } from "sinon-express-mock";

import * as db from "../../src/db";
import * as personsApi from "../../src/routes/persons";
import * as changeRequestApi from "../../src/routes/changeRequest";
import { DeliveryMethod } from "../../src/helpers/types";

describe("Persons", () => {
  describe("updatePerson", () => {
    let res: sinon.SinonSpy;
    let personId: string;
    let changeRequestId: string;

    describe("when fields were null before", () => {
      const data = {
        email: "tester@kontist.com",
        business_purpose: "some purpose",
        business_trading_name: "ACME Corp.",
        nace_code: "A",
        website_social_media: "https://kontist.com",
      };

      before(async () => {
        await db.flushDb();
        res = mockRes();
        await personsApi.createPerson(
          {
            body: {},
            headers: {},
          },
          res
        );

        personId = res.send.args[0][0].id;

        await db.saveMobileNumber(personId, {
          number: "+491234567890",
          verified: true,
        });

        const req = mockReq({
          params: {
            person_id: personId,
          },
          body: data,
        });

        await personsApi.updatePerson(req, res);
      });

      it("should return updated person", async () => {
        const lastCall = res.send.args[res.send.args.length - 1];
        expect(lastCall[0]).to.include(data);
      });

      describe("when fields were already set", () => {
        const newData = {
          email: "tester2@kontist.com",
          business_purpose: "some purpose 2",
          business_trading_name: "ACME Inc.",
          nace_code: "B",
          website_social_media: "https://acme.com",
          address: {
            line_1: "line 1",
            line_2: "line 2",
            postal_code: "12345",
            city: "Berlin",
            country: "DE",
          },
        };

        before(async () => {
          res = mockRes();
          const req = mockReq({
            params: {
              person_id: personId,
            },
            body: newData,
          });

          await personsApi.updatePerson(req, res);
        });

        it("should return confirmation id", async () => {
          const lastCall = res.send.args[res.send.args.length - 1];
          changeRequestId = lastCall[0].id;
          expect(changeRequestId).to.be.a("string");
        });

        describe("confirming change request flow", () => {
          it("should update person", async () => {
            const changeReq = mockReq({
              params: {
                change_request_id: changeRequestId,
              },
              body: {
                person_id: personId,
                delivery_method: DeliveryMethod.MOBILE_NUMBER,
              },
            });
            await changeRequestApi.authorizeChangeRequest(changeReq, res);

            const person = await db.getPerson(personId);
            const tan = person.changeRequest.token;

            const confirmReq = mockReq({
              params: {
                change_request_id: changeRequestId,
              },
              body: {
                person_id: personId,
                tan,
              },
            });
            await changeRequestApi.confirmChangeRequest(confirmReq, res);

            const response = res.send.args[res.send.args.length - 1][0];
            expect(response.status).to.equal("COMPLETED");
            expect(response.id).to.equal(changeRequestId);
            expect(response.response_body.address).to.include(newData.address);
            delete newData.address;
            expect(response.response_body).to.include(newData);
          });
        });
      });
    });
  });

  after(db.flushDb);
});
