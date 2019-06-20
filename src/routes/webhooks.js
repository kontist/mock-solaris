import uuid from "uuid";

import { getWebhooks, saveWebhook } from "../db";

import * as log from "../logger";

export const indexWebhooks = async (req, res) => {
  const webhooks = await getWebhooks();
  log.info("indexWebhooks", JSON.stringify(webhooks));
  res.send(webhooks);
};

export const createWebhook = async (req, res) => {
  const newWebhook = {
    id: uuid.v4(),
    ...req.body
  };

  log.info("createWebhook", JSON.stringify(newWebhook));

  const webhooks = await getWebhooks();

  const hasWebhookAlready = webhooks.find(webhook => {
    return (
      webhook.url === newWebhook.url &&
      webhook.event_type === newWebhook.event_type
    );
  });

  if (hasWebhookAlready) {
    return res.status(400).send("Webhook already exists");
  }

  saveWebhook(newWebhook);

  res.status(201).send(newWebhook);
};
