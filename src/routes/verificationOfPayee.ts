import _ from "lodash";
import type { Request, Response } from "express";
import uuid from "node-uuid";
import HttpStatusCodes from "http-status";

const nameValidation: RegExp = /^[\p{L}\p{M}\p{N}\p{P}\p{S}\s]+$/u;

const noMatchRegex: RegExp = /no[_ ]match/i;
const notPossibleRegex: RegExp = /not[_ ]possible/i;
const closeMatchRegex: RegExp = /close[_ ]match/i;

/**
 * Creates a verification of Payee
 *
 * By default will always return a "MATCH" status.
 * For other statuses use the appropriate regex patterns in the name field.
 * - "NO_MATCH": if name contains "no match" or "no_match" - case insensitive
 * - "VERIFICATION_NOT_POSSIBLE": if name contains "not possible" or "not_possible" - case insensitive
 * - "CLOSE_MATCH": if name contains "close match" or "close_match" - case insensitive
 *
 * @see https://docs.solarisgroup.com/api-reference/digital-banking/sepa-transfers/#tag/Verification-of-Payee/paths/~1v1~1verifications_of_payee/post
 */
export const verifyPayee = (req: Request, res: Response) => {
  const data = _.pick(req.body, ["iban", "name"]);
  const { iban, name } = data;

  if (!iban) {
    return res.status(HttpStatusCodes.BAD_REQUEST).send({
      errors: [
        {
          id: uuid.v4(),
          status: HttpStatusCodes.BAD_REQUEST,
          code: "bad_request",
          title: "Bad Request",
          detail: "IBAN is required.",
        },
      ],
    });
  }

  if (!name) {
    return res.status(HttpStatusCodes.BAD_REQUEST).send({
      errors: [
        {
          id: uuid.v4(),
          status: HttpStatusCodes.BAD_REQUEST,
          code: "bad_request",
          title: "Bad Request",
          detail: "Name is required.",
        },
      ],
    });
  }

  if (!nameValidation.test(name) || name.length > 140) {
    return res.status(HttpStatusCodes.BAD_REQUEST).send({
      errors: [
        {
          id: uuid.v4(),
          status: HttpStatusCodes.BAD_REQUEST,
          code: "bad_request",
          title: "Bad Request",
          detail: "Name is not valid.",
        },
      ],
    });
  }

  let result: { status: string; suggested_name?: string } = { status: "MATCH" };

  if (noMatchRegex.test(name)) {
    result = {
      status: "NO_MATCH",
    };
  }

  if (notPossibleRegex.test(name)) {
    result = {
      status: "VERIFICATION_NOT_POSSIBLE",
    };
  }

  if (closeMatchRegex.test(name)) {
    result = {
      status: "CLOSE_MATCH",
      suggested_name: "Giovanni Kontistini",
    };
  }

  const dateNow = new Date();
  const response = {
    id: uuid.v4(),
    payee: {
      iban,
      name,
    },
    result,
    created_at: dateNow.toISOString(),
    expires_at: new Date(dateNow.getTime() + 5 * 60 * 1000).toISOString(),
  };

  return res.status(HttpStatusCodes.CREATED).send(response);
};
