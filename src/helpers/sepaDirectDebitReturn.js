import uuid from "uuid";
import fetch from "node-fetch";

import * as log from "../logger";

import { getSepaDirectDebitReturnWebhook } from "../db";

export const createSepaDirectDebitReturn = (person, directDebitReturn) => {
  return {
    id: uuid.v4(),
    creditor_iban: directDebitReturn.recipient_iban,
    creditor_name: directDebitReturn.recipient_name,
    creditor_identifier: `C_${directDebitReturn.recipient_iban}`,
    mandate_reference: uuid.v4(),
    amount: { ...directDebitReturn.amount },
    end_to_end_id: directDebitReturn.end_to_end_id,
    sepa_return_code: "AC06",
    description: directDebitReturn.description,
    recorded_at: new Date().toISOString(),
    customer_id: person.id,
    customer_type: "Person",
    account_id: person.account.id
  };
};

export const sendSepaDirectDebitReturnPush = async sepaDirectDebitReturn => {
  const webhook = await getSepaDirectDebitReturnWebhook();

  if (!webhook) {
    log.error("(sendSepaDirectDebitReturnPush) Webhook doesnt exist");
    return;
  }

  return fetch(webhook.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sepaDirectDebitReturn)
  });
};
