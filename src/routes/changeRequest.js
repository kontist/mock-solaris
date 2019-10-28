import _ from "lodash";

import { getPerson, savePerson, getMobileNumber } from "../db";
import {
  removeMobileNumberConfirmChangeRequest,
  MOBILE_NUMBER_CHANGE_METHOD
} from "./mobileNumber";
import {
  confirmStandingOrderCreation,
  confirmStandingOrderUpdate,
  confirmStandingOrderCancelation,
  STANDING_ORDER_CREATE_METHOD,
  STANDING_ORDER_UPDATE_METHOD,
  STANDING_ORDER_CANCEL_METHOD
} from "./standingOrders";
import { PERSON_UPDATE } from "./persons";
import {
  TIN_UPDATE,
  processChangeRequest as tinProcessChangeRequest
} from "./taxIdentifications";
import { TIMED_ORDER_CREATE, confirmTimedOrder } from "./timedOrders";
import {
  BATCH_TRANSFER_CREATE_METHOD,
  confirmBatchTransfer
} from "./batchTransfers";

export const createChangeRequest = async (req, res, person, method, delta) => {
  const personId = person.id;

  const mobileNumber = await getMobileNumber(personId);
  if (!mobileNumber) {
    return res.status(403).send({
      id: Date.now().toString(),
      status: 403,
      code: "Unauthorized Change Request",
      title: "Unauthorized Change Request",
      detail:
        "Unauthorized change request for Solaris::Person " +
        personId +
        ". While authorization required, no entity with a possibility to authorize data change is present."
    });
  }

  const changeRequestId = Date.now().toString();
  person.changeRequest = {
    id: changeRequestId,
    method: method,
    delta: delta
  };
  await savePerson(person);

  return res.status(202).send({
    id: changeRequestId,
    status: "AUTHORIZATION_REQUIRED",
    updated_at: new Date().toISOString(),
    url: `:env/v1/change_requests/${changeRequestId}/authorize`
  });
};

export const authorizeChangeRequest = async (req, res) => {
  const { person_id: personId, delivery_method: deliveryMethod } = req.body;
  const changeRequestId = req.params.change_request_id;
  const person = await getPerson(personId);
  const changeRequestMethod = person.changeRequest.method;

  if (personId && deliveryMethod === "mobile_number") {
    if (changeRequestMethod === MOBILE_NUMBER_CHANGE_METHOD) {
      const existingMobileNumber = await getMobileNumber(personId);
      if (!existingMobileNumber) {
        return res.status(404).send({
          errors: [
            {
              id: Date.now().toString(),
              status: 404,
              code: "model_not_found",
              title: "Model Not Found",
              detail: `Couldn't find 'Solaris::MobileNumber' for id '${personId}'.`
            }
          ]
        });
      }
    }

    await assignAuthorizationToken(person);
    return res.status(201).send({
      id: changeRequestId,
      status: "CONFIRMATION_REQUIRED",
      updated_at: new Date().toISOString()
    });
  }

  return res.status(404).send({
    errors: [
      {
        id: Date.now().toString(),
        status: 401,
        code: "invalid_token",
        title: "Invalid Token",
        detail: "Token is invalid"
      }
    ]
  });
};

export const confirmChangeRequest = async (req, res) => {
  const { change_request_id: changeRequestId } = req.params;
  const { person_id: personId, tan } = req.body;
  const person = await getPerson(personId);

  // TODO: Each TAN is limited in time. 5 minutes

  if (tan !== person.changeRequest.token) {
    // TODO: An invalid TAN also invalidates the action it is meant to authorize
    return res.status(403).send({
      errors: [
        {
          id: Date.now().toString(),
          status: 403,
          code: "invalid_tan",
          title: "Invalid TAN",
          detail: `Invalid or expired TAN for Solaris`
        }
      ]
    });
  }

  let status = 201;
  let response = { status: "COMPLETED", response_code: status };

  switch (person.changeRequest.method) {
    case MOBILE_NUMBER_CHANGE_METHOD:
      response.response_body = await removeMobileNumberConfirmChangeRequest(
        person
      );
      break;
    case STANDING_ORDER_CREATE_METHOD:
      response.response_body = await confirmStandingOrderCreation(
        person,
        changeRequestId
      );
      break;
    case STANDING_ORDER_UPDATE_METHOD:
      response.response_body = await confirmStandingOrderUpdate(person);
      break;
    case STANDING_ORDER_CANCEL_METHOD:
      response.response_body = await confirmStandingOrderCancelation(person);
      break;
    case PERSON_UPDATE:
      _.merge(person, person.changeRequest.delta);
      response.response_body = person;
      break;
    case TIN_UPDATE:
      response.response_body = await tinProcessChangeRequest(person);
      break;
    case TIMED_ORDER_CREATE:
      response.response_body = await confirmTimedOrder(person);
      break;
    case BATCH_TRANSFER_CREATE_METHOD:
      response.response_body = await confirmBatchTransfer(
        person,
        changeRequestId
      );
      break;
    default:
      status = 400;
      response = { message: "Unknown method!" };
      break;
  }

  delete person.changeRequest;
  await savePerson(person);

  return res.status(status).send(response);
};

const assignAuthorizationToken = async person => {
  person.changeRequest.token = Date.now()
    .toString()
    .substr(-6);
  await savePerson(person);
};
