# Solaris Mock Server

A super minimal implementation of the Solaris backend.

## Screenshots

![Start page](https://github.com/kontist/mock-solaris/blob/assets/start.png)
![User setup](https://github.com/kontist/mock-solaris/blob/assets/individual-user.png)

## Usage

### Build and run

```
docker build -t mocksolaris .
docker run -p 127.0.0.1:2091:2091 mocksolaris
```

You may now access the backoffice at [http://localhost:2091/\_\_BACKOFFICE\_\_/](http://localhost:2091/__BACKOFFICE__/).

### Example request

```
curl TODO
```

### Persons and accounts

Navigate to the URL mentioned above. From there you can send simple, random transaction(s) to your test account.

To add further persons, please have a look at the `savePerson` method.

### Scope
This mock service currently supports (at different extends)
* Accounts
* Statements
* Transfers (incl. Batch Transfers, Timed Orders and Standing Orders)
* Change Requests
* Cards
* Device Binding
* Overdraft
* Seizures
* Direct Debit Returns
* Webhooks
* ...

### TAN
You can use `111111` as the 6-digit TAN.

## Configuration
### Enable Redis

### Reference
The following environment variables are supported:
```
SOLARIS_CLIENT_ID=...
SOLARIS_CLIENT_SECRET=...
SOLARIS_CARD_AUTHORIZATION_WEBHOOK_ORIGIN_VERIFICATION_SECRET=...
SOLARIS_OVERDRAFT_APPLICATION_WEBHOOK_ORIGIN_VERIFICATION_SECRET=...
SOLARIS_BIC=SOBKDEBBXXX

MOCKSOLARIS_REDIS_PREFIX=mocksolaris
MOCKSOLARIS_REDIS_SERVER=redis://:pwd@mocks-redis/

SOLARIS_KONTIST_ACCOUNT_ID=mockaccount_id
SOLARIS_KONTIST_ACCOUNT_CLIENT_ID=...
SOLARIS_KONTIST_ACCOUNT_CLIENT_SECRET=...
SOLARIS_KONTIST_BILLING_ACCOUNT_ID=mockaccount_billing_id

MOCKWIRECARD_BASE_URL=http://mock-wirecard:2943

WIRECARD_IBAN=DE00512308000000000000
KONTIST_IBAN=DE01110101000000000000
KONTIST_DD_BILLING_IBAN=DE02110101000000000000

JOBS_USERNAME=jobuser
JOBS_PASSWORD=jobpassword
```

## Usage in tests


## Contribute