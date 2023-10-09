import {
  getWebhooks,
  saveWebhook,
  deleteWebhook,
  getWebhookByType,
} from "../db";
import generateID from "../helpers/id";

import * as log from "../logger";

export const indexWebhooksHandler = async (req, res) => {
  const { page: { size = 10, number = 1 } = {} } = req.query;
  const webhooks = await getWebhooks();
  const response = webhooks.slice((number - 1) * size, size * number);

  res.send(response);
};

const createWebhook = async (newWebhook) => {
  const webhook = await getWebhookByType(newWebhook.event_type);

  if (webhook?.url === newWebhook.url) {
    return false;
  }

  await saveWebhook(newWebhook);
  return true;
};

export const createWebhookHandler = async (req, res) => {
  const newWebhook = {
    id: generateID(),
    ...req.body,
  };

  log.info("createWebhook", { newWebhook });

  const wasWebhookCreated = await createWebhook(newWebhook);

  if (wasWebhookCreated) {
    res.status(201).send(newWebhook);
  } else {
    res.status(400).send("Webhook already exists");
  }
};

export const deleteWebhookHandler = async (req, res) => {
  const { webhookType } = req.params;

  log.info("deleteWebhook", { webhookType });

  await deleteWebhook(webhookType);

  res.status(204).send();
};
