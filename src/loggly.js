"use strict";

const build = require("pino-abstract-transport");
const loggly = require("node-loggly-bulk");

module.exports = function (options) {
  const client = loggly.createClient({
    token: options.token,
    subdomain: options.subdomain,
    tags: options.tags,
    json: true,
  });

  const levels = {
    10: "trace",
    20: "debug",
    30: "info",
    40: "warn",
    50: "error",
    60: "fatal",
  };

  return build(async function (source) {
    source.on("data", function (obj) {
      const level = levels[obj.level];
      client.log({ ...obj, level });
    });
  });
};
