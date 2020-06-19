import * as logger from "./logger";
import * as webhooks from "./helpers/webhooks";
declare const _default: {
    serve: (port: any) => Promise<unknown>;
    logger: typeof logger;
    flushDb: () => any;
    getPerson: (personId: any) => Promise<any>;
    getAllPersons: () => any;
    savePerson: (person: any, skipInterest?: boolean) => Promise<any>;
    migrate: () => Promise<void>;
    findPersonByAccountId: (accountId: any) => Promise<any>;
    saveBooking: (accountId: any, booking: any) => Promise<any>;
    createAccount: (personId: any, data: any) => Promise<any>;
    updateAccountLockingStatus: (personId: any, lockingStatus: any) => Promise<void>;
    saveMobileNumber: (personId: any, data: any) => Promise<any>;
    deleteMobileNumber: (personId: any) => Promise<any>;
    saveTaxIdentifications: (personId: any, data: any) => Promise<any>;
    getTechnicalUserPerson: () => Promise<any>;
    processQueuedBooking: (personIdOrEmail: any, id: any, isStandingOrder?: boolean) => Promise<any>;
    createStandingOrder: (standingOrderData: any) => Promise<any>;
    confirmStandingOrderCreation: (person: any, changeRequestId: any) => Promise<any>;
    cancelStandingOrder: (personId: any, standingOrderId: any) => Promise<string>;
    confirmStandingOrderCancelation: (person: any) => Promise<any>;
    getSmsToken: (personId: string) => Promise<any>;
    processTimedOrders: (personId: any) => Promise<void>;
    createSeizure: (personId: any) => Promise<any>;
    changeCardStatus: ({ personId, accountId }: {
        personId: string;
        accountId: string;
    }, cardId: string, newCardStatus: import("./helpers/types").CardStatus) => Promise<import("./helpers/types").Card>;
    getCard: (cardId: any) => Promise<any>;
    getCardData: (cardId: any) => Promise<any>;
    createReservation: ({ personId, cardId, amount, currency, type, recipient, declineReason, posEntryMode, }: {
        personId: string;
        cardId: string;
        amount: string;
        currency: string;
        type: import("./helpers/types").TransactionType;
        recipient: string;
        declineReason?: import("./helpers/types").CardAuthorizationDeclineReason;
        posEntryMode?: import("./helpers/types").POSEntryMode;
    }) => Promise<void>;
    updateReservation: ({ personId, reservationId, action, increaseAmount, }: {
        personId: string;
        reservationId: string;
        action: import("./helpers/types").ActionType;
        increaseAmount?: boolean;
    }) => Promise<void>;
    createCreditPresentment: ({ personId, cardId, amount, currency, type, recipient, }: {
        personId: string;
        cardId: string;
        amount: string;
        currency: string;
        type: import("./helpers/types").TransactionType;
        recipient: string;
        declineReason?: import("./helpers/types").CardAuthorizationDeclineReason;
    }) => Promise<void>;
    webhooks: typeof webhooks;
    getFraudWatchdog: () => any;
    generateSolarisWebhookSignature: (body: any, secret: any) => string;
    changeOverdraftApplicationStatus: ({ personId, person, applicationId, status, }: {
        personId?: string;
        person?: import("./helpers/types").MockPerson;
        applicationId: string;
        status: import("./helpers/types").OverdraftApplicationStatus;
    }) => Promise<import("./helpers/types").OverdraftApplication>;
    issueInterestAccruedBooking: ({ personId, }: {
        personId: string;
    }) => Promise<void>;
};
export default _default;
