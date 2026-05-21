import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { AppError, isAppError } from '../utils/app-error.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  logger.error({ err, req: { method: req.method, url: req.url } });

  if (isAppError(err)) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  // Don't expose internal errors to clients
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}
