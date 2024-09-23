import type { Request, Response } from "express";
import { businesses } from "../../fixtures/businesses";
import { ModelNotFoundError } from "./types/modelNotFoundError";
import { Business } from "./types/business";
import { findQuery } from "./types/findQuery";

/**
 * @see {@link https://docs.solarisgroup.com/api-reference/onboarding/businesses/#tag/Business-Registrations/paths/~1v1~1commercial_registrations~1find/get}
 */
export const find = (
  req: Request<{}, {}, {}, findQuery>,
  res: Response<Business | ModelNotFoundError>
) => {
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
