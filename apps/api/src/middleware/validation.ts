import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';

export const validate = <T>(schema: ZodSchema<T>): RequestHandler => {
  return (req, _res, next) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query
    });

    if (!result.success) {
      return next(result.error);
    }

    const { body, params, query } = result.data as {
      body: typeof req.body;
      params: typeof req.params;
      query: typeof req.query;
    };

    req.body = body;
    req.params = params;
    req.query = query;

    return next();
  };
};
