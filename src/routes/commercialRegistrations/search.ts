import type { Request, Response } from "express";
import { businesses } from "../../fixtures/businesses";
import { ModelNotFoundError } from "./types/modelNotFoundError";
import { Business } from "./types/business";
import { SearchQuery } from "./types/searchQuery";
import { SearchResponseBody } from "./types/searchResponseBody";

/**
 * @see {@link https://docs.solarisgroup.com/api-reference/onboarding/businesses/#tag/Business-Registrations/paths/~1v1~1commercial_registrations~1search_by_name/get}
 * Note: This endpoint may be used free of charge.
 *
 * Returns some business as if it exists
 * Returns a mock business if more than 2 characters are provided for country and name
 */
export const search = async (
  req: Request<{}, {}, {}, SearchQuery>,
  res: Response<SearchResponseBody | ModelNotFoundError>
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
