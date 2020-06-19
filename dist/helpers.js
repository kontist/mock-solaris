"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldReturnJSON = void 0;
const JSON_HEADER = "application/json";
exports.shouldReturnJSON = (req) => req.headers.accept === JSON_HEADER;
//# sourceMappingURL=helpers.js.map