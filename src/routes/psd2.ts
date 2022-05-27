const checkChallengeId = (challengeId) => {
  if (challengeId === "expired_id") {
    return {
      errors: [
        {
          id: "cb891eff-0fa8-439f-9aad-f038400ec163",
          status: 401,
          code: "unauthorized_psd2_challenge",
          title: "Unauthorized PSD2 challenge",
          detail: "Challenge expired.",
        },
      ],
    };
  } else if (challengeId !== "success_id") {
    return {
      errors: [
        {
          id: "9f55e866-517d-48ed-9be4-9bedbb0f9d12",
          status: 400,
          code: "unauthorized_account",
          title: "UnAuthorized account",
          detail:
            "Unauthorized account provided either in consent or payment account.",
        },
      ],
    };
  }

  return null;
};

export const verifyChallengeId = (req, res) => {
  const { challenge_id } = req.params;

  const result = checkChallengeId(challenge_id);
  if (result?.errors) {
    res.status(result.errors[0].status).send(result);
    return;
  }

  res.send({
    person_id: "dc1a6812a14f6cc338cd084208535bcdcper",
    redirect_url: "http://my.sb.de/consent?consent_challenge=cc1234",
  });
};

export const patchChallengeId = (req, res) => {
  const { challenge_id } = req.params;
  const { person_id } = req.body;

  const result = checkChallengeId(challenge_id);
  if (result?.errors) {
    res.status(result.errors[0].status).send(result);
    return;
  }

  if (!person_id) {
    res.status(400).send({
      errors: [
        {
          id: "c5ea8c89-7534-4754-a3cb-627e5c1a5e1c",
          status: 400,
          code: "validation_error",
          title: "Validation Error",
          detail: "person_id is missing",
          source: {
            field: "person_id",
            message: "is missing",
          },
        },
      ],
    });
    return;
  }

  res.send({
    person_id: "dc1a6812a14f6cc338cd084208535bcdcper",
    redirect_url: "http://my.sb.de/consent?consent_challenge=cc1234",
  });
};
