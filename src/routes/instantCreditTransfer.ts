import type { Request, Response } from "express";
import { getLogger } from "../logger";

const log = getLogger("instantCreditTransfer");

export const getInstantReachability = (req: Request, res: Response) => {
  const { iban } = req.params;

  log.info(`Checking instant reachability for iban ${iban}`);

  let result = true;

  // simulating unsuccessful result
  if (iban.includes("FR")) {
    result = false;
  }

  res.send({ sct_instant_reachability: result });
};
