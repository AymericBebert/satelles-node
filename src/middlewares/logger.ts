import express from 'express';
import {NextFunction} from 'express-serve-static-core';

export const loggerMiddleware = (request: express.Request, response: express.Response, next: NextFunction): void => {
    console.log(`${request.method}`
        + ` - ${request.path}`
        + ` - query ${JSON.stringify(request.query)}`
        + ` - body ${JSON.stringify(request.body)}`
        + '');
    next();
};
