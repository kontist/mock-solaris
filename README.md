# mocksolaris server

A super minimal, unsupported and error prone mock implementation of Solaris' backend

## Usage for exploring

### Run this on your development machine

If your containers are up and running, local `mocksolaris` should be accessible at [http://localhost:2091/\_\_BACKOFFICE\_\_/](http://localhost:2091/__BACKOFFICE__/).

### Persons and accounts

Navigate to the URL mentioned above. From there you can send simple, random transaction(s) to your test account.

### Wire Transfers

From the app, you can request an outgoing wire transfer as you normally would.

You can use `111111` as the 6-digit TAN.

Then, you can click on the `Send` button next to the `Pending wire transfer` text.

You should now no longer see the transaction as "pending" and be able to click it to see its individual transaction screen.

## Usage for staging

There is a deployment of this service at [https://staging-mocksolaris.konto.io/\_\_BACKOFFICE\_\_/](https://staging-mocksolaris.konto.io/__BACKOFFICE__/) that is connected to the staging backend and the staging version of the app.

## Usage for integration tests

In addition to the use via the web interface, the software in here is also used
for integration tests.

In file
```
https://github.com/figureaps/figure-backend/blob/develop/test/mocha/integration/setup.test.js
```
