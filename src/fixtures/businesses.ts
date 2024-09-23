import { Business } from "../routes/commercialRegistrations/types/business";

export const businesses: Business[] = [
  {
    name: "FLOOR 13 GmbH",
    address: {
      country: "DE",
      postal_code: "86919",
      city: "Utting a.Ammersee",
      line_1: "Seestraße 9",
      line_2: "",
      state: "Bayern",
    },
    legal_form: "GMBH",
    tax_country: "DE",
    registration_number: "HRB 198673",
    registration_issuer: "AMTSGERICHT MÜNCHEN",
    registration_date: "2012-05-09",
    registry_updated_at: "2015-11-17",
    legal_representatives: [
      {
        first_name: "Stefan",
        last_name: "Schneider",
      },
    ],
  },
];
