"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeRequestHandler = void 0;
/**
 * a wrapper around express's (req, res, next) middleware so that you can throw inside of
 * a request handler and it will automatically catch the error and forward it to error middleware
 */
exports.safeRequestHandler = (handler) => async (request, response, next) => {
    try {
        return await handler(request, response);
    }
    catch (error) {
        return next(error);
    }
};
//# sourceMappingURL=safeRequestHandler.js.map