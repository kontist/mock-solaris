import crypto from "crypto";

import * as log from "../logger";
import {
  getMobileNumber,
  saveMobileNumber,
  deleteMobileNumber,
  getPerson,
  savePerson
} from "../db";

export const MOBILE_NUMBER_CHANGE_METHOD = "mobile_number_change";

export const showMobileNumber = async (req, res) => {
  const { person_id: personId } = req.params;

  const mobileNumber = await getMobileNumber(personId);
  if (!mobileNumber) {
    return res.status(404).send({
      errors: [
        {
          id: Date.now().toString(),
          status: 404,
          code: "model_not_found",
          title: "Model Not Found",
          detail: `Couldn't find 'Solaris::MobileNumber' for id '${personId}'.`
        }
      ]
    });
  }

  return res.status(200).send(mobileNumber);
};

export const createMobileNumber = async (req, res) => {
  const { person_id: personId } = req.params;
  const existingMobileNumber = await getMobileNumber(personId);

  if (existingMobileNumber) {
    return res.status(409).send({
      errors: [
        {
          id: "09bac5b1813df74838c9451147f08f34ex",
          status: 409,
          code: "mobile_number_exists",
          title: "Mobile Number Exists",
          detail: `Mobile number already added for person: ${personId}.`
        }
      ]
    });
  }

  const { number } = req.body;

  const mobileNumberId = `mobileNumberId-${personId}-${crypto
    .createHash("md5")
    .update(JSON.stringify(req.body) + personId)
    .digest("hex")}`;

  const mobileNumber = {
    id: mobileNumberId,
    number,
    verified: false
  };

  await saveMobileNumber(personId, mobileNumber);

  return res.status(201).send(mobileNumber);
};

export const authorizeMobileNumber = async (req, res) => {
  const { person_id: personId } = req.params;
  const { number } = req.body;
  const person = await getPerson(personId);
  const existingMobileNumber = await getMobileNumber(personId);

  if (!existingMobileNumber || existingMobileNumber.number !== number) {
    return res.status(404).send({
      errors: [
        {
          id: Date.now().toString(),
          status: 404,
          code: "model_not_found",
          title: "Model Not Found",
          detail: `Couldn't find 'Solaris::MobileNumber' for id '${number}'.`
        }
      ]
    });
  }

  person.changeRequest = {
    method: MOBILE_NUMBER_CHANGE_METHOD,
    token: Date.now()
      .toString()
      .substr(-6)
  };

  log.info(
    `Generated SMS token for mobile number verfication on Solaris: ${person.changeRequest.token}`
  );

  await savePerson(person);

  return res.status(201).send(existingMobileNumber);
};

export const confirmMobileNumber = async (req, res) => {
  const { person_id: personId } = req.params;
  const { number, token } = req.body;
  const person = await getPerson(personId);
  const existingMobileNumber = await getMobileNumber(personId);

  if (!existingMobileNumber || existingMobileNumber.number !== number) {
    return res.status(404).send({
      errors: [
        {
          id: Date.now().toString(),
          status: 404,
          code: "model_not_found",
          title: "Model Not Found",
          detail: `Couldn't find 'Solaris::MobileNumber' for id '${number}'.`
        }
      ]
    });
  }

  if (person.changeRequest.token !== token) {
    return res.status(403).send({
      errors: [
        {
          id: Date.now().toString(),
          status: 403,
          code: "invalid_tan",
          title: "Invalid TAN",
          detail: `Invalid or expired TAN for Solaris::MobileNumber with uid: '${existingMobileNumber.id}'`
        }
      ]
    });
  }

  delete person.changeRequest;
  await savePerson(person);

  const mobileNumber = {
    ...existingMobileNumber,
    verified: true
  };

  await saveMobileNumber(personId, mobileNumber);

  return res.status(201).send(mobileNumber);
};

export const removeMobileNumber = async (req, res) => {
  const { person_id: personId } = req.params;
  const { number } = req.body;
  const person = await getPerson(personId);
  const existingMobileNumber = await getMobileNumber(personId);

  if (!existingMobileNumber) {
    return res.status(403).send({
      errors: [
        {
          id: Date.now().toString(),
          status: 403,
          code: "unauthorized_action",
          title: "Unauthorized Action",
          detail: `Unauthorized action 'destroy' is not allowed for 'Solaris::Service::Person::MobileNumber'`
        }
      ]
    });
  }

  if (number !== existingMobileNumber.number) {
    return res.status(404).send({
      errors: [
        {
          id: Date.now().toString(),
          status: 404,
          code: "model_not_found",
          title: "Model Not Found",
          detail: `Couldn't find 'Solaris::MobileNumber' for id '${number}'.`
        }
      ]
    });
  }

  if (existingMobileNumber.verified) {
    const changeRequestId = Date.now().toString();
    person.changeRequest = {
      id: changeRequestId,
      method: MOBILE_NUMBER_CHANGE_METHOD
    };
    await savePerson(person);

    return res.status(202).send({
      id: changeRequestId,
      status: "AUTHORIZATION_REQUIRED",
      updated_at: new Date().toISOString(),
      url: `:env/v1/change_requests/${changeRequestId}/authorize`
    });
  }

  await deleteMobileNumber(personId);

  return res.status(200).send(existingMobileNumber);
};

export const removeMobileNumberConfirmChangeRequest = async person => {
  await deleteMobileNumber(person.id);
  return getPerson(person.id);
};
