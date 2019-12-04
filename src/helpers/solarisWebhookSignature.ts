import crypto from "crypto";

export const generateSolarisWebhookSignature = (body, secret) => {
  const digestAlgorithm = "sha256";
  const generatedSignature = crypto
    .createHmac(digestAlgorithm, secret)
    .update(Buffer.from(JSON.stringify(body)))
    .digest("hex");

  return `${digestAlgorithm}=${generatedSignature}`;
};
