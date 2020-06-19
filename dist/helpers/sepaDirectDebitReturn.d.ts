export declare const createSepaDirectDebitReturn: (person: any, directDebitReturn: any) => {
    id: string;
    creditor_iban: any;
    creditor_name: any;
    creditor_identifier: string;
    mandate_reference: string;
    amount: any;
    end_to_end_id: any;
    sepa_return_code: string;
    description: any;
    recorded_at: string;
    customer_id: any;
    customer_type: string;
    account_id: any;
};
export declare const triggerSepaDirectDebitReturnWebhook: (sepaDirectDebitReturn: any) => Promise<void>;
