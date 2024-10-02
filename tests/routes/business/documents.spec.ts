import { expect } from "chai";
import sinon from "sinon";
import { mockReq, mockRes } from "sinon-express-mock";

import { postDocument } from "../../../src/routes/business/documents";

describe("postDocument", () => {
  let res: sinon.SinonSpy;
  const documentType = "SIGNED_CONTRACT";

  before(async () => {
    res = mockRes();
    const req = mockReq({
      params: {
        business_id: "1234abc",
      },
      body: {
        document_type: documentType,
      },
      file: Buffer.from("file").toString("base64"),
    });
    await postDocument(req, res);
  });

  it("should return document data", async () => {
    const lastCall = res.send.args[res.send.args.length - 1];
    expect(lastCall[0].id).to.be.a("string");
    expect(lastCall[0].document_type).to.equal(documentType);
  });
});
