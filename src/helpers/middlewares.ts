import uuid from "node-uuid";
import * as express from "express";
import HttpStatusCodes from "http-status";
import { getPerson } from "../db";
import { MockPerson } from "./types";

export type RequestWithPerson = express.Request & { person?: MockPerson };

export const withPerson = async (
  req: RequestWithPerson,
  res: express.Response,
  next: express.NextFunction
) => {
  const personId =
    req.params.person_id || req.params.personId || (req.body || {}).person_id;
  if (!personId) {
    next();
    return;
  }

  const person = await getPerson(personId);
  if (!person) {
    res.status(HttpStatusCodes.NOT_FOUND).send({
      errors: [
        {
          id: uuid.v4(),
          status: 404,
          code: "model_not_found",
          title: "Model Not Found",
          detail: `Couldn't find 'Solaris::Person' for id '${personId}'.`,
        },
      ],
    });
    return;
  }

  req.person = person;
  next();
};

export const withAccount = async (
  req: RequestWithPerson,
  res: express.Response,
  next: express.NextFunction
) => {
  const accountId = req.params.account_id || req.params.accountId;
  if (!accountId) {
    next();
    return;
  }

  if (req.person?.account?.id === accountId) {
    next();
    return;
  }

  res.status(HttpStatusCodes.NOT_FOUND).send({
    errors: [
      {
        id: uuid.v4(),
        status: 404,
        code: "model_not_found",
        title: "Model Not Found",
        detail: `Couldn't find 'Solaris::Account' for id '${accountId}'.`,
      },
    ],
  });
};
