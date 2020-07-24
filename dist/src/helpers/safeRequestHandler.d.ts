/**
 * a wrapper around express's (req, res, next) middleware so that you can throw inside of
 * a request handler and it will automatically catch the error and forward it to error middleware
 */
export declare const safeRequestHandler: (handler: any) => (request: any, response: any, next: any) => Promise<any>;
