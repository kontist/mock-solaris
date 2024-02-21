# Solaris Mock Server

A super minimal implementation of the Solaris backend.

## Usage

### Running with hot reloading enabled

You need two terminal sessions:

1. `npm run build:hot` (1st terminal session)
2. Optionally (if you haven't built before): `npm run build:docker` (2nd terminal session)
3. `npm run start:docker` (2nd terminal session)
4. Enjoy. You may now access the backoffice at [http://localhost:2091/\_\_BACKOFFICE\_\_/](http://localhost:2091/__BACKOFFICE__/).

### Running tests

1. `npm run start:mockredis` Starts mock redis instance
2. `npm run test` Runs tests

### Example request

```
curl TODO
```

## Backoffice screenshots

![mockSolarisPerson](https://user-images.githubusercontent.com/47757191/189340823-2b200e6f-5068-4a32-8936-9b7b4d7ae38e.png)

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
- Customer Due Diligence
- ...

### TAN

For device binding, you can use any combination as the 6-digit TAN (it is not actually verified).

For other TAN confirmation (Change Requests, Transfer confirmation, etc.), you can find the 6-digit code on your user's UI:
![TAN](https://github.com/kontist/mock-solaris/blob/assets/tan.png)

### Onboarding a person - Customer due diligence (CDD)

A successfully onboarded person must have "green" values for screening values.
You can set screening values from the "Person data" section ([More info](https://docs.solarisbank.com/guides/get-started/digital-banking/onboard-person/#customer-due-diligence-cdd))

<img width="532" alt="Screen Shot 2022-07-18 at 11 38 55 AM" src="https://user-images.githubusercontent.com/6367201/179475427-58af2c02-b229-4cab-96a2-089f45356e60.png">

### Seizure Protection

When querying the balance for P-konto accounts, you will get a `seizure_protection` object as stated in this [API](https://docs.solarisgroup.com/api-reference/digital-banking/account-management/#tag/Accounts/paths/~1v1~1accounts~1{account_id}~1balance/get). Since solaris does not support changing an account to P-konto; we mocked the existence of seizure protection.

You can modify the values of seizure protection in this section:

![seizure-protection](https://user-images.githubusercontent.com/47757191/189342102-a69a6a30-bc25-4fc1-bf9a-ba6ee45a76ff.png)

You can also delete the object afterwards:

![allow-delete-seizure-protection](https://user-images.githubusercontent.com/47757191/189342305-284ebf13-af56-4166-b71a-8591eea0f82a.png)

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

## Publishing New Version

Create a branch that doesn't have the same name as the tag e.g. NOT v1.0.120

```
git checkout version-<some_version>
```

Increase the version

```
npm version <some_version>
```

Push the changes with tags

```
git push --follow-tags
```
