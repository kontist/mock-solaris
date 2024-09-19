import type { Request, Response } from "express";

import generateID from "../../helpers/id";
import * as log from "../../logger";

export const postDocument = async (req: Request, res: Response) => {
  const documentType = req.body.document_type as string;

  if (!documentType) {
    return res.status(400).send({
      id: generateID(),
      status: 400,
      code: "bad_request",
      title: "Bad Request",
      detail: "document_type is required",
    });
  }

  if (!req.file) {
    return res.status(400).send({
      id: generateID(),
      status: 400,
      code: "bad_request",
      title: "Bad Request",
      detail: "file is required",
    });
  }

  log.info("Document uploaded", {
    person_id: req.params.person_id,
    documentType,
    file: req.file.originalname,
  });

  return res.status(201).send({
    id: generateID(),
    document_type: documentType,
    name: "Operation_authorization.png",
    content_type: "image/png",
    size: 10187,
    customer_accessible: false,
    created_at: new Date(),
    deleted_at: null,
  });
};
