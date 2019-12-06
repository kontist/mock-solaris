import uuid from "uuid";
import fetch from "node-fetch";

import * as log from "../logger";
import { getWebhookByType } from "../db";
import { generateSolarisWebhookSignature } from "./solarisWebhookSignature";
import { CardWebhookEvent } from "./types";

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
      CardWebhookEvent.CARD_AUTHORIZATION_DECLINE
    ].includes(type)
  ) {
    const solarisWebhookSignature = generateSolarisWebhookSignature(
      payload,
      String(
        process.env
          .SOLARIS_CARD_AUTHORIZATION_WEBHOOK_ORIGIN_VERIFICATION_SECRET
      )
    );

    headers = {
      ...headers,
      "solaris-entity-id": "1b4a3103-f4ae-42c0-8de6-c6fda9ed60f7",
      "solaris-webhook-attempt": "1",
      "solaris-webhook-event-type": type,
      "solaris-webhook-id": "4d201164-6c5f-4932-9525-abdefc00f5d5",
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
