import util from "util";
import winston from "winston";
import expressWinston from "express-winston";
import { Loggly } from "winston-loggly-bulk";
import * as Transport from "winston-transport";

const { LOGGLY_KEY } = process.env;
const consoleLogger = new winston.transports.Console();
let loggly: Loggly;

export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  FATAL = "fatal",
}

const isTest = process.env.NODE_ENV === "test";
const level = isTest ? LogLevel.FATAL : LogLevel.INFO;

const logger = winston.createLogger({
  silent: isTest,
  level,
  levels: {
    [LogLevel.DEBUG]: 4,
    [LogLevel.INFO]: 3,
    [LogLevel.WARNING]: 2,
    [LogLevel.ERROR]: 1,
    [LogLevel.FATAL]: 0,
  },
});

logger.add(
  new winston.transports.Console({
    format: winston.format.simple(),
  })
);

if (LOGGLY_KEY) {
  loggly = new Loggly({
    format: winston.format.simple(),
    token: LOGGLY_KEY,
    subdomain: "kontist",
    tags: ["mockSolaris"],
    json: true,
  });
  logger.add(loggly);
}

export const getExpressLogger = () => {
  const transports: Transport[] = [consoleLogger];
  if (loggly) {
    transports.push(loggly);
  }

  return expressWinston.logger({
    winstonInstance: logger,
    transports,
    meta: false,
    msg:
      "HTTP {{req.method}} {{req.url}} {{res.statusCode}} {{res.responseTime}}ms",
    expressFormat: false,
    ignoreRoute: (req) => req.url === "/health",
  });
};

type LogArguments = any[];
export function info(...args: LogArguments) {
  logger.info(util.format(args));
}

export function warning(...args: LogArguments) {
  logger.warning(util.format(args));
}

export function debug(...args: LogArguments) {
  logger.debug(util.format(args));
}

export function error(...args: LogArguments) {
  logger.error(util.format(args));
}

export const setLogLevel = (logLevel: string) => {
  logger.level = logLevel;
};
