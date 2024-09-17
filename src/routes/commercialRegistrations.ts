import type { Request, Response } from "express";
import { businesses } from "../fixtures/businesses";

export type SearchByNameResponseBody = {
  name: string;
  registration_number: string;
  /**
   * Only required for companies in Germany
   */
  registration_issuer?: string;
};

export type Country = string | "DE";
export type LegalForm = string | "GMBH";

export type BusinessAddress = {
  country: Country;
  postal_code: string;
  city: string;
  line_1: string;
  line_2: string;
};

export type SearchByNameQuery = {
  country: string;
  name: string;
};

export type LegalRepresentative = {
  first_name: string;
  last_name: string;
};

/**
 * This is used for samples
 */
export type Business = {
  name: string;
  address: BusinessAddress;
  legal_form: LegalForm;
  tax_country: Country;
  registration_number: string;
  registration_issuer: string;
  /**
   * YYYY-MM_DD
   */
  registration_date: string;
  /**
   * YYYY-MM_DD
   */
  registry_updated_at: string;
  legal_representatives: LegalRepresentative[];
  commercial_registry_industry_key: string[];
};

export type findQuery = {
  registration_number: string;
  registration_issuer: string;
};

export type ModelNotFoundError = {
  title: string | "Model Not Found";
  status: string | "404";
  id: string;
  detail: string;
  code: string | "model_not_found";
};

/**
 * Note: This endpoint may be used free of charge.
 *
 * Returns some business as if it exists
 * Returns a mock business if more than 2 characters are provided for country and name
 */
export const searchByName = async (
  req: Request<{}, {}, {}, SearchByNameQuery>,
  res: Response<SearchByNameResponseBody | ModelNotFoundError>
) => {
  const { country = "DE", name } = req.query;
  const foundBusiness = businesses.find(
    (business) => business.name === name && business.address.country === country
  );
  const highEffort = String(country).length + String(name).length > 2;

  if (foundBusiness) {
    return res.status(200).send(foundBusiness);
  } else if (highEffort) {
    const mockBusiness: Business = {
      ...businesses[0],
      name,
      address: { ...businesses[0].address, country },
    };
    return res.status(200).send(mockBusiness);
  } else {
    const errorResponse: ModelNotFoundError = {
      title: "Model Not Found",
      status: "404",
      code: "model_not_found",
      detail: "someString",
      id: "someString",
    };
    return res.status(404).send(errorResponse);
  }
};

/**
 * @see {@link https://docs.solarisgroup.com/guides/kyc/bkyc/#automatic-data-collection-optional}
 * Notes:
 *  This endpoint has an associated cost per request. Contact your Partner Manager for more information.
 *  For companies in Germany, you must add AMTSGERICHT before the value of the registration_issuer, e.g., AMTSGERICHT MÜNCHEN.
 */
export const find = (
  req: Request<{}, {}, {}, findQuery>,
  res: Response<SearchByNameResponseBody | ModelNotFoundError>
) => {
  const { registration_number, registration_issuer } = req.query;
  const foundBusiness = businesses.find(
    (business) =>
      business.registration_number === registration_number &&
      business.registration_issuer === registration_issuer
  );

  const highEffort =
    String(registration_number).length + String(registration_issuer).length > 2;
  if (foundBusiness) {
    return res.status(200).send(foundBusiness);
  } else if (highEffort) {
    const mockBusiness: Business = {
      ...businesses[0],
      registration_number,
      registration_issuer,
    };
    return res.status(200).send(mockBusiness);
  } else {
    const errorResponse: ModelNotFoundError = {
      title: "Model Not Found",
      status: "404",
      code: "model_not_found",
      detail: "someString",
      id: "someString",
    };
    return res.status(404).send(errorResponse);
  }
};
