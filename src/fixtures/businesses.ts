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
    registration_date: "2021-01-01",
    legal_representatives: [
      {
        first_name: "Max",
        last_name: "Mustermann",
      },
    ],
  },
  {
    name: "FLOOR 14 GmbH",
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
    registration_number: "HRB 198674",
    registration_issuer: "ISSUER MÜNCHEN",
    registration_date: "2022-01-01",
    legal_representatives: [
      {
        first_name: "John",
        last_name: "Doer",
      },
    ],
  },
  {
    name: "COMPANY 15 GmbH",
    address: {
      country: "DE",
      postal_code: "86919",
      city: "Utting a.Ammersee",
      line_1: "Seestraße 9",
      line_2: "",
      state: "Bavaria",
    },
    legal_form: "GMBH",
    tax_country: "DE",
    registration_number: "HRB 198674",
    registration_issuer: "ISSUER BAVARIA",
    registration_date: "2023-01-01",
    legal_representatives: [
      {
        first_name: "Jane",
        last_name: "Doe",
      },
    ],
  },
  {
    name: "COMPANY 16 GmbH",
    address: {
      country: "DE",
      postal_code: "86919",
      city: "Utting a.Ammersee",
      line_1: "Seestraße 9",
      line_2: "",
      state: "Saxony",
    },
    legal_form: "GMBH",
    tax_country: "DE",
    registration_number: "HRB 198674",
    registration_issuer: "ISSUER SAXONY",
    registration_date: "2023-01-01",
    legal_representatives: [
      {
        first_name: "Jane",
        last_name: "Doer",
      },
    ],
  },
];
