import _ from "lodash";
import moment from "moment";

import {
  getPerson,
  savePerson,
  getMobileNumber,
  getPersonByDeviceId,
} from "../db";
import {
  removeMobileNumberConfirmChangeRequest,
  MOBILE_NUMBER_CHANGE_METHOD,
} from "./mobileNumber";
import {
  confirmStandingOrderCreation,
  confirmStandingOrderUpdate,
  confirmStandingOrderCancelation,
  STANDING_ORDER_CREATE_METHOD,
  STANDING_ORDER_UPDATE_METHOD,
  STANDING_ORDER_CANCEL_METHOD,
} from "./standingOrders";
import { PERSON_UPDATE } from "./persons";
import {
  TIN_UPDATE,
  processChangeRequest as tinProcessChangeRequest,
} from "./taxIdentifications";
import { TIMED_ORDER_CREATE } from "./timedOrders";
import {
  BATCH_TRANSFER_CREATE_METHOD,
  confirmBatchTransfer,
} from "./batchTransfers";
import { CHANGE_REQUEST_CHANGE_CARD_PIN } from "../helpers/cards";
import { confirmChangeCardPINHandler } from "./cards";
import {
  PersonWebhookEvent,
  DeliveryMethod,
  AuthorizeChangeRequestResponse,
  ChangeRequestStatus,
  MockPerson,
} from "../helpers/types";
import { triggerWebhook } from "../helpers/webhooks";
import {
  CARD_TRANSACTION_CONFIRM_METHOD,
  confirmCardTransaction,
  declineCardTransaction,
} from "../helpers/scaChallenge";
import { SEPA_TRANSFER_METHOD } from "./transactions";

const MAX_CHANGE_REQUEST_AGE_IN_MINUTES = 5;

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
        ". While authorization required, no entity with a possibility to authorize data change is present.",
    });
  }

  const changeRequestId = Date.now().toString();
  person.changeRequest = {
    id: changeRequestId,
    method,
    delta,
  };
  await savePerson(person);

  return res.status(202).send({
    id: changeRequestId,
    status: ChangeRequestStatus.AUTHORIZATION_REQUIRED,
    updated_at: new Date().toISOString(),
    url: `:env/v1/change_requests/${changeRequestId}/authorize`,
  });
};

export const authorizeChangeRequest = async (req, res) => {
  const {
    person_id: personId,
    delivery_method: deliveryMethod,
    device_id: deviceId,
  } = req.body;
  const changeRequestId = req.params.change_request_id;
  const person = personId
    ? await getPerson(personId)
    : await getPersonByDeviceId(deviceId);

  const changeRequestMethod = person.changeRequest.method;
  const response: AuthorizeChangeRequestResponse = {
    id: changeRequestId,
    status: ChangeRequestStatus.CONFIRMATION_REQUIRED,
    updated_at: new Date().toISOString(),
  };

  if (personId && deliveryMethod === DeliveryMethod.MOBILE_NUMBER) {
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
              detail: `Couldn't find 'Solaris::MobileNumber' for id '${personId}'.`,
            },
          ],
        });
      }
    }

    await assignAuthorizationToken(person);
  }

  if (deliveryMethod === DeliveryMethod.DEVICE_SIGNING) {
    response.string_to_sign = Date.now().toString();
  }

  return res.status(201).send(response);
};

export const confirmChangeRequest = async (req, res) => {
  const { change_request_id: changeRequestId } = req.params;
  const { person_id: personId, tan, device_id: deviceId, signature } = req.body;
  const person = (
    personId ? await getPerson(personId) : await getPersonByDeviceId(deviceId)
  ) as MockPerson;

  if (deviceId && !signature) {
    return res.status(403).send({ message: "Missing signature" });
  }

  const age = moment().diff(
    moment(_.get(person, "changeRequest.createdAt")),
    "minutes"
  );

  // A change request older than 5 minutes doesn't exist
  if (!person.changeRequest || age > MAX_CHANGE_REQUEST_AGE_IN_MINUTES) {
    return res.status(422).send({
      errors: [
        {
          id: Date.now().toString(),
          status: 422,
          code: "unprocessable_entity",
          title: "Unprocessable Entity",
          detail: `Unknown change request for Solaris::Person ${personId}`,
        },
      ],
    });
  }

  if (tan && tan !== person.changeRequest.token) {
    // An invalid TAN also invalidates the action it is meant to authorize
    delete person.changeRequest;
    await savePerson(person);

    return res.status(403).send({
      errors: [
        {
          id: Date.now().toString(),
          status: 403,
          code: "invalid_tan",
          title: "Invalid TAN",
          detail: `Invalid or expired TAN for Solaris`,
        },
      ],
    });
  }

  let status = 202;
  let response: any = {
    status: ChangeRequestStatus.COMPLETED,
    response_code: status,
    id: changeRequestId,
  };
  switch (person.changeRequest.method) {
    case SEPA_TRANSFER_METHOD: {
      const today = moment().format("YYYY-MM-DD");
      const transfer = person.queuedBookings?.find(
        (queuedBooking) => queuedBooking.id === person.changeRequest.transfer.id
      );

      // update transfer status to accepted so it can affect user balance
      Object.assign(transfer, {
        transaction_id: transfer.id,
        booking_date: today,
        valuta_date: today,
        name: `bank-mock-transaction-${Math.random()}`,
        status: "accepted",
      });

      response.response_body = person.changeRequest.transfer;

      break;
    }

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
      // TODO: FIX response.response_body = await confirmTimedOrder(person);
      break;
    case BATCH_TRANSFER_CREATE_METHOD:
      response.response_body = await confirmBatchTransfer(
        person,
        changeRequestId
      );
      break;
    case CHANGE_REQUEST_CHANGE_CARD_PIN:
      return confirmChangeCardPINHandler(req, res);
    case CARD_TRANSACTION_CONFIRM_METHOD:
      if (
        changeRequestId === person.changeRequest.authenticateChangeRequestId
      ) {
        await confirmCardTransaction(person);
      } else if (
        changeRequestId === person.changeRequest.declineChangeRequestId
      ) {
        await declineCardTransaction(person);
      }
      break;

    default:
      status = 404;
      response = {
        errors: [
          {
            id: Date.now().toString(),
            status: 404,
            code: "model_not_found",
            title: "Model Not Found",
            detail: `Couldn't find 'Solaris::Changeset' for id '${changeRequestId}'`,
          },
        ],
      };
      break;
  }

  const shouldTriggerWebhook = person.changeRequest.method === PERSON_UPDATE;
  delete person.changeRequest;
  await savePerson(person);

  if (shouldTriggerWebhook) {
    await triggerWebhook({
      type: PersonWebhookEvent.PERSON_CHANGED,
      payload: {},
      extraHeaders: { "solaris-entity-id": personId },
      personId: person.id,
    });
  }

  return res.status(status).send(response);
};

const assignAuthorizationToken = async (person) => {
  person.changeRequest.token = Date.now().toString().substr(-6);
  await savePerson(person);
};
