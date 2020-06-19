import { TransactionType, CardAuthorizationDeclineReason } from "./types";
export declare const createCreditPresentment: ({ personId, cardId, amount, currency, type, recipient, }: {
    personId: string;
    cardId: string;
    amount: string;
    currency: string;
    type: TransactionType;
    recipient: string;
    declineReason?: CardAuthorizationDeclineReason;
}) => Promise<void>;
