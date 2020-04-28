export const generateToken = async (req, res) => {
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

  const expiresIn = Math.floor(Math.random() * 1000);
  const token = Date.now() + ":" + expiresIn;

  res.status(201).send({
    token_type: "Bearer",
    expires_in: expiresIn,
    access_token: Buffer.from(token).toString("base64").replace(/=/g, ""),
  });
};
