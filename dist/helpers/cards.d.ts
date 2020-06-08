import { Card, CardDetails, CardStatus, MockPerson, CreateCardData, CardLimits, CardLimitType, SolarisAPIErrorData, ChangeRequestStatus, MockChangeRequest, CardSettings, ReplaceCardData } from "./types";
export declare const CHANGE_REQUEST_CHANGE_CARD_PIN = "card_pin";
export declare enum CardErrorCodes {
    CARD_ACTIVATION_INVALID_STATUS = "card_activation_invalid_status",
    INVALID_VERIFICATION_TOKEN = "invalid_verification_token",
    VERIFICATION_TOKEN_TOO_LONG = "verification_token_too_long"
}
export declare const validateCardData: (cardData: Card, cardDetails?: CardDetails) => Promise<SolarisAPIErrorData[]>;
export declare const validatePersonData: (person: MockPerson) => Promise<SolarisAPIErrorData[]>;
export declare const getMaskedCardNumber: (cardNumber: string) => string;
export declare const createCardToken: () => string;
export declare const createCard: (cardData: CreateCardData, person: MockPerson) => {
    card: Card;
    cardDetails: CardDetails;
};
export declare const replaceCard: (cardData: ReplaceCardData, card: Card, cardDetails: CardDetails) => {
    card: Card;
    cardDetails: CardDetails;
};
export declare const getCards: (person: MockPerson) => Card[];
export declare const changeCardStatus: ({ personId, accountId }: {
    personId: string;
    accountId: string;
}, cardId: string, newCardStatus: CardStatus) => Promise<Card>;
export declare const activateCard: (cardForActivation: Card, verificationToken: string) => Promise<Card>;
export declare const validateCardLimits: (cardLimits: CardLimits, limitType: CardLimitType) => string | null;
export declare const updateCardLimits: (card: Card, cardLimitType: CardLimitType, newLimits: CardLimits) => Promise<CardLimits>;
export declare const enableGooglePay: (card: Card) => Promise<string>;
export declare const validatePIN: (pin: string) => any[];
export declare const changePIN: (card: Card, pin: string) => Promise<{
    id: string;
    status: string;
    updated_at: string;
    url: string;
}>;
export declare const confirmChangeCardPIN: (person: MockPerson, changeRequest: MockChangeRequest) => Promise<{
    id: string;
    status: ChangeRequestStatus;
    updated_at: string;
    response_body: string;
    response_code: any;
}>;
export declare const updateCardSettings: (cardId: string, person: MockPerson, settings: CardSettings) => Promise<CardSettings>;
