"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const cardAuthorization_1 = require("../../src/helpers/cardAuthorization");
describe("cardAuthorization", () => {
    describe("#mapReservationToCardAuthorization", () => {
        describe("when valid reservation is provided", () => {
            it("should return a valid response", () => {
                // arrange
                const reservation = {
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
                const result = cardAuthorization_1.mapReservationToCardAuthorization(reservation);
                // assert
                chai_1.expect(result).to.deep.equal({
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
//# sourceMappingURL=cardAuthorization.spec.js.map