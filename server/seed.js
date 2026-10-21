// Development seed. Usage: npm run seed
// Replaces ONLY today's queue data. Refuses to run when NODE_ENV=production.
import mongoose from 'mongoose';
import { connectDb } from './config/db.js';
import { getConfig } from './config/env.js';
import QueueEntry from './models/QueueEntry.js';
import DailyCounter from './models/DailyCounter.js';
import ActiveService from './models/ActiveService.js';
import { getOperatingDate } from './utils/time.js';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed in production.');
  process.exit(1);
}
await connectDb();
const { timezone } = getConfig();
const now = new Date();
const date = getOperatingDate(now, timezone);
const min = (m) => new Date(now.getTime() + m * 60000);

await QueueEntry.deleteMany({ operatingDate: date });
await DailyCounter.deleteMany({ operatingDate: date });
await ActiveService.deleteMany({ operatingDate: date });

const rows = [
  { customerName: 'Aria Chowdhury', bookingType: 'WALK_IN', checkedInAt: min(-50), status: 'COMPLETED', calledAt: min(-48), serviceStartedAt: min(-47), completedAt: min(-38) },
  { customerName: 'Rafi Ahmed', bookingType: 'WALK_IN', checkedInAt: min(-30), status: 'IN_SERVICE', calledAt: min(-6), serviceStartedAt: min(-5) },
  { customerName: 'Nusrat Jahan', bookingType: 'WALK_IN', checkedInAt: min(-25) },
  { customerName: 'Tanvir Hasan', bookingType: 'WALK_IN', checkedInAt: min(-20) },
  { customerName: 'Meher Sultana', bookingType: 'APPOINTMENT', checkedInAt: min(-90), scheduledAt: min(90), isPresent: false }, // future
  { customerName: 'Sabbir Khan', bookingType: 'APPOINTMENT', checkedInAt: min(-60), scheduledAt: min(-3), isPresent: true, arrivedAt: min(-10) }, // due + present
  { customerName: 'Farhana Islam', bookingType: 'APPOINTMENT', checkedInAt: min(-90), scheduledAt: min(-20), isPresent: false }, // overdue, not cancelled
];
const created = [];
for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  created.push(await QueueEntry.create({
    isPresent: true, arrivedAt: r.checkedInAt, ...r, operatingDate: date, tokenNumber: `L${String(i + 1).padStart(3, '0')}`,
  }));
}
await DailyCounter.create({ operatingDate: date, lastTokenNumber: rows.length });
await ActiveService.create({ _id: `active:${date}`, operatingDate: date, entryId: created[1]._id });

console.log(`Seeded ${rows.length} entries for ${date}.`);
await mongoose.disconnect();
