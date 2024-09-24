export type Registration = {
  registration_number: string;
  /**
   * Only required for companies in Germany
   */
  registration_issuer?: string;
};
