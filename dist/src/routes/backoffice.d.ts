export declare const triggerBookingsWebhook: (solarisAccountId: any) => Promise<void>;
/**
 * Handles changes on the provisioning token and redirects back to refresh data.
 * Reads the personId and cardId from the url params and the status (if sent) from the body.
 * @param req {Express.Request}
 * @param res {Express.Response}
 */
export declare const provisioningTokenHandler: (req: any, res: any) => Promise<void>;
export declare const findIdentificationByEmail: (email: any, method: any) => any;
export declare const listPersons: (req: any, res: any) => Promise<void>;
export declare const listPersonsCards: (req: any, res: any) => Promise<void>;
export declare const getPersonHandler: (req: any, res: any) => Promise<any>;
export declare const updatePersonHandler: (req: any, res: any) => Promise<void>;
export declare const setIdentificationState: (req: any, res: any) => Promise<any>;
export declare const displayBackofficeOverview: (req: any, res: any) => void;
export declare const processQueuedBookingHandler: (req: any, res: any) => Promise<void>;
/**
 * Processes either a normal booking or a Standing Order.
 * @param {string} personIdOrEmail
 * @param {number} id Booking ID
 * @param {Boolean} isStandingOrder (Optional) True if is of type standing order.
 */
export declare const processQueuedBooking: (personIdOrEmail: any, id: any, isStandingOrder?: boolean) => Promise<any>;
export declare const generateBookingForPerson: (bookingData: any) => {
    id: string;
    amount: {
        value: number;
    };
    valuta_date: string;
    description: any;
    booking_date: string;
    name: string;
    recipient_bic: any;
    recipient_iban: any;
    recipient_name: string;
    sender_bic: string;
    sender_iban: any;
    sender_name: any;
    end_to_end_id: any;
    booking_type: any;
    transaction_id: any;
    status: any;
};
/**
 * Returns a Person object by either person ID or email.
 * @param {String} personIdOrEmail
 */
export declare const findPersonByIdOrEmail: (personIdOrEmail: any) => Promise<any>;
export declare const queueBookingRequestHandler: (req: any, res: any) => Promise<void>;
export declare const updateAccountLockingStatus: (personId: any, lockingStatus: any) => Promise<void>;
export declare const updateAccountLockingStatusHandler: (req: any, res: any) => Promise<void>;
export declare const changeCardStatusHandler: (req: any, res: any) => Promise<void>;
export declare const createReservationHandler: (req: any, res: any) => Promise<void>;
export declare const updateReservationHandler: (req: any, res: any) => Promise<void>;
export declare const changeOverdraftApplicationStatusHandler: (req: any, res: any) => Promise<void>;
export declare const issueInterestAccruedBookingHandler: (req: any, res: any) => Promise<void>;
