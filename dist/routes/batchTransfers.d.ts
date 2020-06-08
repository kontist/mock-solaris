export declare const BATCH_TRANSFER_CREATE_METHOD = "batch_transfer:create";
export declare const saveBatchTransfer: (personId: any, transfers: any) => Promise<any>;
export declare const createBatchTransfer: (req: any, res: any) => Promise<void>;
export declare const confirmBatchTransfer: (person: any, changeRequestId: any) => Promise<{
    id: string;
    status: string;
    sepa_credit_transfers: any;
}>;
