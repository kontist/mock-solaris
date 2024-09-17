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

export type SearchQuery = {
  country: string;
  name: string;
};

export type findQuery = {
  registration_number: string;
  registration_issuer: string;
  country: Country;
};

export type ModelNotFoundError = {
  title: string | "Model Not Found";
  status: string | "404";
  id: string;
  detail: string;
  code: string | "model_not_found";
};
