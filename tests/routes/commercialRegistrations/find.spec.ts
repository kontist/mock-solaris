import { assert } from "sinon";
import { mockReq, mockRes } from "sinon-express-mock";
import {
  find,
  modelNotFoundError,
} from "../../../src/routes/commercialRegistrations/find";
import { Business } from "../../../src/routes/commercialRegistrations/types/business";

describe("find", () => {
  it("Returns a found business if the business is in the fixture", async () => {
    const findRequest = mockReq({
      query: {
        registration_number: "HRB198673",
        registration_issuer: "AMTSGERICHT MÜNCHEN",
        country: "DE",
      },
    });
    const findResponse = mockRes();
    find(findRequest, findResponse);
    assert.calledWith(findResponse.status, 200);
    assert.calledWithMatch(findResponse.send, {
      registration_number: "HRB 198673",
      registration_issuer: "AMTSGERICHT MÜNCHEN",
    });
  });

  it("Returns a business if number and issuer requested does not exist and length of both are between 4-10 characters", async () => {
    const findRequest = mockReq({
      query: {
        registration_number: "someNumber",
        registration_issuer: "someIssuer",
        country: "DE",
      },
    });
    const findResponse = mockRes();
    find(findRequest, findResponse);
    assert.calledWith(findResponse.status, 200);
    const expectedBusiness: Partial<Business> = {
      registration_number: "someNumber",
      registration_issuer: "someIssuer",
    };
    assert.calledWithMatch(findResponse.send, expectedBusiness);
  });

  it("Returns error if business is not found and enter more than characters for both number and issuer", async () => {
    const findRequest = mockReq({
      query: {
        registration_number: "someLongNumber",
        registration_issuer: "someLongIssuer",
        country: "DE",
      },
    });
    const findResponse = mockRes();
    find(findRequest, findResponse);
    assert.calledWith(findResponse.status, 404);
    assert.calledWithMatch(findResponse.send, modelNotFoundError);
  });
});
