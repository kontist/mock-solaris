import sinon from "sinon";
import { expect } from "chai";
import { mockReq, mockRes } from "sinon-express-mock";

import * as topUps from "../../src/routes/topUps";
import * as stripeHelpers from "../../src/helpers/stripe";

describe("TopUps", () => {
  let stripeClientStub: sinon.SinonStubbedInstance<any>;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    stripeClientStub = {
      paymentIntents: {
        create: sandbox.stub(),
        list: sandbox.stub(),
        cancel: sandbox.stub(),
        retrieve: sandbox.stub(),
      },
      paymentMethods: {
        attach: sandbox.stub(),
        list: sandbox.stub(),
        retrieve: sandbox.stub(),
        detach: sandbox.stub(),
      },
    };
    sandbox.stub(stripeHelpers, "getStripeClient").returns(stripeClientStub);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("createTopUp", () => {
    it("should create a top-up", async () => {
      const req = mockReq({
        person: { id: "123", stripeCustomerId: "cust_123" },
        body: {
          amount: { value: 1000, currency: "usd" },
          payment_method_id: "pm_123",
        },
      });
      const res = mockRes();

      stripeClientStub.paymentIntents.create.resolves({ id: "pi_123" });

      await topUps.createTopUp(req, res);

      expect(res.send.calledOnce).to.be.true;
      expect(res.send.args[0][0].id).to.deep.equal("pi_123");
    });
  });

  describe("listTopUps", () => {
    it("should list top-ups", async () => {
      const req = mockReq({
        person: { id: "123", stripeCustomerId: "cust_123" },
      });
      const res = mockRes();

      stripeClientStub.paymentIntents.list.resolves({ data: [] });

      await topUps.listTopUps(req, res);

      expect(res.send.calledOnce).to.be.true;
      expect(res.send.args[0][0]).to.deep.equal([]);
    });
  });

  describe("listPaymentMethods", () => {
    it("should list payment methods", async () => {
      const req = mockReq({
        person: { id: "123", stripeCustomerId: "cust_123" },
      });
      const res = mockRes();

      const mockPaymentMethods = [
        {
          id: "pm_123",
          card: {
            last4: "1234",
            brand: "visa",
          },
        },
      ];

      stripeClientStub.paymentMethods.list.resolves({
        data: mockPaymentMethods,
      });

      await topUps.listPaymentMethods(req, res);

      expect(res.send.calledOnce).to.be.true;
      expect(res.send.args[0][0][0].payment_method_id).to.deep.equal("pm_123");
    });
  });

  describe("cancelTopUp", () => {
    it("should cancel a top-up", async () => {
      const req = mockReq({
        person: { id: "123", stripeCustomerId: "cust_123" },
        params: {
          topUpId: "pi_123",
        },
        body: {
          cancellation_reason: "some_reason",
        },
      });
      const res = mockRes();

      stripeClientStub.paymentIntents.cancel.resolves({});
      stripeClientStub.paymentIntents.retrieve.resolves({ id: "pi_123" });

      await topUps.cancelTopUp(req, res);

      expect(res.send.calledOnce).to.be.true;
      expect(res.send.args[0][0].id).to.deep.equal("pi_123");
    });
  });

  describe("deletePaymentMethod", () => {
    it("should delete a payment method", async () => {
      const req = mockReq({
        person: { id: "123", stripeCustomerId: "cust_123" },
        params: {
          paymentMethodId: "pm_123",
        },
      });
      const res = mockRes();

      stripeClientStub.paymentMethods.retrieve.resolves({
        id: "pm_123",
        customer: "cust_123",
      });

      await topUps.deletePaymentMethod(req, res);

      expect(res.send.calledOnce).to.be.true;
      expect(res.send.args[0][0].payment_method_id).to.deep.equal("pm_123");
    });

    it("should return 404 if payment method not found", async () => {
      const req = mockReq({
        person: { id: "123", stripeCustomerId: "cust_123" },
        params: {
          paymentMethodId: "pm_123",
        },
      });
      const res = mockRes();

      stripeClientStub.paymentMethods.retrieve.resolves({
        id: "pm_123",
        customer: "different_cust_id",
      });

      await topUps.deletePaymentMethod(req, res);

      expect(res.status.calledWith(404)).to.be.true;
      expect(res.send.calledOnce).to.be.true;
    });
  });
});
