import * as express from "express";
export declare const TIMED_ORDER_CREATE = "timed_orders:create";
export declare const triggerTimedOrder: (personId: any, timedOrderId: any) => Promise<void>;
export declare const processTimedOrders: (personId: any) => Promise<void>;
export declare const createTimedOrder: (req: any, res: any) => Promise<any>;
export declare const authorizeTimedOrder: (req: any, res: any) => Promise<any>;
export declare const confirmTimedOrder: (req: express.Request, res: express.Response) => Promise<express.Response<any>>;
export declare const fetchTimedOrders: (req: any, res: any) => Promise<void>;
export declare const fetchTimedOrder: (req: any, res: any) => Promise<void>;
export declare const cancelTimedOrder: (req: any, res: any) => Promise<void>;
export declare const generateTimedOrder: (data: any) => {
    id: string;
    execute_at: any;
    executed_at: any;
    status: string;
    scheduled_transaction: {
        id: string;
        status: string;
        reference: any;
        description: any;
        recipient_iban: any;
        recipient_name: any;
        recipient_bic: any;
        end_to_end_id: any;
        batch_id: any;
        created_at: string;
        amount: {
            value: any;
            currency: any;
            unit: any;
        };
    };
};
