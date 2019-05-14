export const oauthTokenAuthenticationMiddleware = (req, res, next) => {
  const authHeader = req.get('authorization');

  if (authHeader) {
    const [issueTimeString, expiresInString] = Buffer.from(
      authHeader.split(' ')[1],
      'base64'
    ).toString().split(':', 2);

    const issueTime = parseInt(issueTimeString, 10);
    const expiresIn = parseInt(expiresInString, 10) * 1000;

    if (Date.now() < (issueTime + expiresIn)) {
      next();
      return;
    }
  }

  res.status(401).send('Invalid Bearer Token');
};
