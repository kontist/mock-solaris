const JSON_HEADER = "application/json";

export const shouldReturnJSON = req => req.headers.accept === JSON_HEADER;
