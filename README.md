# Solaris Mock Server

A super minimal implementation of the Solaris backend.

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

## Backoffice screenshots

![User setup](https://github.com/kontist/mock-solaris/blob/assets/individual-user.png)

### Persons and accounts

Navigate to the URL mentioned above. From there you can send simple, random transaction(s) to your test account.

To add further persons, please have a look at the `savePerson` method.

### Scope
This mock service currently supports (at different extents)
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

MOCKWIRECARD_BASE_URL=http://mock-wirecard:2943

WIRECARD_IBAN=DE86512308009999837809
KONTIST_IBAN=DE58110101002263909949
KONTIST_DD_BILLING_IBAN=DE31110101002781508546

JOBS_USERNAME=jobuser
JOBS_PASSWORD=jobpassword
```

## Usage in tests


## Contribute