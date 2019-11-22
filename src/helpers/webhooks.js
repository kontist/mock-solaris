import fetch from "node-fetch";

import * as log from "../logger";
import { getWebhookByType } from "../db";

export const triggerWebhook = async (type, payload) => {
  const webhook = await getWebhookByType(type);

  if (!webhook) {
    log.warn(`(triggerWebhook) Webhook with type "${type}" does not exist`);
    return;
  }

  await fetch(webhook.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
};
