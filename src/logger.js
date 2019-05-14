import util from 'util';
import winston from 'winston';
import expressWinston from 'express-winston';
import 'winston-loggly-bulk';

const { LOGGLY_KEY } = process.env;

export const getLogglyTransportOptions = () => ({
  token: LOGGLY_KEY,
  subdomain: 'kontist',
  tags: ['bankmock.kontist.com'],
  json: true
});

export const getExpressLogger = () => {
  const transports = [new winston.transports.Console()];

  if (LOGGLY_KEY) {
    transports.push(new winston.transports.Loggly(getLogglyTransportOptions()));
  }

  return expressWinston.logger({
    transports,
    meta: false,
    msg: 'HTTP {{req.method}} {{req.url}} {{res.statusCode}} {{res.responseTime}}ms',
    expressFormat: false,
    colorStatus: false
  });
};

function isError (e) {
  return Object.prototype.toString.call(e) === '[object Error]' || e instanceof Error;
}

const formatLogForError = (err) => `
${util.inspect(err)},

Stack trace:
${err.stack}
`;

export function info (...args) {
  winston.log('info', ...args);
}

export function warn (...args) {
  winston.log('warn', ...args);
}

export function debug (...args) {
  winston.log('debug', ...args);
}

export function error (...args) {
  const formattedArgs = args.map(arg => isError(arg) ? formatLogForError(arg) : arg);

  winston.log('error', ...formattedArgs);
}

if (LOGGLY_KEY) {
  winston.add(winston.transports.Loggly, getLogglyTransportOptions());
}
