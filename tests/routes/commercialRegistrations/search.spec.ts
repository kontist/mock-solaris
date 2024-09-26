import { assert, match } from "sinon";
import { mockReq, mockRes } from "sinon-express-mock";
import HttpStatusCodes from "http-status";
import {
  search,
  SearchRequest,
} from "../../../src/routes/commercialRegistrations/search";
import { Registration } from "../../../src/routes/commercialRegistrations/types/registration";

describe("search", () => {
  it("Returns found business registrations if businesses are found", () => {
    const searchRequest: SearchRequest = {
      query: { name: "FLOOR", country: "DE" },
    };
    const mockSearchRequest = mockReq(searchRequest);
    const mockSearchResponse = mockRes();
    search(mockSearchRequest, mockSearchResponse);
    assert.calledWith(mockSearchResponse.status, HttpStatusCodes.OK);
    const expectedResponse1: Registration = {
      name: match(String),
      registration_number: match("HRB 198673"),
      registration_issuer: match("AMTSGERICHT MÜNCHEN"),
    };
    const expectedResponse2: Registration = {
      name: match(String),
      registration_number: match("HRB 198674"),
      registration_issuer: match("ISSUER MÜNCHEN"),
    };
    assert.calledWith(
      mockSearchResponse.send,
      match.some(match(expectedResponse1))
    );
    assert.calledWith(
      mockSearchResponse.send,
      match.some(match(expectedResponse2))
    );
  });

  it("returns an empty array if the business is not found and name requested is longer than 10 characters", () => {
    const searchRequest: SearchRequest = {
      query: { name: "someLongName", country: "DE" },
    };
    const mockSearchRequest = mockReq(searchRequest);
    const mockSearchResponse = mockRes();
    search(mockSearchRequest, mockSearchResponse);
    assert.calledWith(mockSearchResponse.status, HttpStatusCodes.OK);
    assert.calledWith(mockSearchResponse.send, []);
  });
});
