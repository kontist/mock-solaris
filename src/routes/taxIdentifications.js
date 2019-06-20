import crypto from "crypto";

import {
  getPerson,
  getTaxIdentifications,
  saveTaxIdentifications
} from "../db";

import { createChangeRequest } from "./changeRequest";

export const TIN_UPDATE = "Patch/tax-indentifications/id";

export const submitTaxIdentification = async (req, res) => {
  const { person_id: personId } = req.params;

  const tins = await getTaxIdentifications(personId);

  const id = `taxid-${personId}-${crypto
    .createHash("md5")
    .update(JSON.stringify(req.body) + tins.length)
    .digest("hex")}`;

  const tinNew = {
    id,
    country: null,
    number: null,
    primary: null,
    reason_no_tin: null,
    reason_description: null
  };

  const tin = { ...tinNew, ...req.body };

  if (!tinValidate(tin)) {
    return res.status(400).send({
      errors: [
        {
          id: Date.now().toString(),
          status: 400,
          code: "",
          title: "",
          detail: "invalid tax_identification"
        }
      ]
    });
  }

  if (tins.length) {
    if (tins.find(tinRow => tinRow.country === tin.country)) {
      return res.status(400).send({
        errors: [
          {
            id: Date.now().toString(),
            status: 400,
            code: "invalid_model",
            title: "Invalid Model",
            detail: "country has already been taken"
          }
        ]
      });
    }
  }

  if (!tins.length && !tin.primary) {
    return res.status(400).send({
      errors: [
        {
          id: Date.now().toString(),
          status: 400,
          code: "invalid_model",
          title: "Invalid Model",
          detail: "primary can't be false when no other primary is available"
        }
      ]
    });
  }

  if (tin.primary) makeTinsNoPrimary(tins);

  await saveTaxIdentifications(personId, tins.concat([tin]));

  res.status(201).send(tin);
};

export const updateTaxIdentification = async (req, res) => {
  const { person_id: personId, id } = req.params;
  const person = await getPerson(personId);
  const tins = await getTaxIdentifications(personId);
  const storedTin = tins.find(tinRow => tinRow.id === id);

  if (!storedTin) {
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

  const tin = { ...storedTin, ...req.body };

  if (!tinValidate(tin)) {
    return res.status(400).send({
      errors: [
        {
          id: Date.now().toString(),
          status: 400,
          code: "",
          title: "",
          detail: "invalid tax_identification"
        }
      ]
    });
  }

  if (!tin.primary) {
    if (!tins.find(tinRow => tinRow.primary === true)) {
      return res.status(400).send({
        errors: [
          {
            id: Date.now().toString(),
            status: 400,
            code: "",
            title: "",
            detail: "at least one has to be primary"
          }
        ]
      });
    }
  }

  return createChangeRequest(req, res, person, TIN_UPDATE, tin);
};

export const showTaxIdentification = async (req, res) => {
  const { person_id: personId, id } = req.params;

  const identification = await getTaxIdentifications(personId).find(
    tin => tin.id === id
  );

  res.status(200).send(identification);
};

export const listTaxIdentifications = async (req, res) => {
  const { person_id: personId } = req.params;

  const identifications = await getTaxIdentifications(personId);

  res.status(200).send(identifications);
};

export const processChangeRequest = async person => {
  const tins = await getTaxIdentifications(person.id);
  const id = person.changeRequest.delta.id;
  const storedTin = tins.find(tinRow => tinRow.id === id);
  const tin = { ...storedTin, ...person.changeRequest.delta };
  const indexAt = tins.findIndex(tin => tin.id === id);

  if (tin.primary) makeTinsNoPrimary(tins);

  tins[indexAt] = tin;

  await saveTaxIdentifications(person.id, tins);

  return tin;
};

const makeTinsNoPrimary = tins => {
  /*
  "In case a consequent tax_identification is submitted as primary"
  "the latest one holds the primary flag and the previously submitted ones lose it."
  */
  for (let i = 0; i < tins.length; i++) {
    tins[i].primary = false;
  }
};

const tinValidate = tin => {
  // Either the tax identification contains a number or
  // it does not and reason_no_tin has then to be provided
  if (!tin.number && !tin.reason_no_tin) {
    return false;
  }

  // If the chosen enum for reason_no_tin is OTHER, a reason_description is mandatory
  if (!tin.number && tin.reason_no_tin === "OTHER" && !tin.reason_description) {
    return false;
  }

  return true;
};
