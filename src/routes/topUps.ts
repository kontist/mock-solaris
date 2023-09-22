import Stripe from "stripe";
import type { Response } from "express";
import HttpStatusCodes from "http-status";
import uuid from "node-uuid";

import { RequestWithPerson } from "../helpers/middlewares";
import { getStripeClient } from "../helpers/stripe";
import { getLogger } from "../logger";
import * as backofficeHelpers from "./backoffice";
import * as db from "../db";
import { BookingType } from "../helpers/types";

const log = getLogger("topUps");

const TOP_UP_CHECK_DELAY_IN_MS = 3000;

const mapPaymentIntentToTopUp = (
  paymentIntent: Stripe.Response<Stripe.PaymentIntent>
) => ({
  id: paymentIntent.id,
  amount: paymentIntent.amount,
  acquirer_error_code: null,
  acquirer_decline_code: null,
  cancellation_reason: null,
  decline_reason: null,
  client_secret: paymentIntent.client_secret,
  status: paymentIntent.status,
  instruction_id: null,
});

export const checkTopUpForBookingCreation = async (data: {
  amount: number;
  personId: string;
  retry: boolean;
  paymentIntentId: string;
}) => {
  const { amount, personId, retry, paymentIntentId } = data;

  try {
    const paymentIntent = await getStripeClient().paymentIntents.retrieve(
      paymentIntentId
    );

    if (paymentIntent.status === "succeeded") {
      const person = await db.getPerson(personId);
      const now = new Date().toISOString().split("T")[0];
      person.transactions.push(
        backofficeHelpers.generateBookingForPerson({
          person,
          amount,
          purpose: "Top-up",
          senderName: `${person.first_name} ${person.last_name}`,
          endToEndId: paymentIntentId,
          bookingType: BookingType.SEPA_CREDIT_TRANSFER,
          bookingDate: now,
          valutaDate: now,
        })
      );
      await db.savePerson(person);
      await backofficeHelpers.triggerBookingsWebhook(person);
      log.info(`TopUp ${paymentIntentId} was successful`, person.id);
    } else {
      if (retry) {
        log.warning(`TopUp ${paymentIntentId} was not successful`);
        return;
      }

      await new Promise((resolve) =>
        setTimeout(() => {
          checkTopUpForBookingCreation({
            ...data,
            retry: true,
          });
          resolve(null);
        }, TOP_UP_CHECK_DELAY_IN_MS)
      );
    }
  } catch (err) {
    log.error(
      `Error while checking top up for booking creation`,
      err,
      paymentIntentId
    );
  }
};

export const createTopUp = async (req: RequestWithPerson, res: Response) => {
  log.info(`Creating top up for ${req.person.id}`, req.body);

  const {
    amount: { value: amount, currency },
    payment_method_id: paymentMethodId,
  } = req.body;

  if (paymentMethodId) {
    await getStripeClient().paymentMethods.attach(paymentMethodId, {
      customer: req.person.stripeCustomerId,
    });
  }

  const paymentIntent = await getStripeClient().paymentIntents.create({
    amount,
    currency,
    customer: req.person.stripeCustomerId,
    automatic_payment_methods: {
      enabled: true,
    },
    ...(paymentMethodId ? { payment_method: paymentMethodId } : {}),
  });

  res.send(mapPaymentIntentToTopUp(paymentIntent));

  setTimeout(() => {
    checkTopUpForBookingCreation({
      retry: false,
      amount,
      personId: req.person.id,
      paymentIntentId: paymentIntent.id,
    });
  }, TOP_UP_CHECK_DELAY_IN_MS);
};

export const listTopUps = async (req: RequestWithPerson, res: Response) => {
  log.info(`Fetching list of top ups for ${req.person.id}`);

  const paymentIntents = await getStripeClient().paymentIntents.list({
    customer: req.person.stripeCustomerId,
  });

  res.send(paymentIntents.data.map(mapPaymentIntentToTopUp));
};

export const listPaymentMethods = async (
  req: RequestWithPerson,
  res: Response
) => {
  log.info(`Fetching list of payment methods for ${req.person.id}`);

  const paymentMethods = await getStripeClient().paymentMethods.list({
    customer: req.person.stripeCustomerId,
  });

  res.send(
    paymentMethods.data
      .filter((pm) => !!pm?.card?.last4)
      .map((pm) => ({
        person_id: req.person.id,
        payment_method_id: pm.id,
        card_last4: pm.card.last4,
        card_brand: pm.card.brand,
      }))
  );
};

export const deletePaymentMethod = async (
  req: RequestWithPerson,
  res: Response
) => {
  log.info(`Deleting payment method for ${req.person.id}`, req.body);

  const paymentMethod = await getStripeClient().paymentMethods.retrieve(
    req.params.paymentMethodId
  );
  if (paymentMethod.customer !== req.person.stripeCustomerId) {
    res.status(HttpStatusCodes.NOT_FOUND).send({
      errors: [
        {
          id: uuid.v4(),
          status: 404,
          code: "model_not_found",
          title: "Model Not Found",
          detail: `Couldn't find 'Solaris::PaymentMethod' for id '${req.person.id}'.`,
        },
      ],
    });
    return;
  }

  await getStripeClient().paymentMethods.detach(req.params.paymentMethodId);

  res.send({
    payment_method_id: req.params.paymentMethodId,
  });
};

export const cancelTopUp = async (req: RequestWithPerson, res: Response) => {
  log.info(`Canceling top up for ${req.person.id}`, req.body);

  await getStripeClient().paymentIntents.cancel(req.params.topUpId, {
    cancellation_reason: req.body.cancellation_reason,
  });

  const paymentIntent = await getStripeClient().paymentIntents.retrieve(
    req.params.topUpId
  );

  res.send(mapPaymentIntentToTopUp(paymentIntent));
};
