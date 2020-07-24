"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setLogLevel = exports.error = exports.debug = exports.warn = exports.info = exports.getExpressLogger = exports.getLogglyTransportOptions = void 0;
const util_1 = __importDefault(require("util"));
const winston_1 = __importDefault(require("winston"));
const express_winston_1 = __importDefault(require("express-winston"));
require("winston-loggly-bulk");
const { LOGGLY_KEY } = process.env;
exports.getLogglyTransportOptions = () => ({
    token: LOGGLY_KEY,
    subdomain: "kontist",
    tags: ["bankmock.kontist.com"],
    json: true,
});
const consoleLogger = new winston_1.default.transports.Console();
exports.getExpressLogger = () => {
    const transports = [consoleLogger];
    if (LOGGLY_KEY) {
        transports.push(new winston_1.default.transports.Loggly(exports.getLogglyTransportOptions()));
    }
    return express_winston_1.default.logger({
        transports,
        meta: false,
        msg: "HTTP {{req.method}} {{req.url}} {{res.statusCode}} {{res.responseTime}}ms",
        expressFormat: false,
        ignoreRoute(req, res) {
            return req.url === "/health";
        },
    });
};
function isError(e) {
    return (Object.prototype.toString.call(e) === "[object Error]" || e instanceof Error);
}
const formatLogForError = (err) => `
${util_1.default.inspect(err)},

Stack trace:
${err.stack}
`;
function info(msg, ...args) {
    winston_1.default.log("info", msg, ...args);
}
exports.info = info;
function warn(msg, ...args) {
    winston_1.default.log("warn", msg, ...args);
}
exports.warn = warn;
function debug(msg, ...args) {
    winston_1.default.log("debug", msg, ...args);
}
exports.debug = debug;
function error(msg, ...args) {
    const formattedArgs = args.map((arg) => isError(arg) ? formatLogForError(arg) : arg);
    winston_1.default.log("error", msg, ...formattedArgs);
}
exports.error = error;
if (LOGGLY_KEY) {
    winston_1.default.add(winston_1.default.transports.Loggly, exports.getLogglyTransportOptions());
}
exports.setLogLevel = (logLevel) => {
    winston_1.default.level = String(logLevel);
    winston_1.default.transports.Console.level = String(logLevel);
    consoleLogger.silent = !logLevel;
};
//# sourceMappingURL=logger.js.map