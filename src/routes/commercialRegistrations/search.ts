import type { Request, Response } from "express";
import HttpStatusCodes from "http-status";
import { businesses } from "../../fixtures/businesses";
import { SearchQuery } from "./types/searchQuery";
import { Registration } from "./types/registration";

export type SearchRequest = Partial<Request<{}, {}, {}, SearchQuery>>;
export type SearchResponse = Partial<Response<Registration[] | []>>;

/**
 * @see {@link https://docs.solarisgroup.com/api-reference/onboarding/businesses/#tag/Business-Registrations/paths/~1v1~1commercial_registrations~1search_by_name/get}
 *
 * Searches for businesses by name and country
 */
export const search = (req: SearchRequest, res: SearchResponse) => {
  const { country = "DE", name } = req.query;
  const foundBusinesses = businesses.filter(
    (business) =>
      String(business.name)
        .toLowerCase()
        .includes(String(name).toLowerCase()) &&
      business.address.country === country
  );

  if (foundBusinesses.length > 0) {
    return res.status(HttpStatusCodes.OK).send(
      foundBusinesses.map((business) => ({
        name: business.name,
        registration_number: business.registration_number,
        registration_issuer: business.registration_issuer,
      }))
    );
  } else {
    return res.status(HttpStatusCodes.OK).send([]);
  }
};
