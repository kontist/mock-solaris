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

  return build(async function (source) {
    source.on("data", function (obj) {
      client.log(obj);
    });
  });
};
