import { getSepaDirectDebitReturns } from "../db";

import * as log from "../logger";

export const listReturnNotificationsHandler = async (req, res) => {
  const {
    filter: {
      account_id: accountId,
      recorded_at: { min, max },
    },
    page: { size, number },
  } = req.query;

  const minDate = new Date(min);
  const maxDate = new Date(max);

  const sepaDirectDebitReturns = (await getSepaDirectDebitReturns())
    .filter((directDebitReturn) => directDebitReturn.account_id === accountId)
    .filter((directDebitReturn) => {
      const ddrDate = new Date(directDebitReturn.recorded_at);
      return ddrDate >= minDate && ddrDate <= maxDate;
    })
    .slice((number - 1) * size, number * size);

  log.info(
    "(mockSolaris/listReturnNotificationsHandler) Listing sepa direct debit return notifications from Solaris",
    req.query,
    sepaDirectDebitReturns
  );

  res.send(sepaDirectDebitReturns);
};
