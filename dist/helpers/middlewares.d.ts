import * as express from "express";
import { MockPerson } from "./types";
export declare type RequestWithPerson = express.Request & {
    person?: MockPerson;
};
export declare const withPerson: (req: RequestWithPerson, res: express.Response, next: express.NextFunction) => Promise<void>;
