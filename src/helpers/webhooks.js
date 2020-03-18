import uuid from "uuid";
import fetch from "node-fetch";

import * as log from "../logger";
import { getWebhookByType } from "../db";
import { generateSolarisWebhookSignature } from "./solarisWebhookSignature";
import { CardWebhookEvent, OverdraftApplicationWebhookEvent } from "./types";

const SOLARIS_CARD_AUTHORIZATION_WEBHOOK_ORIGIN_VERIFICATION_SECRET = String(
  process.env.SOLARIS_CARD_AUTHORIZATION_WEBHOOK_ORIGIN_VERIFICATION_SECRET
);

const SOLARIS_OVERDRAFT_APPLICATION_WEBHOOK_ORIGIN_VERIFICATION_SECRET = String(
  process.env.SOLARIS_OVERDRAFT_APPLICATION_WEBHOOK_ORIGIN_VERIFICATION_SECRET
);

const verificationSecret = {
  [OverdraftApplicationWebhookEvent.OVERDRAFT_APPLICATION]: SOLARIS_OVERDRAFT_APPLICATION_WEBHOOK_ORIGIN_VERIFICATION_SECRET,
  [CardWebhookEvent.CARD_AUTHORIZATION]: SOLARIS_CARD_AUTHORIZATION_WEBHOOK_ORIGIN_VERIFICATION_SECRET,
  [CardWebhookEvent.CARD_AUTHORIZATION_RESOLUTION]: SOLARIS_CARD_AUTHORIZATION_WEBHOOK_ORIGIN_VERIFICATION_SECRET,
  [CardWebhookEvent.CARD_AUTHORIZATION_DECLINE]: SOLARIS_CARD_AUTHORIZATION_WEBHOOK_ORIGIN_VERIFICATION_SECRET
};
export const triggerWebhook = async (type, payload) => {
  const webhook = await getWebhookByType(type);

  if (!webhook) {
    log.warn(`(triggerWebhook) Webhook with type "${type}" does not exist`);
    return;
  }

  let headers = { "Content-Type": "application/json" };

  if (
    [
      CardWebhookEvent.CARD_AUTHORIZATION,
      CardWebhookEvent.CARD_AUTHORIZATION_RESOLUTION,
      CardWebhookEvent.CARD_AUTHORIZATION_DECLINE,
      OverdraftApplicationWebhookEvent.OVERDRAFT_APPLICATION
    ].includes(type)
  ) {
    const solarisWebhookSignature = generateSolarisWebhookSignature(
      payload,
      verificationSecret[type]
    );

    headers = {
      ...headers,
      "solaris-entity-id": payload.id || uuid.v4(),
      "solaris-webhook-attempt": "1",
      "solaris-webhook-event-type": type,
      "solaris-webhook-id": uuid.v4(),
      "solaris-webhook-signature": solarisWebhookSignature,
      "solaris-webhook-subscription-id": "STATIC-SUBSCRIPTION"
    };
  }

  await fetch(webhook.url, {
    method: "POST",
    body: JSON.stringify({
      id: uuid.v4(),
      ...payload
    }),
    headers
  });
};
