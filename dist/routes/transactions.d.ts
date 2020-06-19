import { BookingType } from "../helpers/types";
export declare const createSepaDirectDebit: (req: any, res: any) => Promise<void>;
export declare const createSepaCreditTransfer: (req: any, res: any) => Promise<void>;
export declare const authorizeTransaction: (req: any, res: any) => Promise<void>;
export declare const confirmTransaction: (req: any, res: any) => Promise<any>;
export declare const creteBookingFromSepaCreditTransfer: ({ id, amount, description, end_to_end_id, recipient_iban, recipient_name, reference, status, }: {
    id: any;
    amount: any;
    description?: string;
    end_to_end_id?: any;
    recipient_iban: any;
    recipient_name: any;
    reference: any;
    status: any;
}) => {
    id: string;
    booking_type: BookingType;
    amount: any;
    description: string;
    end_to_end_id: any;
    recipient_bic: any;
    recipient_iban: any;
    recipient_name: any;
    reference: any;
    status: any;
    transaction_id: any;
    booking_date: string;
    valuta_date: string;
    meta_info: any;
};
export declare const creteBookingFromReservation: (person: any, reservation: any, incoming?: any) => {
    id: string;
    booking_type: BookingType;
    amount: {
        unit: string;
        currency: string;
        value: any;
    };
    description: any;
    recipient_bic: any;
    recipient_iban: any;
    recipient_name: string;
    sender_bic: string;
    sender_name: string;
    sender_iban: string;
    booking_date: string;
    valuta_date: string;
    meta_info: any;
};
