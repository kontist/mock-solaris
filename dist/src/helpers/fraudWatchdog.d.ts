import { CardStatus, FraudCase } from "./types";
export declare class FraudWatchdog {
    fraudCases: {
        string?: FraudCase;
    };
    private _timeout;
    private _watching;
    constructor(timeout?: number);
    watch(fraudCase: FraudCase): void;
    private _loadFraudCases;
    processFraudCases: () => Promise<void>;
    private _watch;
    whitelistCard(fraudCaseId: string): Promise<void>;
    confirmFraud(fraudCaseId: string): Promise<void>;
    _confirmFraud(fraudCaseId: string, status: CardStatus): Promise<void>;
    private _blockCard;
}
declare const getFraudWatchdog: () => any;
export default getFraudWatchdog;
