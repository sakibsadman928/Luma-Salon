import { verify } from '../services/authService.js';
import { AppError } from '../utils/errors.js';

export function requireStaff(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new AppError(401, 'Staff login required.', 'UNAUTHENTICATED'));
  try {
    req.staff = verify(token);
    next();
  } catch {
    next(new AppError(401, 'Session expired or invalid. Please log in again.', 'UNAUTHENTICATED'));
  }
}
