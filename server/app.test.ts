import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createDb } from './db.js';
import { createApp } from './app.js';

const login = async (app: ReturnType<typeof createApp>, user: 'alice' | 'bob') => {
  const response = await request(app).post('/api/login').send({ user, password: `${user}-demo` });
  expect(response.status).toBe(200);
  return response.headers['set-cookie'][0].split(';')[0] as string;
};

describe('real API authorization', () => {
  it('rejects anonymous access and invalid credentials', async () => {
    const app = createApp(createDb());
    expect((await request(app).get('/api/trades/101')).status).toBe(401);
    expect((await request(app).post('/api/login').send({ user: 'alice', password: 'wrong' })).status).toBe(401);
  });
  it('shows only owned records and conceals another user record', async () => {
    const app = createApp(createDb());
    const alice = await login(app, 'alice');
    const bob = await login(app, 'bob');
    expect((await request(app).get('/api/trades').set('Cookie', alice)).body.trades.map((t: { id: number }) => t.id)).toEqual([101]);
    expect((await request(app).get('/api/trades/101').set('Cookie', alice)).status).toBe(200);
    expect((await request(app).get('/api/trades/202').set('Cookie', alice)).status).toBe(404);
    expect((await request(app).get('/api/trades/101').set('Cookie', bob)).status).toBe(404);
    expect((await request(app).get('/api/trades/202').set('Cookie', bob)).status).toBe(200);
  });
  it('expires sessions and revokes them on logout', async () => {
    let time = 1000;
    const app = createApp(createDb(), { ttlMs: 1000, now: () => time });
    const alice = await login(app, 'alice');
    expect((await request(app).get('/api/session').set('Cookie', alice)).status).toBe(200);
    time = 2000;
    expect((await request(app).get('/api/session').set('Cookie', alice)).status).toBe(401);
    const next = await login(app, 'alice');
    await request(app).post('/api/logout').set('Cookie', next);
    expect((await request(app).get('/api/trades').set('Cookie', next)).status).toBe(401);
  });
  it('validates input and blocks unknown origins', async () => {
    const app = createApp(createDb());
    const alice = await login(app, 'alice');
    expect((await request(app).get('/api/trades/nope').set('Cookie', alice)).status).toBe(400);
    expect((await request(app).post('/api/notes/preview').set('Cookie', alice).send({ note: '' })).status).toBe(400);
    expect((await request(app).get('/api/health').set('Origin', 'https://example.com')).status).toBe(403);
  });
  it('revokes a demo session on demand for the expiry lesson', async () => {
    const app = createApp(createDb());
    const alice = await login(app, 'alice');
    expect((await request(app).post('/api/session/expire').set('Cookie', alice)).status).toBe(200);
    expect((await request(app).get('/api/trades/101').set('Cookie', alice)).status).toBe(401);
  });
});
