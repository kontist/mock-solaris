import { assert, match } from "sinon";
import { mockReq, mockRes } from "sinon-express-mock";
import {
  search,
  SearchRequest,
} from "../../../src/routes/commercialRegistrations/search";
import { Registration } from "../../../src/routes/commercialRegistrations/types/registration";
import { issuerNames } from "../../../src/fixtures/issuerNames";

describe("search", () => {
  it("Returns found business registrations if businesses are found", () => {
    const searchRequest: SearchRequest = {
      query: { name: "FLOOR", country: "DE" },
    };
    const mockSearchRequest = mockReq(searchRequest);
    const mockSearchResponse = mockRes();
    search(mockSearchRequest, mockSearchResponse);
    assert.calledWith(mockSearchResponse.status, 200);
    const expectedResponse1: Registration = {
      registration_number: match("HRB 198673"),
      registration_issuer: match("AMTSGERICHT MÜNCHEN"),
    };
    const expectedResponse2: Registration = {
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

  it("Returns a business if the business is not found and the length of the name is between 4-10 characters", () => {
    const searchRequest: SearchRequest = {
      query: { name: "someName", country: "DE" },
    };
    const mockSearchRequest = mockReq(searchRequest);
    const mockSearchResponse = mockRes();
    search(mockSearchRequest, mockSearchResponse);
    assert.calledWith(mockSearchResponse.status, 200);
    const expectedResponse: Registration = {
      registration_number: match("HRB"),
      registration_issuer: match.in(issuerNames),
    };
    assert.calledWith(
      mockSearchResponse.send,
      match.some(match(expectedResponse))
    );
  });

  it("returns an empty array if the business is not found and name requested is longer than 10 characters", () => {
    const searchRequest: SearchRequest = {
      query: { name: "someLongName", country: "DE" },
    };
    const mockSearchRequest = mockReq(searchRequest);
    const mockSearchResponse = mockRes();
    search(mockSearchRequest, mockSearchResponse);
    assert.calledWith(mockSearchResponse.status, 404);
    assert.calledWith(mockSearchResponse.send, []);
  });
});
