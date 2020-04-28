import { getPerson, savePerson } from "../db";

export const updatePerson = async (req, res) => {
  const {
    params: { person_id: personId },
    body,
  } = req;

  const person = {
    ...(await getPerson(personId)),
    ...body,
  };

  await savePerson(person);
  return res.status(200).send(person);
};
