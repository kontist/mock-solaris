import sinon from "sinon";
import { expect } from "chai";

import { isVerificationOfPayeeEnabled } from "../../src/helpers/verificationOfPayee";

describe("isVerificationOfPayeeEnabled", () => {
  let clock;

  afterEach(() => {
    clock.restore();
  });

  it("should return true if verification of payee is enabled", () => {
    // 1st November 2025
    clock = sinon.useFakeTimers(new Date(2025, 10, 1).getTime());

    expect(isVerificationOfPayeeEnabled()).to.be.true;
  });

  it("should return false if verification of payee is not enabled", () => {
    // 1st October 2025
    clock = sinon.useFakeTimers(new Date(2025, 9, 1).getTime());

    expect(isVerificationOfPayeeEnabled()).to.be.false;
  });
});
