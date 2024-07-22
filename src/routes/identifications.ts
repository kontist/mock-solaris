import fetch from "node-fetch";

import { getPerson, savePerson } from "../db";
import generateID from "../helpers/id";
import * as log from "../logger";

export const requireIdentification = async (req, res) => {
  const { person_id: personId } = req.params;

  const { method } = req.body;

  const identificationId = generateID();

  let person;
  let identification;

  return getPerson(personId)
    .then((_person) => {
      person = _person;

      identification = {
        id: identificationId,
        reference: null,
        url: null,
        createdAt: new Date(),
        status: "created",
        completed_at: null,
        method,
      };

      person.identifications[identificationId] = identification;
    })
    .then(() => savePerson(person))
    .then(() => {
      res.status(201).send(identification);
    });
};

export const patchIdentification = async (req, res) => {
  const { person_id: personId, id: identificationId } = req.params;

  const person = (await getPerson(personId)) || {
    identifications: {},
    transactions: [],
  };
  person.identifications[identificationId] =
    person.identifications[identificationId] || {};

  let createUrl;
  let identificationUrl;
  let startUrl;
  const reference = undefined;

  if (person.identifications[identificationId].method === "idnow") {
    createUrl = `https://gateway.test.idnow.de/api/v1/kontist/identifications/${identificationId}/start`;
    identificationUrl = `https://go.test.idnow.de/kontist/identifications/${identificationId}`;
    startUrl = `https://api.test.idnow.de/api/v1/kontist/identifications/${identificationId}/start`;

    if (process.env.MOCKSOLARIS_DISABLE_IDNOW_TESTSERVER !== "true") {
      const response = await fetch(createUrl, {
        method: "POST",
        headers: {
          "X-API-KEY": "0A0KQ6KGHUAEN0RLRHLB3V3S840ZWH7ZVXE2WYZ0",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Hubot",
          login: "hubot",
          birthday: "1975-12-20",
          birthplace: "München",
          city: "München",
          country: "DE",
          custom1: "287492_23552",
          email: "sampleuser@example.com",
          firstname: "X-AUTOTEST-FRAUDIDENT",
          lastname: "Berger",
          mobilephone: "0151 23411232",
          nationality: "DE",
          street: "Bahnstrasse",
          streetnumber: "27",
          zipcode: "80127",
        }),
      });

      const text = await response.text();

      log.info("received from idnow", text);

      let idnowresponse;
      try {
        idnowresponse = JSON.parse(text);
      } catch (error) {
        log.error("Could not parse idnow answer as JSON:", text);
        throw error;
      }

      if (idnowresponse.errors) {
        const message = `Received error response from idnow: ${JSON.stringify(
          idnowresponse
        )}`;
        throw new Error(message);
      }
    }
  }

  person.identifications[identificationId] = {
    ...person.identifications[identificationId],
    id: identificationId,
    url: identificationUrl,
    status: "pending",
    startUrl,
    reference,
    completed_at: null,
    identificationLinkCreatedAt: new Date(),
    person_id: personId,
    email: person.email,
  };

  await savePerson(person);

  res.status(201).send({
    id: identificationId,
    url: identificationUrl,
    status: "pending",
    reference,
    completed_at: null,
    method: "idnow",
    estimated_waiting_time: Math.floor(Math.random() * 10) + 1,
  });
};

export const showPersonIdentifications = (req, res) => {
  const personIdentifications = Object.values(req.person.identifications)
    .filter((identification: any) => identification.status !== "created")
    .map((identification: any) => {
      return {
        ...identification,
        id: identification.id.substr(0, 36),
        status: identification.status || "pending",
      };
    });
  res.status(200).send(personIdentifications);
};
