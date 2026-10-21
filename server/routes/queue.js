import { Router } from 'express';
import { asyncHandler as h } from '../utils/errors.js';
import { requireStaff } from '../middleware/auth.js';
import * as c from '../controllers/queueController.js';

const r = Router();

// Public, read-only (no customer names)
r.get('/public', h(c.publicQueue));
r.get('/public/:tokenNumber', h(c.publicToken));

// Staff only
r.use(requireStaff);
r.get('/today', h(c.today));
r.post('/walk-ins', h(c.walkIn));
r.post('/appointments', h(c.appointment));
r.post('/call-next', h(c.callNext));
r.post('/:id/check-in', h(c.checkIn));
r.post('/:id/start', h(c.start));
r.post('/:id/complete', h(c.complete));
r.post('/:id/cancel', h(c.cancel));

export default r;
