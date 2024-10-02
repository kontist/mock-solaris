import { Country } from "./country";

export type findQuery = {
  registration_number: string;
  registration_issuer: string;
  country: Country;
};
