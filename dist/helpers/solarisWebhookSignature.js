"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSolarisWebhookSignature = void 0;
const crypto_1 = __importDefault(require("crypto"));
exports.generateSolarisWebhookSignature = (body, secret) => {
    const digestAlgorithm = "sha256";
    const generatedSignature = crypto_1.default
        .createHmac(digestAlgorithm, secret)
        .update(Buffer.from(JSON.stringify(body)))
        .digest("hex");
    return `${digestAlgorithm}=${generatedSignature}`;
};
//# sourceMappingURL=solarisWebhookSignature.js.map