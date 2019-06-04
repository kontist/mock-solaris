const E2E_TESTS_ACCEPT_HEADER = 'application/vnd.kontist.e2e.json';

export const shouldReturnJSON = (req) => [E2E_TESTS_ACCEPT_HEADER].includes(req.headers.accept);
