import { expect } from "chai";

import {
  STANDING_ORDER_PAYMENT_FREQUENCY,
  getNextOccurrenceDate,
} from "../../src/routes/standingOrders";
import moment from "moment";

describe("Standing orders", () => {
  const getDate = () => moment(new Date(0));

  describe("getNextOccurrenceDate", () => {
    [
      {
        reoccurrence: STANDING_ORDER_PAYMENT_FREQUENCY.MONTHLY,
        expectedDate: moment(getDate()).add(1, "month").toDate(),
      },
      {
        reoccurrence: STANDING_ORDER_PAYMENT_FREQUENCY.WEEKLY,
        expectedDate: moment(getDate()).add(1, "week").toDate(),
      },
      {
        reoccurrence: STANDING_ORDER_PAYMENT_FREQUENCY.BIWEEKLY,
        expectedDate: moment(getDate()).add(2, "week").toDate(),
      },
      {
        reoccurrence: STANDING_ORDER_PAYMENT_FREQUENCY.YEARLY,
        expectedDate: moment(getDate()).add(1, "year").toDate(),
      },
      {
        reoccurrence: STANDING_ORDER_PAYMENT_FREQUENCY.EVERY_SIX_MONTHS,
        expectedDate: moment(getDate()).add(6, "month").toDate(),
      },
      ,
      {
        reoccurrence: STANDING_ORDER_PAYMENT_FREQUENCY.QUARTERLY,
        expectedDate: moment(getDate()).add(1, "quarter").toDate(),
      },
    ].forEach(({ reoccurrence, expectedDate }) => {
      it(`should return the next occurrence date for ${reoccurrence}`, () => {
        const actualDate = getNextOccurrenceDate(
          getDate(),
          reoccurrence
        ).toDate();
        expect(actualDate).to.deep.equal(expectedDate);
      });
    });
  });
});
