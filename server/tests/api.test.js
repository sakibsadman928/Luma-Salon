import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { connectTestDb, clearDb, disconnectTestDb, setNow } from './helpers.js';
import { createApp } from '../app.js';

let app;
let auth;
beforeAll(async () => { await connectTestDb(); app = createApp(); });
afterAll(disconnectTestDb);
beforeEach(async () => {
  await clearDb();
  setNow('10:00');
  const res = await request(app).post('/api/auth/login').send({ pin: '4321' });
  auth = { Authorization: `Bearer ${res.body.data.token}` };
});

describe('Auth & access control', () => {
  it('21. staff endpoints reject unauthenticated requests', async () => {
    const calls = [
      request(app).get('/api/queue/today'),
      request(app).post('/api/queue/walk-ins').send({ customerName: 'X' }),
      request(app).post('/api/queue/appointments').send({}),
      request(app).post('/api/queue/call-next'),
      request(app).post('/api/queue/507f1f77bcf86cd799439011/complete'),
      request(app).post('/api/queue/507f1f77bcf86cd799439011/cancel'),
      request(app).get('/api/queue/today').set('Authorization', 'Bearer garbage'),
    ];
    for (const r of await Promise.all(calls)) expect(r.status).toBe(401);
  });

  it('rejects a wrong PIN, never echoes the PIN, and logout invalidates the token', async () => {
    const bad = await request(app).post('/api/auth/login').send({ pin: '0000' });
    expect(bad.status).toBe(401);
    const good = await request(app).post('/api/auth/login').send({ pin: '4321' });
    expect(JSON.stringify(good.body)).not.toContain('4321');
    const header = { Authorization: `Bearer ${good.body.data.token}` };
    expect((await request(app).get('/api/queue/today').set(header)).status).toBe(200);
    await request(app).post('/api/auth/logout').set(header);
    expect((await request(app).get('/api/queue/today').set(header)).status).toBe(401);
  });
});

describe('Public endpoint privacy', () => {
  it('20. never exposes customer names or internal fields', async () => {
    await request(app).post('/api/queue/walk-ins').set(auth).send({ customerName: 'Zaynab Secretname' });
    await request(app).post('/api/queue/appointments').set(auth).send({ customerName: 'Hidden Person', scheduledTime: '11:00' });
    const pub = await request(app).get('/api/queue/public');
    expect(pub.status).toBe(200);
    const text = JSON.stringify(pub.body);
    expect(text).not.toContain('Secretname');
    expect(text).not.toContain('Hidden');
    expect(text).not.toContain('customerName');
    expect(pub.body.data.queue).toHaveLength(2);
    const one = await request(app).get('/api/queue/public/l001');
    expect(one.status).toBe(200);
    expect(JSON.stringify(one.body)).not.toContain('Secretname');
    const staff = await request(app).get('/api/queue/today').set(auth);
    expect(JSON.stringify(staff.body)).toContain('Zaynab Secretname');
  });
});

describe('API flow & error handling', () => {
  it('full flow with proper status codes', async () => {
    const w = await request(app).post('/api/queue/walk-ins').set(auth).send({ customerName: 'Aria' });
    expect(w.status).toBe(201);
    expect((await request(app).post('/api/queue/walk-ins').set(auth).send({ customerName: ' ' })).status).toBe(400);
    expect((await request(app).post('/api/queue/not-an-id/cancel').set(auth)).status).toBe(400);
    expect((await request(app).post('/api/queue/507f1f77bcf86cd799439011/cancel').set(auth)).status).toBe(404);
    const call = await request(app).post('/api/queue/call-next').set(auth);
    expect(call.status).toBe(200);
    const again = await request(app).post('/api/queue/call-next').set(auth);
    expect(again.status).toBe(409);
    const done = await request(app).post(`/api/queue/${call.body.data.id}/complete`).set(auth);
    expect(done.body.data.status).toBe('COMPLETED');
    expect((await request(app).post('/api/queue/call-next').set(auth)).status).toBe(404);
  });
});
