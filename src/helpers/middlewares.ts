import * as express from "express";
import HttpStatusCodes from "http-status";
import { getPerson, getBusiness } from "../db";
import { MockPerson, MockBusiness } from "./types";
import generateID from "./id";

export type RequestWithPerson = express.Request & { person?: MockPerson };
export type RequestWithBusiness = express.Request & { business?: MockBusiness };

export const withBusiness = async (
  req: RequestWithBusiness,
  res: express.Response,
  next: express.NextFunction
) => {
  const businessId =
    req.params.business_id ||
    req.params.businessId ||
    (req.body || {}).business_id;
  if (!businessId) {
    next();
    return;
  }

  const business = await getBusiness(businessId);

  if (!business) {
    res.status(HttpStatusCodes.NOT_FOUND).send({
      errors: [
        {
          id: generateID(),
          status: 404,
          code: "model_not_found",
          title: "Model Not Found",
          detail: `Couldn't find 'Solaris::Business' for id '${businessId}'.`,
        },
      ],
    });
    return;
  }

  req.business = business;
  next();
};

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
          id: generateID(),
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
        id: generateID(),
        status: 404,
        code: "model_not_found",
        title: "Model Not Found",
        detail: `Couldn't find 'Solaris::Account' for id '${accountId}'.`,
      },
    ],
  });
};
