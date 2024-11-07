import fetch from "node-fetch";

import { getPerson, savePerson } from "../db";
import generateID from "../helpers/id";
import * as log from "../logger";
import { MockPerson } from "../helpers/types";

export const createIdentification = async (
  person: MockPerson,
  method = "idnow"
) => {
  const identificationId = generateID();

  const identification = {
    id: identificationId,
    reference: null,
    url: null,
    createdAt: new Date(),
    status: "created",
    completed_at: null,
    method,
  };

  person.identifications[identificationId] = identification;
  await savePerson(person);

  return identification;
};

export const requireIdentification = async (req, res) => {
  const { person_id: personId } = req.params;

  const { method } = req.body;

  const person = await getPerson(personId);
  const identification = await createIdentification(person, method);

  res.status(201).send(identification);
};

export const generatePendingIdentitfication = async (
  person: MockPerson,
  identificationId: string
) => {
  const updatedIdentification = {
    ...(person.identifications[identificationId] as Record<string, any>),
    id: identificationId,
    url: `https://go.test.idnow.de/kontist/identifications/${identificationId}`,
    status: "pending",
    reference: "TS2-LSGGR",
    completed_at: null,
    identificationLinkCreatedAt: new Date(),
    person_id: person.id,
    email: person.email,
  };

  person.identifications[identificationId] = updatedIdentification;

  await savePerson(person);

  return updatedIdentification;
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

  if (person.identifications[identificationId].method === "idnow") {
    createUrl = `https://gateway.test.idnow.de/api/v1/kontist/identifications/${identificationId}/start`;

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

  const updatedIdentification = await generatePendingIdentitfication(
    person,
    identificationId
  );

  res.status(201).send({
    id: identificationId,
    url: updatedIdentification.url,
    status: updatedIdentification.status,
    reference: updatedIdentification.reference,
    completed_at: updatedIdentification.completed_at,
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
