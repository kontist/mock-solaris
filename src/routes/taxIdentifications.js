import crypto from 'crypto';

import {
  getTaxIdentifications,
  saveTaxIdentifications
} from '../db';

export const submitTaxIdentification = async (req, res) => {
  const {
    person_id: personId
  } = req.params;

  const {
    country,
    number,
    primary,
    reason_no_tin: reasonNoTin,
    reason_description: reasonDescription
  } = req.body;

  const identifications = await getTaxIdentifications(personId);

  const identificationId = `taxid-${personId}-${
    crypto.createHash('md5').update(
      JSON.stringify(req.body) + identifications.length
    ).digest('hex')
  }`;

  const newIdentification = {
    id: identificationId,
    country,
    number,
    primary,
    'reason_no_tin': reasonNoTin || null,
    'reason_description': reasonDescription || null
  };

  if (identifications.length === 0) {
    if (!newIdentification.primary) {
      res.status(400).send('The first tax_identification submitted has to be primary.');
      return;
    }
  } else {
    /*
    "In case a consequent tax_identification is submitted as primary"
    "the latest one holds the primary flag and the previously submitted ones lose it."
    */
    if (newIdentification.primary) {
      for (let i = 0; i < identifications.length; i++) {
        identifications[i].primary = false;
      }
    }
  }

  await saveTaxIdentifications(
    personId,
    identifications.concat([newIdentification])
  );

  res.status(201).send(newIdentification);
};

export const showTaxIdentification = async (req, res) => {
  const {
    person_id: personId,
    id: taxIdentificationId
  } = req.params;

  const identifications = await getTaxIdentifications(personId);

  const identification = identifications.find((identificationRecord) =>
    identificationRecord.id === taxIdentificationId);

  res.status(201).send(identification);
};

export const listTaxIdentifications = async (req, res) => {
  const { person_id: personId } = req.params;

  const identifications = await getTaxIdentifications(personId);

  res.status(201).send(identifications);
};
