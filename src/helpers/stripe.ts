import Stripe from "stripe";
import { RequestWithPerson } from "./middlewares";
import { NextFunction, Response } from "express";
import * as db from "../db";

let _stripe: Stripe;
export const getStripeClient = () => {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_API_KEY, {
      apiVersion: "2023-08-16",
    });
  }

  return _stripe;
};

export const createStripeCustomerIfNotExistsMiddleware = async (
  req: RequestWithPerson,
  res: Response,
  next: NextFunction
) => {
  const { person } = req;

  if (!person.stripeCustomerId) {
    const stripeCustomer = await getStripeClient().customers.create({
      name: `${person.first_name} ${person.last_name}`,
      email: person.email,
    });

    person.stripeCustomerId = stripeCustomer.id;
    await db.savePerson(person);
    req.person = person;
  }

  next();
};
