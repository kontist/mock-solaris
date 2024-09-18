import { LegalForm } from "./legalForm";
import { LegalRepresentative } from "./legalRepresentative";
import { BusinessAddress } from "./businessAddress";
import { Country } from "./country";

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
