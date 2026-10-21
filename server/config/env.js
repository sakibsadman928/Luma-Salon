import dotenv from 'dotenv';
dotenv.config();

// Read lazily so tests can change process.env before use.
export function getConfig() {
  return {
    port: Number(process.env.PORT) || 5000,
    mongoUri: process.env.MONGODB_URI || '',
    staffPin: process.env.STAFF_PIN || '',
    jwtSecret: process.env.JWT_SECRET || '',
    timezone: process.env.SALON_TIMEZONE || 'Asia/Dhaka',
    clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    isProduction: process.env.NODE_ENV === 'production',
    avgServiceMinutes: 10,
    salonName: 'Luma Salon',
  };
}
