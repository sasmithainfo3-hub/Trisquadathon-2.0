import { config } from '../config/env.js';

export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  const message = err.message || 'An unexpected internal server error occurred.';

  console.error(`[SafePath Error] [${req.method}] ${req.originalUrl}:`, err);

  res.status(statusCode).json({
    success: false,
    message,
    ...(config.nodeEnv !== 'production' ? { stack: err.stack } : {})
  });
}
