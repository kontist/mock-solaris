import _ from "lodash";
import type { Request, Response } from "express";
import uuid from "node-uuid";
import HttpStatusCodes from "http-status";

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

  let result;

  switch (name) {
    case "NO_MATCH":
      result = {
        status: "NO_MATCH",
      };
      break;
    case "VERIFICATION_NOT_POSSIBLE":
      result = {
        status: "VERIFICATION_NOT_POSSIBLE",
      };
      break;
    case "CLOSE_MATCH":
      result = {
        status: "CLOSE_MATCH",
        suggested_name: "John Doe",
      };
      break;
    default:
      result = {
        status: "MATCH",
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
