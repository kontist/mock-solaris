import uuid from "node-uuid";
import moment from "moment";
import path from "path";

import * as log from "../logger";
import { getPerson, savePerson, findPerson } from "../db";
import { triggerWebhook } from "../helpers/webhooks";
import {
  PostboxItemEvent,
  PostboxOwnerType,
  PostboxDocumentType,
} from "../helpers/types";

const POSTBOX_ITEM_EXAMPLE = {
  id: "d347d967ae8c4d58b93e6698b386cae9pbxi",
  belongs_to: "3e0b990bb0f49eb1a43904e78461c0cbcper",
  owner_type: PostboxOwnerType.PERSON,
  created_at: "2022-01-04T13:45:05Z",
  document_date: "2021-06-30",
  document_type: PostboxDocumentType.BALANCE_CONFIRMATION,
  name: "Item's name",
  description: "Description",
  customer_notification: true,
  customer_confirmation: false,
  document_size: 1667317,
  document_content_type: "application/pdf",
};

export const createPostboxItem = async ({
  personId,
  name,
  description,
  documentType,
  ownerType,
}) => {
  const person = await getPerson(personId);

  const today = moment().format("YYYY-MM-DD");

  if (!person.postboxItems) {
    person.postboxItems = [];
  }

  const postboxItem = {
    ...POSTBOX_ITEM_EXAMPLE,
    id: uuid.v4(),
    belongs_to: personId,
    owner_type: ownerType,
    created_at: today,
    document_type: documentType,
    name,
    description,
  };

  person.postboxItems.push(postboxItem);

  await savePerson(person);
  return { person, postboxItem };
};

export const createPostboxItemRequestHandler = async (req, res) => {
  const { person_id: personId } = req.params;

  log.info("createPostboxItemRequestHandler()", {
    reqBody: req.body,
    reqParams: req.params,
  });

  const { person, postboxItem } = await createPostboxItem({
    personId,
    ...req.body,
  });

  await triggerWebhook({
    type: PostboxItemEvent.POSTBOX_ITEM_CREATED,
    payload: postboxItem,
    personId: person.id,
  });

  res.redirect("back");
};

export const listPostboxItems = async (req, res) => {
  const personId = req.params.person_id;

  if (!personId) {
    res.status(404).send("Not found");
    return;
  }

  log.info(`listPostboxItems() get list of postbox items for ${personId}`);

  const person = await getPerson(personId);
  res.status(200).send(person.postboxItems || []);
};

const getPostboxItemById = async (postboxItemId: string) => {
  const person = await findPerson(
    (p) => !!(p?.postboxItems ?? []).find((pb) => pb.id === postboxItemId)
  );
  return (person?.postboxItems ?? []).find((pb) => pb.id === postboxItemId);
};

export const getPostboxItem = async (req, res) => {
  const postboxItemId = req.params.postbox_item_id;

  if (!postboxItemId) {
    res.status(404).send("Not found");
    return;
  }

  log.info(`getPostboxItem() get postbox item ${postboxItemId}`);

  const postboxItem = await getPostboxItemById(postboxItemId);

  if (!postboxItem) {
    res.status(404).send("Not found");
    return;
  }

  res.status(200).send(postboxItem);
};

export const downloadPostboxItem = async (req, res) => {
  const postboxItemId = req.params.postbox_item_id;

  if (!postboxItemId) {
    res.status(404).send("Not found");
    return;
  }

  const postboxItem = await getPostboxItemById(postboxItemId);

  if (!postboxItem) {
    res.status(404).send("Not found");
    return;
  }

  log.info(`downloadPostboxItem() download postbox items ${postboxItemId}`);

  res.download(path.join(__dirname, "../assets/sample.pdf"));
};
