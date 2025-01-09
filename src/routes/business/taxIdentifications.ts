import _ from "lodash";
import type { Response } from "express";

import { RequestWithBusiness } from "../../helpers/middlewares";
import { TaxIdentification } from "../../helpers/types";
import generateID from "../../helpers/id";
import { saveBusiness } from "../../db";

const extractIdentificationDataFromRequest = (
  req: RequestWithBusiness
): TaxIdentification => {
  return _.pick(req.body, [
    "number",
    "country",
    "primary",
    "reason_no_tin",
    "reason_description",
    "valid_until",
  ]);
};

export const createBusinessTaxIdentification = async (
  req: RequestWithBusiness,
  res: Response
) => {
  const { business } = req;
  const taxIdentifications = business.taxIdentifications || [];
  const newIdent = extractIdentificationDataFromRequest(req);
  newIdent.id = generateID();

  if (newIdent.primary) {
    taxIdentifications.forEach((ident) => (ident.primary = false));
  }

  taxIdentifications.push(newIdent);

  business.taxIdentifications = taxIdentifications;

  await saveBusiness(business);
  res.status(201).send(newIdent);
};

export const updateBusinessTaxIdentification = async (
  req: RequestWithBusiness,
  res: Response
) => {
  const {
    business,
    params: { id },
  } = req;
  const taxIdentifications = business.taxIdentifications || [];
  const index = taxIdentifications.findIndex((ident) => ident.id === id);

  if (index === -1) {
    res.status(404).send({
      errors: [
        {
          id: generateID(),
          status: 404,
          code: "model_not_found",
          title: "Model Not Found",
          detail: `Couldn't find 'Solaris::TaxIdentification' for id '${id}'.`,
        },
      ],
    });
    return;
  }

  const taxIdentificationToUpdate = extractIdentificationDataFromRequest(req);

  if (taxIdentificationToUpdate.primary) {
    taxIdentifications.forEach((ident) => (ident.primary = false));
  }

  taxIdentifications[index] = {
    ...taxIdentifications[index],
    ...taxIdentificationToUpdate,
  };

  business.taxIdentifications = taxIdentifications;

  await saveBusiness(business);
  res.status(200).send(taxIdentifications[index]);
};

export const listBusinessTaxIdentifications = async (
  req: RequestWithBusiness,
  res: Response
) => {
  const { business } = req;
  const taxIdentifications = business.taxIdentifications || [];
  res.status(200).send(taxIdentifications);
};

export const getBusinessTaxIdentification = async (
  req: RequestWithBusiness,
  res: Response
) => {
  const {
    business,
    params: { id },
  } = req;
  const taxIdentifications = business.taxIdentifications || [];

  const taxIdentification = taxIdentifications.find((ident) => ident.id === id);
  if (!taxIdentification) {
    res.status(404).send({
      errors: [
        {
          id: generateID(),
          status: 404,
          code: "model_not_found",
          title: "Model Not Found",
          detail: `Couldn't find 'Solaris::TaxIdentification' for id '${id}'.`,
        },
      ],
    });
    return;
  }

  res.status(200).send(taxIdentification);
};
