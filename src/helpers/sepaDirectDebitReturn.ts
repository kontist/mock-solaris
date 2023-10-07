import { triggerWebhook } from "../helpers/webhooks";
import { MockPerson, TransactionWebhookEvent } from "../helpers/types";
import generateID from "./id";

export const createSepaDirectDebitReturn = (person, directDebitReturn) => {
  return {
    id: generateID(),
    creditor_iban: directDebitReturn.recipient_iban,
    creditor_name: directDebitReturn.recipient_name,
    creditor_identifier: `C_${directDebitReturn.recipient_iban}`,
    mandate_reference: generateID(),
    amount: { ...directDebitReturn.amount },
    end_to_end_id: directDebitReturn.end_to_end_id,
    sepa_return_code: "AC06",
    description: directDebitReturn.description,
    recorded_at: new Date().toISOString(),
    customer_id: person.id,
    customer_type: "Person",
    account_id: person.account.id,
  };
};

export const triggerSepaDirectDebitReturnWebhook = (
  sepaDirectDebitReturn,
  person: MockPerson
) =>
  triggerWebhook({
    type: TransactionWebhookEvent.SEPA_DIRECT_DEBIT_RETURN,
    payload: sepaDirectDebitReturn,
    personId: person.id,
  });
