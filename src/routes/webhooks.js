import uuid from "uuid";

import { getWebhooks, saveWebhook } from "../db";

import * as log from "../logger";

export const indexWebhooksHandler = async (req, res) => {
  const { page: { size = 10, number = 1 } = {} } = req.query;
  const webhooks = await getWebhooks();
  const response = webhooks.slice((number - 1) * size, size * number);

  res.send(response);
};

const createWebhook = async newWebhook => {
  const webhooks = await getWebhooks();

  const webhookExists = webhooks.find(webhook => {
    return (
      webhook.url === newWebhook.url &&
      webhook.event_type === newWebhook.event_type
    );
  });

  if (webhookExists) {
    return false;
  }

  await saveWebhook(newWebhook);
  return true;
};

export const createWebhookHandler = async (req, res) => {
  const newWebhook = {
    id: uuid.v4(),
    ...req.body
  };

  log.info("createWebhook", { newWebhook });

  const wasWebhookCreated = await createWebhook(newWebhook);

  if (wasWebhookCreated) {
    res.status(201).send(newWebhook);
  } else {
    res.status(400).send("Webhook already exists");
  }
};
