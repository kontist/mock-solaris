import util from "util";
import winston from "winston";
import expressWinston from "express-winston";
import { Loggly } from "winston-loggly-bulk";
import * as Transport from "winston-transport";

const { LOGGLY_KEY } = process.env;
const consoleLogger = new winston.transports.Console();
let loggly: Loggly;

winston.add(
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
  winston.add(loggly);
}

export const getExpressLogger = () => {
  const transports: Transport[] = [consoleLogger];
  if (loggly) {
    transports.push(loggly);
  }

  return expressWinston.logger({
    transports,
    meta: false,
    msg:
      "HTTP {{req.method}} {{req.url}} {{res.statusCode}} {{res.responseTime}}ms",
    expressFormat: false,
    ignoreRoute: (req) => req.url === "/health",
  });
};

export function info(message: string, ...meta: any[]) {
  winston.log("info", util.format(message, ...meta));
}

export function warn(message: string, ...meta: any[]) {
  winston.log("warn", util.format(message, ...meta));
}

export function debug(message: string, ...meta: any[]) {
  winston.log("debug", util.format(message, ...meta));
}

export function error(message: string | Error, ...meta: any[]) {
  winston.log("error", util.format(message, ...meta));
}

export const setLogLevel = (logLevel: string) => {
  winston.level = logLevel;
  winston.transports.Console.level = logLevel;
  consoleLogger.silent = !logLevel;
};
