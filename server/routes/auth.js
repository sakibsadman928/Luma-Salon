import { Router } from 'express';
import { asyncHandler } from '../utils/errors.js';
import { requireStaff } from '../middleware/auth.js';
import * as c from '../controllers/authController.js';

const r = Router();
r.post('/login', asyncHandler(c.login));
r.post('/logout', requireStaff, asyncHandler(c.logout));
export default r;
