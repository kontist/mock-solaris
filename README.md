# Solaris Mock Server

A super minimal implementation of the Solaris backend.

## Usage

### Running with hot reloading enabled

You need two terminal sessions:

1. `npm run build:hot` (1st terminal session)
2. Optionally (if you haven't built before): `npm run build:docker` (2nd terminal session)
3. `npm run start:docker` (2nd terminal session)
4. Enjoy. You may now access the backoffice at [http://localhost:2091/\_\_BACKOFFICE\_\_/](http://localhost:2091/__BACKOFFICE__/).

### Example request

```
curl TODO
```

## Backoffice screenshots

![User setup](https://github.com/kontist/mock-solaris/blob/assets/individual-user.png)

### Persons and accounts

Navigate to the URL mentioned above. From there you can send simple, random transaction(s) to your test account.

To add further persons, please have a look at the `savePerson` method.

### Scope

This mock service currently supports (at different extents)

- Accounts
- Statements
- Transfers (incl. Batch Transfers, Timed Orders and Standing Orders)
- Change Requests
- Cards
- Device Binding
- Overdraft
- Seizures
- Direct Debit Returns
- Webhooks
- ...

### TAN

For device binding, you can use any combination as the 6-digit TAN (it is not actually verified).

For other TAN confirmation (Change Requests, Transfer confirmation, etc.), you can find the 6-digit code on your user's UI:
![TAN](https://github.com/kontist/mock-solaris/blob/assets/tan.png)

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

KONTIST_IBAN=DE01110101000000000000
KONTIST_DD_BILLING_IBAN=DE02110101000000000000

JOBS_USERNAME=jobuser
JOBS_PASSWORD=jobpassword
```

## Usage in tests

## Contribute
