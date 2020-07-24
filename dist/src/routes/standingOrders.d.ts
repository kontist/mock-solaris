export declare const STANDING_ORDER_CREATE_METHOD = "standing_order:create";
export declare const STANDING_ORDER_UPDATE_METHOD = "standing_order:update";
export declare const STANDING_ORDER_CANCEL_METHOD = "standing_order:cancel";
export declare const showStandingOrderRequestHandler: (req: any, res: any) => Promise<void>;
export declare const createStandingOrderRequestHandler: (req: any, res: any) => Promise<any>;
/**
 * Saves the standing order to the Person's StandingOrders array.
 * Returns the standing order.
 * @param {Object} standingOrderData
 */
export declare const createStandingOrder: (standingOrderData: any) => Promise<any>;
export declare const generateStandingOrderForPerson: (standingOrderData: any) => {
    id: string;
    reference: any;
    recipient_name: any;
    recipient_iban: any;
    amount: {
        value: number;
        unit: string;
        currency: string;
    };
    description: any;
    end_to_end_id: any;
    first_execution_date: string;
    last_execution_date: string;
    month_end_execution: boolean;
    reoccurrence: any;
};
/**
 * Triggers the standing order to process as a normal booking.
 */
export declare const triggerStandingOrderRequestHandler: (req: any, res: any) => Promise<void>;
export declare const confirmStandingOrderCreation: (person: any, changeRequestId: any) => Promise<any>;
export declare const updateStandingOrderRequestHandler: (req: any, res: any) => Promise<any>;
export declare const updateStandingOrder: (personId: any, standingOrderId: any, attributesToUpdate: any) => Promise<string>;
export declare const confirmStandingOrderUpdate: (person: any) => Promise<any>;
export declare const cancelStandingOrderRequestHandler: (req: any, res: any) => Promise<any>;
export declare const cancelStandingOrder: (personId: any, standingOrderId: any) => Promise<string>;
export declare const confirmStandingOrderCancelation: (person: any) => Promise<any>;
