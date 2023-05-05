import pino from "pino";
import util from "util";
import pinoHttp from "pino-http";
import { NextFunction, Request, Response } from "express";
export interface Logger {
  info(msg: string, ...args: any[]): void;
  warning(msg: string, ...args: any[]): void;
  debug(msg: string, ...args: any[]): void;
  error(msg: string, ...args: any[]): void;
  getExpressLogger(): any;
  setLogLevel(level?: string): void;
}

export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  FATAL = "fatal",
}

const level = LogLevel.INFO;

let transport:
  | pino.TransportSingleOptions
  | pino.TransportMultiOptions
  | pino.TransportPipelineOptions;

if (process.env.LOGGLY_KEY) {
  const logglyParams = {
    token: process.env.LOGGLY_KEY,
    subdomain: "kontist",
    tags: ["mockSolaris"],
  };
  transport = {
    targets: [
      { target: "pino/file", options: {}, level },
      { target: "./loggly.js", options: logglyParams, level },
    ],
  };
}

export const logger = pino({
  level,
  base: null,
  transport,
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
});

type LogArguments = any[];

const formatLogArgs = (args: LogArguments) => {
  return util.format(...args);
};

export function info(...args: LogArguments) {
  logger.info(formatLogArgs(args));
}

export function warning(...args: LogArguments) {
  logger.warn(formatLogArgs(args));
}

export function debug(...args: LogArguments) {
  logger.debug(formatLogArgs(args));
}

export function error(...args: LogArguments) {
  logger.error(formatLogArgs(args));
}

export function getExpressLogger() {
  const loggerMiddleware = pinoHttp(
    {
      logger,
      customLogLevel: (req, res, err) => {
        if (res.statusCode >= 400 && res.statusCode < 500) {
          return "warn";
        } else if (res.statusCode >= 500 || err) {
          return "error";
        }
        return "info";
      },
      autoLogging: {
        ignore: (req) => ["/api/health", "/api/status"].includes(req.url),
      },
      customSuccessMessage: (req, res) => {
        return `HTTP ${req.method} ${req.url} ${res.statusCode}`;
      },
      customErrorMessage: (req, res, err) => {
        return `HTTP ${req.method} ${req.url} ${res.statusCode} - Error: ${err.name} ${err.message} ${err.stack}`;
      },
      serializers: {
        err: pino.stdSerializers.err,
        req: (req) => ({
          method: req.method,
          url: req.url,
        }),
        res: (res) => ({
          statusCode: res.statusCode,
          responseTime: res.responseTime,
        }),
      },
    },
    null
  );

  return (req: Request, res: Response, next: NextFunction) => {
    loggerMiddleware(req, res, () => {
      res.on("finish", () => {
        if (req.url !== "/api/health") {
          loggerMiddleware(req, res);
        }
      });
      next();
    });
  };
}

export const getLogger = (
  prefix: string,
  format = (prefix: string) => `[${prefix}]`
): Partial<Logger> => {
  const prefixMessage = format(prefix);
  return Object.values(LogLevel).reduce((result, level) => {
    result[level] = (...args: any[]) =>
      module.exports[level](prefixMessage, ...args);
    return result;
  }, {});
};

export function setLogLevel(level?: LogLevel) {
  logger.level = level;
}
