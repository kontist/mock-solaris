import { Country } from "./country";

export type BusinessAddress = {
  country: Country;
  postal_code: string;
  city: string;
  line_1: string;
  line_2: string;
};
