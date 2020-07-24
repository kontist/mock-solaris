import { TransactionType, ActionType, Reservation, CardAuthorizationDeclineReason, CardDetails, MockPerson, POSEntryMode, CardTransaction, FraudCase } from "./types";
export declare const markReservationAsFraud: (reservation: Reservation, cardId: string, person: MockPerson) => Promise<FraudCase>;
export declare const generateMetaInfo: ({ originalAmount, originalCurrency, recipient, cardId, date, type, incoming, posEntryMode, }: {
    originalAmount: number;
    originalCurrency: string;
    recipient: string;
    cardId: string;
    date: Date;
    type: TransactionType;
    incoming?: boolean;
    posEntryMode: POSEntryMode;
}) => string;
export declare const validateCardLimits: (currentCardUsage: any, cardDetails: CardDetails, cardAuthorizationDeclined: CardTransaction) => Promise<void>;
export declare const createReservation: ({ personId, cardId, amount, currency, type, recipient, declineReason, posEntryMode, }: {
    personId: string;
    cardId: string;
    amount: string;
    currency: string;
    type: TransactionType;
    recipient: string;
    declineReason?: CardAuthorizationDeclineReason;
    posEntryMode?: POSEntryMode;
}) => Promise<void | Reservation>;
export declare const updateReservation: ({ personId, reservationId, action, increaseAmount, }: {
    personId: string;
    reservationId: string;
    action: ActionType;
    increaseAmount?: boolean;
}) => Promise<void>;
