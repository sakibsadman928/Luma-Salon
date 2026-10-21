import { getConfig } from '../config/env.js';

export function notFound(req, res) {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found.` } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let code = err.code || 'SERVER_ERROR';
  let message = err.message;
  if (err.name === 'ValidationError') { status = 400; code = 'VALIDATION'; message = Object.values(err.errors).map((e) => e.message).join(' '); }
  else if (err.name === 'CastError') { status = 400; code = 'INVALID_ID'; message = 'Invalid value supplied.'; }
  else if (err.type === 'entity.parse.failed') { status = 400; code = 'BAD_JSON'; message = 'Malformed JSON body.'; }
  else if (status === 500) {
    console.error(err);
    if (getConfig().isProduction) message = 'Something went wrong. Please try again.';
  }
  res.status(status).json({ success: false, error: { code, message } });
}
