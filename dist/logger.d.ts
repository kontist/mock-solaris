import "winston-loggly-bulk";
export declare const getLogglyTransportOptions: () => {
    token: string;
    subdomain: string;
    tags: string[];
    json: boolean;
};
export declare const getExpressLogger: () => any;
export declare function info(msg: string, ...args: any[]): void;
export declare function warn(msg: string, ...args: any[]): void;
export declare function debug(msg: string, ...args: any[]): void;
export declare function error(msg: string, ...args: any[]): void;
export declare const setLogLevel: (logLevel: number | string) => void;
