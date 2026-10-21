import * as q from '../services/queueService.js';

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

export const publicQueue = async (req, res) => ok(res, await q.getPublicQueue());
export const publicToken = async (req, res) => ok(res, await q.getPublicToken(req.params.tokenNumber));
export const today = async (req, res) => ok(res, await q.getTodayQueue());
export const walkIn = async (req, res) => ok(res, await q.registerWalkIn(req.body || {}), 201);
export const appointment = async (req, res) => ok(res, await q.registerAppointment(req.body || {}), 201);
export const callNext = async (req, res) => ok(res, await q.callNext());
export const checkIn = async (req, res) => ok(res, await q.checkIn(req.params.id));
export const start = async (req, res) => ok(res, await q.startService(req.params.id));
export const complete = async (req, res) => ok(res, await q.completeService(req.params.id));
export const cancel = async (req, res) => ok(res, await q.cancelBooking(req.params.id));
