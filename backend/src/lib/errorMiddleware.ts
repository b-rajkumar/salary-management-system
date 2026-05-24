import type { ErrorRequestHandler } from 'express';
import { AppError, InternalError } from './errors';

export const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  const error = err instanceof AppError ? err : new InternalError();
  if (!(err instanceof AppError)) {
    console.error('Unhandled error:', err);
  }
  res.status(error.status).json({
    error: {
      code: error.code,
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
    },
  });
};
