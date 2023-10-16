import type { Request, Response } from "express";
import { IBAN, CountryCode } from "ibankit";

import { getLogger } from "../logger";

const log = getLogger("instantCreditTransfer");

export const getInstantReachability = (req: Request, res: Response) => {
  const { iban } = req.params;

  log.info(`Checking instant reachability for iban ${iban}`);

  let result = true;

  if (IBAN.isValid(iban)) {
    result = false;
  }

  // simulating unsuccessful result
  if (iban.includes(CountryCode.FR)) {
    result = false;
  }

  res.send({ sct_instant_reachability: result });
};
