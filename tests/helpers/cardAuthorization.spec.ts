import { expect } from "chai";

import { mapReservationToCardAuthorization } from "../../src/helpers/cardAuthorization";

describe("cardAuthorization", () => {
  describe("#mapReservationToCardAuthorization", () => {
    describe("when valid reservation is provided", () => {
      it("should return a valid response", () => {
        // arrange
        const reservation: any = {
          amount: { value: 123, unit: "cents", currency: "EUR" },
          meta_info: JSON.stringify({
            cards: {
              card_id: "ci",
              transaction_type: "tt",
              transaction_time: "NOW",
              pos_entry_mode: "pem",
              merchant: "m",
              original_amount: 456,
            },
          }),
        };

        // act
        const result = mapReservationToCardAuthorization(reservation);

        // assert
        expect(result).to.deep.equal({
          card_id: "ci",
          type: "tt",
          status: "DECLINED",
          attempted_at: "NOW",
          pos_entry_mode: "pem",
          merchant: "m",
          amount: { value: 123, unit: "cents", currency: "EUR" },
          original_amount: 456,
        });
      });
    });
  });
});
