export type Registration = {
  name: string;
  registration_number: string;
  /**
   * Only required for companies in Germany
   */
  registration_issuer?: string;
};
