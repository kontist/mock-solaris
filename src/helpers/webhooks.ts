import uuid from "node-uuid";
import fetch, { Response } from "node-fetch";

import * as log from "../logger";
import { WebhookType } from "../helpers/types";
import { getPersonOrigin, getWebhookByType, setPersonOrigin } from "../db";
import { generateSolarisWebhookSignature } from "./solarisWebhookSignature";
import {
  CardWebhookEvent,
  OverdraftApplicationWebhookEvent,
  PersonWebhookEvent,
  TransactionWebhookEvent,
  AccountWebhookEvent,
} from "./types";

class WebhookRequestError extends Error {
  statusCode: number;
  statusText: string;
  responseText?: string;
  requestBody?: string;
  url: string;

  constructor(response: Response, requestBody?: string) {
    super();
    this.url = response.url;
    this.name = this.constructor.name;
    this.statusCode = response.status;
    this.statusText = response.statusText;
    this.requestBody = requestBody;
  }
}

const WEBHOOK_SECRETS = {
  [OverdraftApplicationWebhookEvent.OVERDRAFT_APPLICATION]:
    process.env.SOLARIS_OVERDRAFT_APPLICATION_WEBHOOK_SECRET,

  [CardWebhookEvent.CARD_AUTHORIZATION]:
    process.env.SOLARIS_CARD_AUTHORIZATION_WEBHOOK_SECRET,
  [CardWebhookEvent.CARD_AUTHORIZATION_RESOLUTION]:
    process.env.SOLARIS_CARD_AUTHORIZATION_RESOLUTION_WEBHOOK_SECRET,
  [CardWebhookEvent.CARD_AUTHORIZATION_DECLINE]:
    process.env.SOLARIS_CARD_AUTHORIZATION_DECLINE_WEBHOOK_SECRET,
  [CardWebhookEvent.CARD_FRAUD_CASE_PENDING]:
    process.env.SOLARIS_CARD_FRAUD_CASE_PENDING_WEBHOOK_SECRET,
  [CardWebhookEvent.CARD_FRAUD_CASE_TIMEOUT]:
    process.env.SOLARIS_CARD_FRAUD_CASE_TIMEOUT_WEBHOOK_SECRET,
  [CardWebhookEvent.CARD_LIFECYCLE_EVENT]:
    process.env.SOLARIS_CARD_LIFECYCLE_EVENT_WEBHOOK_SECRET,
  [CardWebhookEvent.CARD_TOKEN_LIFECYCLE]:
    process.env.SOLARIS_CARD_TOKEN_LIFECYCLE_WEBHOOK_SECRET,
  [CardWebhookEvent.SCA_CHALLENGE]:
    process.env.SOLARIS_CARD_SCA_CHALLENGE_WEBHOOK_SECRET,

  [PersonWebhookEvent.IDENTIFICATION]:
    process.env.SOLARIS_IDENTIFICATION_WEBHOOK_SECRET,
  [PersonWebhookEvent.PERSON_SEIZURE_CREATED]:
    process.env.SOLARIS_PERSON_SEIZURE_CREATED_WEBHOOK_SECRET,
  [PersonWebhookEvent.PERSON_SEIZURE_DELETED]:
    process.env.SOLARIS_PERSON_SEIZURE_DELETED_WEBHOOK_SECRET,
  [PersonWebhookEvent.PERSON_DELETED]:
    process.env.SOLARIS_PERSON_DELETED_WEBHOOK_SECRET,
  [PersonWebhookEvent.PERSON_CHANGED]:
    process.env.SOLARIS_PERSON_CHANGED_WEBHOOK_SECRET,

  [TransactionWebhookEvent.BOOKING]: process.env.SOLARIS_BOOKING_WEBHOOK_SECRET,
  [TransactionWebhookEvent.SEPA_SCHEDULED_TRANSACTION]:
    process.env.SOLARIS_SEPA_SCHEDULED_TRANSACTION_WEBHOOK_SECRET,
  [TransactionWebhookEvent.SEPA_TIMED_ORDER]:
    process.env.SOLARIS_SEPA_TIMED_ORDER_WEBHOOK_SECRET,
  [TransactionWebhookEvent.SEPA_DIRECT_DEBIT_RETURN]:
    process.env.SOLARIS_SEPA_DIRECT_DEBIT_RETURN_WEBHOOK_SECRET,

  [AccountWebhookEvent.ACCOUNT_BLOCK]:
    process.env.SOLARIS_ACCOUNT_BLOCK_WEBHOOK_SECRET,
  [AccountWebhookEvent.ACCOUNT_CLOSURE]:
    process.env.SOLARIS_ACCOUNT_CLOSURE_WEBHOOK_SECRET,
  [AccountWebhookEvent.ACCOUNT_LIMIT_CHANGE]:
    process.env.SOLARIS_ACCOUNT_LIMIT_CHANGE_WEBHOOK_SECRET,
};

export const getWebhookUrl = (url: string, origin?: string) => {
  return origin
    ? `${origin.replace(/\/$/, "")}/${url.split("/").splice(3).join("/")}`
    : url;
};

export const triggerWebhook = async ({
  type,
  payload,
  extraHeaders = {},
  personId,
}: {
  type: WebhookType;
  payload: Record<string, unknown>;
  extraHeaders?: Record<string, unknown>;
  personId?: string;
}) => {
  const webhook = await getWebhookByType(type);

  if (!webhook) {
    log.warn(`(triggerWebhook) Webhook with type "${type}" does not exist`);
    return;
  }

  let headers: Record<string, string> = { "Content-Type": "application/json" };

  const body = {
    id: uuid.v4(),
    ...payload,
  };

  if (WEBHOOK_SECRETS[type]) {
    const solarisWebhookSignature = generateSolarisWebhookSignature(
      body,
      WEBHOOK_SECRETS[type]
    );

    headers = {
      ...headers,
      "solaris-entity-id": body.id,
      "solaris-webhook-attempt": "1",
      "solaris-webhook-event-type": type,
      "solaris-webhook-id": uuid.v4(),
      "solaris-webhook-signature": solarisWebhookSignature,
      "solaris-webhook-subscription-id": "STATIC-SUBSCRIPTION",
      ...extraHeaders,
    };
  }

  const personOrigin = personId && (await getPersonOrigin(personId));
  const webhookUrl = getWebhookUrl(webhook.url, personOrigin);

  console.log({
    personOrigin,
    webhookUrl,
  });

  try {
    const requestBody = JSON.stringify(body);
    const response = await fetch(webhookUrl, {
      method: "POST",
      body: requestBody,
      headers,
    });

    if (!response.ok) {
      throw new WebhookRequestError(response, requestBody);
    }
  } catch (err) {
    if (personOrigin && (err.code === "ECONNREFUSED" || err.statusCode > 500)) {
      await setPersonOrigin(personId, null);
    }

    log.error(`Webhook request to ${webhookUrl} failed`, err);
    throw err;
  }
};
