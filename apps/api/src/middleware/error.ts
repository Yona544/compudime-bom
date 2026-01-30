import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'ValidationError',
      details: err.errors
    });
  }

  const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
  const message = typeof err?.message === 'string' ? err.message : 'Internal Server Error';

  return res.status(status).json({ error: message });
};
