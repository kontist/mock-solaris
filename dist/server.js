"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const logger_1 = require("./logger");
const PORT = 2091;
process.on("uncaughtException", (err) => {
    logger_1.error("Uncaught exception occurred. Mock server will stop", err);
    setTimeout(() => process.exit(1), 500);
});
app_1.serve(PORT);
//# sourceMappingURL=server.js.map