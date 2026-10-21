import { createApp } from './app.js';
import { connectDb } from './config/db.js';
import { getConfig } from './config/env.js';

const { port, staffPin, jwtSecret } = getConfig();
if (!staffPin || !jwtSecret) {
  console.error('STAFF_PIN and JWT_SECRET must be set in server/.env');
  process.exit(1);
}

try {
  await connectDb();
} catch (err) {
  console.error('Database connection failed:', err.message);
  process.exit(1);
}
createApp().listen(port, () => console.log(`Luma Salon API listening on port ${port}`));
