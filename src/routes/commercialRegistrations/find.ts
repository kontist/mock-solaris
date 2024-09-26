import type { Request, Response } from "express";
import { businesses } from "../../fixtures/businesses";
import { ModelNotFoundError } from "./types/modelNotFoundError";
import { Business } from "./types/business";
import { findQuery } from "./types/findQuery";
import { addresses } from "../../fixtures/addresses";
import { businessNames } from "../../fixtures/businessNames";

export type FindRequest = Partial<Request<{}, {}, {}, findQuery>>;
export type FindResponse = Partial<Response<Business | ModelNotFoundError>>;

export const modelNotFoundError: ModelNotFoundError = {
  title: "Model Not Found",
  status: "404",
  code: "model_not_found",
  detail: "someString",
  id: "someString",
};

/**
 * @see {@link https://docs.solarisgroup.com/api-reference/onboarding/businesses/#tag/Business-Registrations/paths/~1v1~1commercial_registrations~1find/get}
 */
export const find = (req: FindRequest, res: FindResponse) => {
  const {
    registration_number,
    registration_issuer,
    country = "DE",
  } = req.query;
  const foundBusiness = businesses.find(
    (business) =>
      String(business.registration_number).replace(" ", "") ===
        registration_number &&
      business.registration_issuer === registration_issuer &&
      business.address.country === country
  );

  const shouldGenerateBusiness =
    String(registration_number).length >= 4 &&
    String(registration_number).length <= 10 &&
    String(registration_issuer).length >= 4 &&
    String(registration_issuer).length <= 10;
  if (foundBusiness) {
    return res.status(200).send(foundBusiness);
  } else if (shouldGenerateBusiness) {
    const randomDate = new Date(Date.now() * Math.random());
    const mockBusiness: Business = {
      address: addresses[Math.floor(Math.random() * addresses.length)],
      legal_form: "GMBH",
      tax_country: "DE",
      name: businessNames[Math.floor(Math.random() * businessNames.length)],
      legal_representatives: [],
      registration_date: `${randomDate.getFullYear()}-${
        randomDate.getMonth() + 1
      }-${randomDate.getDate()}`,
      registry_updated_at: `${randomDate.getFullYear()}-${
        randomDate.getMonth() + 1
      }-${randomDate.getDate()}`,
      registration_number,
      registration_issuer,
    };
    return res.status(200).send(mockBusiness);
  } else {
    return res.status(404).send(modelNotFoundError);
  }
};
