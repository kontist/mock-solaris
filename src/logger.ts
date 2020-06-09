import util from "util";
import winston from "winston";
import expressWinston from "express-winston";
import "winston-loggly-bulk";

const { LOGGLY_KEY } = process.env;

export const getLogglyTransportOptions = () => ({
  token: LOGGLY_KEY,
  subdomain: "kontist",
  tags: ["bankmock.kontist.com"],
  json: true,
});

const consoleLogger = new winston.transports.Console();

export const getExpressLogger = () => {
  const transports = [consoleLogger];

  if (LOGGLY_KEY) {
    transports.push(new winston.transports.Loggly(getLogglyTransportOptions()) as any);
  }

  return expressWinston.logger({
    transports,
    meta: false,
    msg:
      "HTTP {{req.method}} {{req.url}} {{res.statusCode}} {{res.responseTime}}ms",
    expressFormat: false,
    colorStatus: false,
    ignoreRoute (req, res) {
      return req.url === "/health";
    },
  });
};

function isError(e) {
  return (
    Object.prototype.toString.call(e) === "[object Error]" || e instanceof Error
  );
}

const formatLogForError = (err) => `
${util.inspect(err)},

Stack trace:
${err.stack}
`;

export function info(msg: string, ...args: any[]) {
  winston.log("info", msg, ...args);
}

export function warn(msg: string, ...args: any[]) {
  winston.log("warn", msg, ...args);
}

export function debug(msg: string, ...args: any[]) {
  winston.log("debug", msg, ...args);
}

export function error(msg: string, ...args: any[]) {
  const formattedArgs = args.map((arg) =>
    isError(arg) ? formatLogForError(arg) : arg
  );

  winston.log("error", msg, ...formattedArgs);
}

if (LOGGLY_KEY) {
  winston.add(winston.transports.Loggly, getLogglyTransportOptions());
}

export const setLogLevel = (logLevel: number | string) => {
  winston.level = String(logLevel);
  winston.transports.Console.level = String(logLevel);
  consoleLogger.silent = !logLevel;
};
