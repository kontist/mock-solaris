import fetch, { Response } from "node-fetch";

import * as log from "../logger";
import { PostboxItemEvent, WebhookType } from "../helpers/types";
import {
  getBusinessOrigin,
  getPersonOrigin,
  getWebhookByType,
  setBusinessOrigin,
  setPersonOrigin,
} from "../db";
import { generateSolarisWebhookSignature } from "./solarisWebhookSignature";
import {
  CardWebhookEvent,
  OverdraftApplicationWebhookEvent,
  PersonWebhookEvent,
  TransactionWebhookEvent,
  AccountWebhookEvent,
} from "./types";
import generateID from "./id";

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
  [CardWebhookEvent.CARD_AUTHORIZATION_DECLINE_V2]:
    process.env.SOLARIS_CARD_AUTHORIZATION_DECLINE_V2_WEBHOOK_SECRET,
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
  [PersonWebhookEvent.PERSON_SEIZURE_FULFILLED]:
    process.env.SOLARIS_PERSON_SEIZURE_FULFILLED_WEBHOOK_SECRET,
  [PersonWebhookEvent.PERSON_DELETED]:
    process.env.SOLARIS_PERSON_DELETED_WEBHOOK_SECRET,
  [PersonWebhookEvent.PERSON_CHANGED]:
    process.env.SOLARIS_PERSON_CHANGED_WEBHOOK_SECRET,
  [PersonWebhookEvent.QUESTIONS_REQUIRE_RESPONSE]:
    process.env.SOLARIS_QUESTIONS_REQUIRE_RESPONSE_WEBHOOK_SECRET,

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
  [PostboxItemEvent.POSTBOX_ITEM_CREATED]:
    process.env.SOLARIS_POSTBOX_ITEM_CREATED_WEBHOOK_SECRET,
  [PersonWebhookEvent.ACCOUNT_OPENING_REQUEST]:
    process.env.SOLARIS_ACCOUNT_OPENING_REQUEST_WEBHOOK_SECRET,
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
  businessId,
}: {
  type: WebhookType;
  payload: Record<string, unknown>;
  extraHeaders?: Record<string, unknown>;
  personId?: string;
  businessId?: string;
}) => {
  const webhook = await getWebhookByType(type);

  if (!webhook) {
    log.warning(`(triggerWebhook) Webhook with type "${type}" does not exist`);
    return;
  }

  let headers: Record<string, string> = { "Content-Type": "application/json" };

  const body = {
    id: generateID(),
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
      "solaris-webhook-id": generateID(),
      "solaris-webhook-signature": solarisWebhookSignature,
      "solaris-webhook-subscription-id": "STATIC-SUBSCRIPTION",
      ...extraHeaders,
    };
  }

  const triggerRequest = async (url) => {
    const requestBody = JSON.stringify(body);
    const response = await fetch(url, {
      method: "POST",
      body: requestBody,
      headers,
    });

    if (!response.ok) {
      throw new WebhookRequestError(response, requestBody);
    }
  };

  let webhookUrl;
  let personOrigin;
  let businessOrigin;

  if (personId) {
    personOrigin = personId && (await getPersonOrigin(personId));
    webhookUrl = getWebhookUrl(webhook.url, personOrigin);
  }

  if (businessId) {
    businessOrigin = businessId && (await getBusinessOrigin(businessId));
    webhookUrl = getWebhookUrl(webhook.url, businessOrigin);
  }

  try {
    await triggerRequest(webhookUrl);
  } catch (err) {
    if (personOrigin && (err.code === "ECONNREFUSED" || err.statusCode > 500)) {
      // if preview env doesn't exist anymore,
      // we reset the origin and retrigger request with default webhook url
      await setPersonOrigin(personId);
      await triggerRequest(getWebhookUrl(webhook.url));
      return;
    }

    if (
      businessOrigin &&
      (err.code === "ECONNREFUSED" || err.statusCode > 500)
    ) {
      // if preview env doesn't exist anymore,
      // we reset the origin and retrigger request with default webhook url
      await setBusinessOrigin(businessId);
      await triggerRequest(getWebhookUrl(webhook.url));
      return;
    }

    log.error(`Webhook request to ${webhookUrl} failed`, err);
    throw err;
  }
};
