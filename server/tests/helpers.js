import mongoose from 'mongoose';
import { setClock, resetClock } from '../utils/clock.js';

let mem = null;
process.env.STAFF_PIN = '4321';
process.env.JWT_SECRET = 'test-secret';
process.env.SALON_TIMEZONE = 'Asia/Dhaka';

export const DAY = '2026-03-10';
// Wall-clock time in Asia/Dhaka (UTC+6) on a given day.
export const at = (hhmm, day = DAY) => new Date(`${day}T${hhmm}:00+06:00`);
export const setNow = (hhmm, day = DAY) => setClock(() => at(hhmm, day));

export async function connectTestDb() {
  let uri = process.env.TEST_MONGO_URI; // optional: point at any MongoDB-compatible server
  if (!uri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    mem = await MongoMemoryServer.create();
    uri = mem.getUri();
  }
  await mongoose.connect(uri, { dbName: 'luma_test' });
  await import('../models/QueueEntry.js');
  await import('../models/DailyCounter.js');
  await import('../models/ActiveService.js');
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
}
export async function clearDb() {
  await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
}
export async function disconnectTestDb() {
  resetClock();
  await mongoose.disconnect();
  if (mem) await mem.stop();
}
