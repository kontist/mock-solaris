export declare const SEIZURE_STATUSES: {
    ACTIVE: string;
    FULFILLED: string;
};
export declare const createSeizure: (personId: any) => Promise<any>;
export declare const createSeizureRequestHandler: (req: any, res: any) => Promise<void>;
export declare const getSeizuresRequestHandler: (req: any, res: any) => Promise<any>;
export declare const deleteSeizureRequestHandler: (req: any, res: any) => Promise<void>;
export declare const fulfillSeizureRequestHandler: (req: any, res: any) => Promise<void>;
