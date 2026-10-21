import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { getConfig } from './config/env.js';
import authRoutes from './routes/auth.js';
import queueRoutes from './routes/queue.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  const { clientOrigins } = getConfig();
  app.use(cors({
    origin: (origin, cb) => cb(null, !origin || clientOrigins.includes(origin)),
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  app.use(express.json({ limit: '10kb' }));

  app.get('/api/health', (req, res) =>
    res.json({ success: true, data: { status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' } })
  );
  app.use('/api/auth', authRoutes);
  app.use('/api/queue', queueRoutes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
