import sinon from "sinon";
import { expect } from "chai";
import { mockReq, mockRes } from "sinon-express-mock";

import * as db from "../../src/db";

import { createIntraCustomerTransfer } from "../../src/routes/intraCustomerTransfer";
import { createPerson } from "../../src/routes/persons";
import * as backofficeHelpers from "../../src/routes/backoffice";
import { AccountType, BookingType } from "../../src/helpers/types";
import { createBusiness } from "../../src/routes/business/businesses";

describe("Intra Customer Transfer", () => {
  describe("for person account", () => {
    let personId: string;
    let person: any;
    let res: sinon.SinonSpy;
    let triggerWebhookStub: sinon.SinonStub;

    const mainAccount = {
      id: "main-account-id",
      iban: "DE1234567890",
      type: AccountType.CHECKING_SOLE_PROPRIETOR,
    };

    const subAccount = {
      id: "sub-account-id",
      iban: "DE1234567891",
      type: AccountType.CHECKING_SUBACCOUNT,
      transactions: [],
      available_balance: {
        value: 0,
        currency: "EUR",
      },
      balance: {
        value: 0,
        currency: "EUR",
      },
    };

    before(async () => {
      await db.flushDb();
      res = mockRes();

      triggerWebhookStub = sinon.stub(
        backofficeHelpers,
        "triggerBookingsWebhook"
      );

      await createPerson(
        {
          body: {
            first_name: "Dean",
            last_name: "Winchester",
            account: mainAccount,
            accounts: [subAccount],
            transactions: [
              {
                id: "transaction-id",
                amount: {
                  value: 1000,
                  currency: "EUR",
                },
                valuta_date: "2024-01-01",
              },
            ],
          },
          headers: {},
        },
        res
      );

      personId = res.send.args[0][0].id;
    });

    after(() => {
      db.flushDb();
      triggerWebhookStub.restore();
    });

    describe("createIntraCustomerTransfer from main to sub account", () => {
      const transfer = {
        recipient_iban: subAccount.iban,
        description: "test",
        reference: "123456",
        amount: {
          value: 200,
          currency: "EUR",
        },
      };
      before(async () => {
        const req = mockReq({
          params: {
            person_id: personId,
            account_id: mainAccount.id,
          },
          body: transfer,
        });

        await createIntraCustomerTransfer(req, res);

        person = await db.getPerson(personId);
      });

      it("should return succesfull response", () => {
        expect(res.status.getCall(0).args[0]).to.equal(201);

        const response = res.send.args[1][0];
        expect(response.id).to.be.ok;
        expect(response.recipient_iban).to.equal(subAccount.iban);
        expect(response.amount).to.equal(transfer.amount);
        expect(response.created_at).to.be.ok;
      });

      it("should update data on the main account and create a booking", () => {
        const account = person.account;
        expect(account.balance.value).to.equal(800);
        expect(account.available_balance.value).to.equal(800);

        const transaction = account.transactions.find(
          (t) => t.recipient_iban === subAccount.iban
        );
        expect(transaction.amount.value).to.equal(-transfer.amount.value);
        expect(transaction.description).to.equal(transfer.description);
        expect(transaction.booking_type).to.equal(
          BookingType.INTRA_CUSTOMER_TRANSFER
        );
        expect(transaction.recipient_name).to.equal("Dean Winchester");
        expect(transaction.sender_name).to.equal("Dean Winchester");
        expect(transaction.sender_iban).to.equal(mainAccount.iban);
        expect(transaction.recipient_iban).to.equal(subAccount.iban);
      });

      it("should update data on the sub account and create a booking", () => {
        const account = person.accounts[0];
        expect(account.balance.value).to.equal(200);
        expect(account.available_balance.value).to.equal(200);

        const transaction = account.transactions[0];
        expect(transaction.amount.value).to.equal(transfer.amount.value);
        expect(transaction.description).to.equal(transfer.description);
        expect(transaction.booking_type).to.equal(
          BookingType.INTRA_CUSTOMER_TRANSFER
        );
        expect(transaction.recipient_name).to.equal("Dean Winchester");
        expect(transaction.sender_name).to.equal("Dean Winchester");
        expect(transaction.sender_iban).to.equal(mainAccount.iban);
        expect(transaction.recipient_iban).to.equal(subAccount.iban);
      });

      it("should trigget 2 webhooks", () => {
        expect(triggerWebhookStub.calledTwice).to.be.true;

        expect([
          triggerWebhookStub.getCall(0).args[2],
          triggerWebhookStub.getCall(1).args[2],
        ]).to.have.members([subAccount.id, mainAccount.id]);
      });
    });

    describe("createIntraCustomerTransfer from sub to main account", () => {
      const transfer = {
        recipient_iban: mainAccount.iban,
        description: "test-2",
        reference: "1234000",
        amount: {
          value: 100,
          currency: "EUR",
        },
      };
      before(async () => {
        triggerWebhookStub.resetHistory();
        res = mockRes();

        const req = mockReq({
          params: {
            person_id: personId,
            account_id: subAccount.id,
          },
          body: transfer,
        });

        await createIntraCustomerTransfer(req, res);

        person = await db.getPerson(personId);
      });

      it("should return succesfull response", () => {
        expect(res.status.getCall(0).args[0]).to.equal(201);

        const response = res.send.args[0][0];
        expect(response.id).to.be.ok;
        expect(response.recipient_iban).to.equal(mainAccount.iban);
        expect(response.amount).to.equal(transfer.amount);
        expect(response.created_at).to.be.ok;
      });

      it("should update data on the main account and create a booking", () => {
        const account = person.account;
        expect(account.balance.value).to.equal(900);
        expect(account.available_balance.value).to.equal(900);

        const transaction = account.transactions.find(
          (t) => t.description === transfer.description
        );
        expect(transaction.amount.value).to.equal(transfer.amount.value);
        expect(transaction.description).to.equal(transfer.description);
        expect(transaction.booking_type).to.equal(
          BookingType.INTRA_CUSTOMER_TRANSFER
        );
        expect(transaction.recipient_name).to.equal("Dean Winchester");
        expect(transaction.sender_name).to.equal("Dean Winchester");
        expect(transaction.sender_iban).to.equal(subAccount.iban);
        expect(transaction.recipient_iban).to.equal(mainAccount.iban);
      });

      it("should update data on the sub account and create a booking", () => {
        const account = person.accounts[0];
        expect(account.balance.value).to.equal(100);
        expect(account.available_balance.value).to.equal(100);

        const transaction = account.transactions.find(
          (t) => t.description === transfer.description
        );
        expect(transaction.amount.value).to.equal(-transfer.amount.value);
        expect(transaction.description).to.equal(transfer.description);
        expect(transaction.booking_type).to.equal(
          BookingType.INTRA_CUSTOMER_TRANSFER
        );
        expect(transaction.recipient_name).to.equal("Dean Winchester");
        expect(transaction.sender_name).to.equal("Dean Winchester");
        expect(transaction.sender_iban).to.equal(subAccount.iban);
        expect(transaction.recipient_iban).to.equal(mainAccount.iban);
      });

      it("should trigget 2 webhooks", () => {
        expect(triggerWebhookStub.calledTwice).to.be.true;

        expect([
          triggerWebhookStub.getCall(0).args[2],
          triggerWebhookStub.getCall(1).args[2],
        ]).to.have.members([subAccount.id, mainAccount.id]);
      });
    });
  });

  describe("for business account", () => {
    let personId: string;
    let businessId: string;
    let business: any;
    let res: sinon.SinonSpy;
    let triggerWebhookStub: sinon.SinonStub;

    const mainAccount = {
      id: "main-account-id",
      iban: "DE1234567890",
      type: AccountType.CHECKING_BUSINESS,
    };

    const subAccount = {
      id: "sub-account-id",
      iban: "DE1234567891",
      type: AccountType.CHECKING_SUBACCOUNT,
      transactions: [],
      available_balance: {
        value: 0,
        currency: "EUR",
      },
      balance: {
        value: 0,
        currency: "EUR",
      },
    };

    before(async () => {
      await db.flushDb();
      res = mockRes();

      triggerWebhookStub = sinon.stub(
        backofficeHelpers,
        "triggerBookingsWebhook"
      );

      await createBusiness(
        {
          body: {
            name: "Kontist GmbH",
            account: mainAccount,
            accounts: [subAccount],
            transactions: [
              {
                id: "transaction-id",
                amount: {
                  value: 1000,
                  currency: "EUR",
                },
                valuta_date: "2024-01-01",
              },
            ],
          },
          headers: {},
        },
        res
      );

      businessId = res.send.args[0][0].id;

      await createPerson(
        {
          body: {
            businessId,
          },
          headers: {},
        },
        res
      );

      personId = res.send.args[1][0].id;
    });

    after(() => {
      db.flushDb();
      triggerWebhookStub.restore();
    });

    describe("createIntraCustomerTransfer from main to sub account", () => {
      const transfer = {
        recipient_iban: subAccount.iban,
        description: "test",
        reference: "123456",
        amount: {
          value: 200,
          currency: "EUR",
        },
      };
      before(async () => {
        const req = mockReq({
          params: {
            person_id: personId,
            account_id: mainAccount.id,
          },
          body: transfer,
        });

        await createIntraCustomerTransfer(req, res);

        business = await db.getBusiness(businessId);
      });

      it("should return succesfull response", () => {
        expect(res.status.getCall(0).args[0]).to.equal(201);

        const response = res.send.args[2][0];
        expect(response.id).to.be.ok;
        expect(response.recipient_iban).to.equal(subAccount.iban);
        expect(response.amount).to.equal(transfer.amount);
        expect(response.created_at).to.be.ok;
      });

      it("should update data on the main account and create a booking", () => {
        const account = business.account;
        expect(account.balance.value).to.equal(800);
        expect(account.available_balance.value).to.equal(800);

        const transaction = account.transactions.find(
          (t) => t.recipient_iban === subAccount.iban
        );
        expect(transaction.amount.value).to.equal(-transfer.amount.value);
        expect(transaction.description).to.equal(transfer.description);
        expect(transaction.booking_type).to.equal(
          BookingType.INTRA_CUSTOMER_TRANSFER
        );
        expect(transaction.recipient_name).to.equal(business.name);
        expect(transaction.sender_name).to.equal(business.name);
        expect(transaction.sender_iban).to.equal(mainAccount.iban);
        expect(transaction.recipient_iban).to.equal(subAccount.iban);
      });

      it("should update data on the sub account and create a booking", () => {
        const account = business.accounts[0];
        expect(account.balance.value).to.equal(200);
        expect(account.available_balance.value).to.equal(200);

        const transaction = account.transactions[0];
        expect(transaction.amount.value).to.equal(transfer.amount.value);
        expect(transaction.description).to.equal(transfer.description);
        expect(transaction.booking_type).to.equal(
          BookingType.INTRA_CUSTOMER_TRANSFER
        );
        expect(transaction.recipient_name).to.equal(business.name);
        expect(transaction.sender_name).to.equal(business.name);
        expect(transaction.sender_iban).to.equal(mainAccount.iban);
        expect(transaction.recipient_iban).to.equal(subAccount.iban);
      });

      it("should trigget 2 webhooks", () => {
        expect(triggerWebhookStub.calledTwice).to.be.true;

        expect([
          triggerWebhookStub.getCall(0).args[2],
          triggerWebhookStub.getCall(1).args[2],
        ]).to.have.members([subAccount.id, mainAccount.id]);
      });
    });

    describe("createIntraCustomerTransfer from sub to main account", () => {
      const transfer = {
        recipient_iban: mainAccount.iban,
        description: "test-2",
        reference: "1234000",
        amount: {
          value: 100,
          currency: "EUR",
        },
      };
      before(async () => {
        triggerWebhookStub.resetHistory();
        res = mockRes();

        const req = mockReq({
          params: {
            person_id: personId,
            account_id: subAccount.id,
          },
          body: transfer,
        });

        await createIntraCustomerTransfer(req, res);

        business = await db.getBusiness(businessId);
      });

      it("should return succesfull response", () => {
        expect(res.status.getCall(0).args[0]).to.equal(201);

        const response = res.send.args[0][0];
        expect(response.id).to.be.ok;
        expect(response.recipient_iban).to.equal(mainAccount.iban);
        expect(response.amount).to.equal(transfer.amount);
        expect(response.created_at).to.be.ok;
      });

      it("should update data on the main account and create a booking", () => {
        const account = business.account;
        expect(account.balance.value).to.equal(900);
        expect(account.available_balance.value).to.equal(900);

        const transaction = account.transactions.find(
          (t) => t.description === transfer.description
        );
        expect(transaction.amount.value).to.equal(transfer.amount.value);
        expect(transaction.description).to.equal(transfer.description);
        expect(transaction.booking_type).to.equal(
          BookingType.INTRA_CUSTOMER_TRANSFER
        );
        expect(transaction.recipient_name).to.equal(business.name);
        expect(transaction.sender_name).to.equal(business.name);
        expect(transaction.sender_iban).to.equal(subAccount.iban);
        expect(transaction.recipient_iban).to.equal(mainAccount.iban);
      });

      it("should update data on the sub account and create a booking", () => {
        const account = business.accounts[0];
        expect(account.balance.value).to.equal(100);
        expect(account.available_balance.value).to.equal(100);

        const transaction = account.transactions.find(
          (t) => t.description === transfer.description
        );
        expect(transaction.amount.value).to.equal(-transfer.amount.value);
        expect(transaction.description).to.equal(transfer.description);
        expect(transaction.booking_type).to.equal(
          BookingType.INTRA_CUSTOMER_TRANSFER
        );
        expect(transaction.recipient_name).to.equal(business.name);
        expect(transaction.sender_name).to.equal(business.name);
        expect(transaction.sender_iban).to.equal(subAccount.iban);
        expect(transaction.recipient_iban).to.equal(mainAccount.iban);
      });

      it("should trigget 2 webhooks", () => {
        expect(triggerWebhookStub.calledTwice).to.be.true;

        expect([
          triggerWebhookStub.getCall(0).args[2],
          triggerWebhookStub.getCall(1).args[2],
        ]).to.have.members([subAccount.id, mainAccount.id]);
      });
    });
  });
});
