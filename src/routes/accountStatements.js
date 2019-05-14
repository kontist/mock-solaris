import crypto from 'crypto';
import moment from 'moment';

import * as db from '../db';
import * as log from '../logger';

export const createAccountStatement = async (req, res) => {
  const { account_id: accountId } = req.params;

  const person = await db.findPersonByAccountId(accountId);
  const account = person.account;

  const {
    year,
    period,
    interval
  } = req.body;

  log.info('createAccountStatement()', req.params, req.body);

  const isMonthlyInterval = interval === 'MONTHLY';
  let momentDate;
  let statementPeriodStartDate;
  let statementPeriodEndDate;

  if (isMonthlyInterval) {
    momentDate = moment(`${year}-${Number(period).toString().padStart(2, '0')}-01`);
    statementPeriodStartDate = momentDate.clone().startOf('month').format('YYYY-MM-DD');
    statementPeriodEndDate = momentDate.clone().endOf('month').format('YYYY-MM-DD');
  } else {
    momentDate = moment(`${year}-01-01`).quarter(period);
    statementPeriodStartDate = momentDate.clone().startOf('quarter').format('YYYY-MM-DD');
    statementPeriodEndDate = momentDate.clone().endOf('quarter').format('YYYY-MM-DD');
  }

  log.info(`createAccountStatement() statementPeriodStartDate: ${statementPeriodStartDate}, statementPeriodEndDate: ${statementPeriodEndDate}`);

  const line1 = `${person.salutation.toLowerCase() === 'mr' ? 'Mr.' : 'Ms.'} ${person.first_name.toUpperCase()} ${person.last_name.toUpperCase()}`;

  const accountStatement = {
    id: 'mock' + crypto.createHash('md5').update(JSON.stringify(req.body)).digest('hex'),
    recipient_information: {
      line_1: line1,
      line_2: person.address.line_1,
      line_4: `${person.address.postal_code} ${person.address.city}`,
      line_5: 'Deutschland'
    },
    issue_date: `${year}-${(Number(period) + 1).toString().padStart(2, '0')}-01`,
    statement_period_start_date: statementPeriodStartDate,
    statement_period_end_date: statementPeriodEndDate,
    account_information: {
      iban: account.iban,
      bic: process.env.SOLARIS_BIC,
      balance_start: {
        value: 0,
        unit: 'cents',
        currency: 'EUR'
      },
      balance_end: {
        value: account.balance.value,
        unit: 'cents',
        currency: 'EUR'
      }
    },
    year,
    interval,
    period: Number(period),
    statement_number: `${year}-${isMonthlyInterval ? 'M' : 'Q'}-${period.padStart(2, '0')}`, // "2018-M/Q-01"
    disclaimer: 'Sehr geehrte Kundin, sehr geehrter Kunde,\nbitte prüfen Sie die Buchungen, Berechnungen und den Abschlusssaldo im beiliegenden Kontoauszug, der zugleich einen Rechnungsabschluss darstellt. Rechnungsabschlüsse gelten als genehmigt, sofern Sie innerhalb von sechs Wochen nach Zugang keine Einwendungen erheben. Einwendungen gegen Rechnungsabschlüsse müssen der solarisBank schriftlich oder in Textform (z.B. an service@solarisbank.de) zugehen. Im Falle der Einwendung in Textform genügt zur Fristwahrung die rechtzeitige Absendung. Der angegebene Kontostand berücksichtigt nicht die Wertstellung der einzelnen Buchungen. Dies bedeutet, dass der genannte Betrag nicht dem für die Zinsrechnung maßgeblichen Kontostand entsprechen muss und bei Verfügungen möglicherweise Zinsen für die Inanspruchnahme einer eingeräumten oder geduldeten Kontoüberziehung anfallen können. Gutschriften aus eingereichten Lastschriften und anderen Einzugspapieren erfolgen unter dem Vorbehalt der Einlösung. Guthaben sind als Einlagen nach Maßgabe des Einlagensicherungsgesetzes entschädigungsfähig. Nähere Informationen können dem Informationsbogen für den Einleger entnommen werden, den Sie gemeinsam mit unseren für den Geschäftsverkehr mit Ihnen geltenden Allgemeinen Geschäftsbedingungen und besonderen Bedingungen unter www.solarisbank.de/partner einsehen können.\n\nMit freundlichen Grüßen Ihre solarisBank.\n'
  };

  person.statements = person.statements || [];
  person.statements.push(accountStatement);

  await db.savePerson(person);

  log.info(
    `(createAccountStatement()) Generated account statement for solaris account id ${accountId} and solaris person id ${person.id}`,
    JSON.stringify(accountStatement)
  );

  res.status(200).send(JSON.stringify(accountStatement));
};

export const showAccountStatementBookings = async (req, res) => {
  const { page: { size, number } } = req.query;
  const {
    account_id: accountId,
    statement_of_account_id: statementOfAccountId
  } = req.params;

  log.info('(showAccountStatementBookings())', req.params);

  const person = await db.findPersonByAccountId(accountId);
  const accountStatement = (person.statements || [])
    .find((accountStatement) => accountStatement.id === statementOfAccountId);

  if (!accountStatement) {
    return res.status(404).send({
      errors: [
        {
          id: 'a29ac1d3cb5a5185d8f428a43b89a44bex',
          status: 404,
          code: 'model_not_found',
          title: 'Model Not Found',
          detail: `Couldn't find 'Solaris::AccountStatement' for id ${statementOfAccountId}.`
        }
      ]
    });
  }

  const {
    statement_period_start_date: startDate,
    statement_period_end_date: endDate
  } = accountStatement;

  const momentStartDate = moment(startDate);
  const momentEndDate = moment(endDate);

  const accountStatementsBookings = db.getPersonBookings(person)
    .filter((booking) => moment(booking.booking_date).isBetween(momentStartDate, momentEndDate, null, '[]'))
    .slice((number - 1) * size, number * size);

  log.info(
    `(showAccountStatementBookings()) Got ${accountStatementsBookings.length} bookings for account statement for solaris account id ${accountId} and solaris person id ${person.id}`,
    JSON.stringify(accountStatementsBookings)
  );

  res.status(200).send(JSON.stringify(accountStatementsBookings));
};
