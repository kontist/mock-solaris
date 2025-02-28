import { MockBusiness, MockPerson, MockAccount } from "./helpers/types";

const JSON_HEADER = "application/json";

export const shouldReturnJSON = (req) => req.headers.accept === JSON_HEADER;

export const getAccountsFromEntity = (
  entity: MockPerson | MockBusiness
): MockAccount[] => [
  ...(entity.accounts || []),
  ...(entity.account
    ? [{ ...entity.account, transactions: entity.transactions }]
    : []),
];

export const getAccountFromEntity = (
  entity: MockPerson | MockBusiness,
  accountId: string
): MockAccount =>
  [...getAccountsFromEntity(entity)].find((acc) => acc.id === accountId);
