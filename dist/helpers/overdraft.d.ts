import { OverdraftApplication, OverdraftApplicationStatus, MockPerson, MockAccount } from "../helpers/types";
export declare const INTEREST_ACCRUAL_RATE = 0.11;
export declare const OVERDRAFT_RATE = 0.03;
export declare const OVERDRAFT_LIMIT: {
    value: number;
    unit: string;
    currency: string;
};
export declare const generateEntityNotFoundPayload: (field: string, value: string) => {
    id: string;
    status: number;
    code: string;
    title: string;
    detail: string;
    source: {
        message: string;
        field: string;
    };
};
declare type ChangeOverdraftApplicationStatusOptions = {
    personId?: string;
    person?: MockPerson;
    applicationId: string;
    status: OverdraftApplicationStatus;
};
export declare const changeOverdraftApplicationStatus: ({ personId, person, applicationId, status, }: ChangeOverdraftApplicationStatusOptions) => Promise<OverdraftApplication>;
export declare const calculateOverdraftInterest: (account: MockAccount, balance: number) => void;
export declare const issueInterestAccruedBooking: ({ personId, }: {
    personId: string;
}) => Promise<void>;
export {};
