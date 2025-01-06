import type { Request, Response } from "express";
import moment from "moment";
import path from "path";

import * as log from "../logger";
import {
  getPerson,
  savePerson,
  findPerson,
  getBusiness,
  saveBusiness,
  redisClient,
} from "../db";
import { triggerWebhook } from "../helpers/webhooks";
import {
  PostboxItemEvent,
  PostboxOwnerType,
  PostboxDocumentType,
  PostboxItem,
} from "../helpers/types";
import generateID from "../helpers/id";

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
  entityId,
  name,
  description,
  documentType,
  ownerType,
}: {
  entityId: string;
  name: string;
  description: string;
  documentType: PostboxDocumentType;
  ownerType: PostboxOwnerType;
}) => {
  const today = moment().format("YYYY-MM-DD");
  const postboxItemId = generateID();

  const postboxItem = {
    ...POSTBOX_ITEM_EXAMPLE,
    id: postboxItemId,
    belongs_to: entityId,
    owner_type: ownerType,
    created_at: today,
    document_type: documentType,
    name,
    description,
  };

  const entity = await (ownerType === PostboxOwnerType.PERSON
    ? getPerson
    : getBusiness)(entityId);

  entity.postboxItems = entity.postboxItems || [];
  entity.postboxItems.push(postboxItem);
  await (ownerType === PostboxOwnerType.PERSON ? savePerson : saveBusiness)(
    entity
  );

  await redisClient.hSet(
    "postbox_item_map",
    postboxItemId,
    JSON.stringify({ entityType: ownerType, entityId })
  );

  return { entity, postboxItem };
};

export const findEntityByPostboxItemId = async (postboxItemId: string) => {
  const mapping = await redisClient.hGet("postbox_item_map", postboxItemId);

  if (!mapping) {
    return null;
  }

  const { entityType, entityId } = JSON.parse(mapping);

  if (entityType === PostboxOwnerType.PERSON) {
    return getPerson(entityId);
  } else {
    return getBusiness(entityId);
  }
};

export const createPostboxItemRequestHandler = async (
  req: Request,
  res: Response
) => {
  const { entityId } = req.params;

  log.info("createPostboxItemRequestHandler()", {
    reqBody: req.body,
    reqParams: req.params,
  });

  const { postboxItem } = await createPostboxItem({
    entityId,
    ...req.body,
  });

  await triggerWebhook({
    type: PostboxItemEvent.POSTBOX_ITEM_CREATED,
    payload: postboxItem,
  });

  res.redirect("back");
};

export const listPostboxItems = async (req: Request, res: Response) => {
  const { entityId, entityType } = req.params;

  if (!entityId) {
    res.status(404).send("Not found");
    return;
  }

  log.info(
    `listPostboxItems() get list of postbox items for ${entityType} ${entityId}`
  );

  const entity = await (entityType.includes(
    PostboxOwnerType.PERSON.toLowerCase()
  )
    ? getPerson
    : getBusiness)(entityId);

  if (!entity) {
    res.status(404).send("Not found");
    return;
  }

  res.status(200).send(entity.postboxItems || []);
};

export const getPostboxItemById = async (postboxItemId: string) => {
  const entity = await findEntityByPostboxItemId(postboxItemId);

  if (!entity) {
    return null;
  }

  return (entity.postboxItems ?? []).find(
    (pb: PostboxItem) => pb.id === postboxItemId
  );
};

export const getPostboxItem = async (req: Request, res: Response) => {
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

export const downloadPostboxItem = async (req: Request, res: Response) => {
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
