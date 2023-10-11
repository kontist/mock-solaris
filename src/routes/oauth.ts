import type { Request, Response } from "express";

export const generateToken = async (req: Request, res: Response) => {
  let isValidRequestUsingBasicAuth = false;
  const isValidRequestUsingJSON =
    req.body.grant_type === "client_credentials" &&
    req.body.client_id === process.env.SOLARIS_CLIENT_ID &&
    req.body.client_secret === process.env.SOLARIS_CLIENT_SECRET;

  const authHeader = req.get("authorization");

  if (authHeader) {
    const [user, password] = Buffer.from(authHeader.split(" ")[1], "base64")
      .toString()
      .split(":", 2);

    isValidRequestUsingBasicAuth =
      req.query.grant_type === "client_credentials" &&
      [
        process.env.SOLARIS_CLIENT_ID,
        process.env.SOLARIS_KONTIST_ACCOUNT_CLIENT_ID,
      ].includes(user) &&
      [
        process.env.SOLARIS_CLIENT_SECRET,
        process.env.SOLARIS_KONTIST_ACCOUNT_CLIENT_SECRET,
      ].includes(password);
  }

  if (!(isValidRequestUsingBasicAuth || isValidRequestUsingJSON)) {
    res.status(401).send("Unauthorized");
    return;
  }

  const expiresIn = getExpiriesAt();
  const token = Date.now() + ":" + expiresIn;

  res.status(201).send({
    token_type: "Bearer",
    expires_in: expiresIn,
    access_token: Buffer.from(token).toString("base64").replace(/=/g, ""),
  });
};

export const generateOAuth2Token = async (req: Request, res: Response) => {
  const authHeader = req.get("authorization");
  const contentType = req.get("content-type");
  const [user, password] = Buffer.from(authHeader.split(" ")[1], "base64")
    .toString()
    .split(":", 2);

  const isValid =
    contentType === "application/x-www-form-urlencoded" &&
    [
      process.env.SOLARIS_CLIENT_ID_OAUTH2,
      process.env.SOLARIS_KONTIST_ACCOUNT_CLIENT_ID_OAUTH2,
    ].includes(user) &&
    [
      process.env.SOLARIS_CLIENT_SECRET_OAUTH2,
      process.env.SOLARIS_KONTIST_ACCOUNT_CLIENT_SECRET_OAUTH2,
    ].includes(password);

  if (!isValid) {
    res.status(401).send("Unauthorized");
    return;
  }

  const expiresIn = getExpiriesAt();
  const token = Date.now() + ":" + expiresIn;

  res.status(201).send({
    token_type: "bearer",
    expires_in: expiresIn,
    scope: "partners",
    access_token: Buffer.from(token).toString("base64").replace(/=/g, ""),
  });
};

function getExpiriesAt() {
  return Date.now() + 3599 * 1000;
}
