import crypto from "crypto";
import moment from "moment";

import * as db from "../db";
import * as log from "../logger";
import { getAccountFromEntity } from "../helpers";

export const createBankStatement = async (req, res) => {
  const { account_id: accountId } = req.params;

  const person = await db.findPersonByAccount({ id: accountId });
  const business = await db.findBusinessByAccount({ id: accountId });

  const account = getAccountFromEntity(business || person, accountId);
  const createdAt = person ? person.createdAt : business.createdAt;
  const termsAndConditionsSignedAt = person
    ? person.terms_conditions_signed_at
    : business.terms_conditions_signed_at;

  const { start_date: startDate, end_date: endDate } = req.body;

  const isStartDateInvalid = moment(createdAt)
    .startOf("day")
    .isAfter(moment(startDate));

  const isEndDateInvalid = moment(endDate).isAfter(moment());

  // Solaris does not allow bank statement creation for dates before account creation date
  if (isStartDateInvalid) {
    res.status(400).send({
      errors: [
        {
          id: person ? person.id : business.id,
          status: 400,
          code: "invalid_model",
          title: "Invalid Model",
          detail: `start_date invalid date ${startDate} is earlier than account opening date ${termsAndConditionsSignedAt}`,
        },
      ],
    });
    return;
  }
  // Solaris does not allow bank statement creation for dates in the future
  if (isEndDateInvalid) {
    res.status(400).send({
      errors: [
        {
          id: "bab907fa-6dbe-11ea-a2ae-02420a86830b",
          status: 400,
          code: "invalid_model",
          title: "Invalid Model",
          detail: `end_date invalid date ${endDate}, needs to be in the past`,
          source: {
            field: "end_date",
            message: `invalid date ${endDate}, needs to be in the past`,
          },
        },
      ],
    });
    return;
  }

  const line1 = person
    ? `${
        person.salutation.toLowerCase() === "mr" ? "Mr." : "Ms."
      } ${person.first_name.toUpperCase()} ${person.last_name.toUpperCase()}`
    : business.name.toUpperCase();
  const line4 = person
    ? `${person.address.postal_code} ${person.address.city}`
    : `${business.address.postal_code} ${business.address.city}`;

  const bankStatement = {
    id:
      "mock" +
      crypto.createHash("md5").update(JSON.stringify(req.body)).digest("hex"),
    recipient_information: {
      line_1: line1,
      line_2: person ? person.address.line_1 : business.address.line_1,
      line_4: line4,
      line_5: "Deutschland",
    },
    issue_date: new Date().toISOString().slice(0, 10),
    statement_period_start_date: startDate,
    statement_period_end_date: endDate,
    account_information: {
      iban: account.iban,
      bic: process.env.SOLARIS_BIC,
      balance_start: {
        value: 0,
        unit: "cents",
        currency: "EUR",
      },
      balance_end: {
        value: account.balance.value,
        unit: "cents",
        currency: "EUR",
      },
    },
  };

  if (person) {
    person.bankStatements = person.bankStatements || [];
    person.bankStatements.push(bankStatement);
    await db.savePerson(person);
  } else if (business) {
    business.bankStatements = business.bankStatements || [];
    business.bankStatements.push(bankStatement);
    await db.saveBusiness(business);
  }

  const logText = person
    ? `person id ${person.id}`
    : `business id ${business.id}`;

  log.info(
    `(createBankStatement()) Generated bank statement for solaris account id ${accountId} and solaris ${logText}`,
    bankStatement
  );

  res.status(200).send(JSON.stringify(bankStatement));
};

export const showBankStatementBookings = async (req, res) => {
  const {
    page: { size, number },
  } = req.query;
  const { account_id: accountId, bank_statement_id: bankStatementId } =
    req.params;

  const person = await db.findPersonByAccount({ id: accountId });
  const business = await db.findBusinessByAccount({ id: accountId });
  const account = getAccountFromEntity(business || person, accountId);

  const statementsList = person
    ? person.bankStatements
    : business.bankStatements;

  if (!bankStatementId) {
    return res.status(404).send({
      errors: [
        {
          id: "a29ac1d3cb5a5185d8f428a43b89a44bex",
          status: 404,
          code: "model_not_found",
          title: "Model Not Found",
          detail: `Couldn't find 'Solaris::BankStatement' for id ${bankStatementId}.`,
        },
      ],
    });
  }

  const bankStatement = (statementsList || []).find(
    (bs) => bs.id === bankStatementId
  );

  const {
    statement_period_start_date: startDate,
    statement_period_end_date: endDate,
  } = bankStatement;

  const momentStartDate = moment(startDate);
  const momentEndDate = moment(endDate);

  const bankStatementsBookings = account.transactions
    .filter((booking) =>
      moment(booking.booking_date).isBetween(
        momentStartDate,
        momentEndDate,
        null,
        "[]"
      )
    )
    .slice((number - 1) * size, number * size);

  const logText = person
    ? `person id ${person.id}`
    : `business id ${business.id}`;

  log.info(
    `(showBankStatementBookings()) Got ${bankStatementsBookings.length} bookings for bank statement for solaris account id ${accountId} and solaris ${logText}`,
    bankStatementsBookings
  );

  res.status(200).send(JSON.stringify(bankStatementsBookings));
};
