import express, { type Request, type Response, type NextFunction } from 'express';
import { randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { ownTrades, ownedTrade, type UserId } from './db.js';

const credentials = { alice: 'alice-demo', bob: 'bob-demo' } as const;
const loginSchema = z.object({ user: z.enum(['alice', 'bob']), password: z.string().max(80) });
const noteSchema = z.object({ note: z.string().trim().min(1).max(120) });
type Session = { user: UserId; expires: number };

export function createApp(db: DatabaseSync, options: { ttlMs?: number; now?: () => number } = {}) {
  const app = express();
  const sessions = new Map<string, Session>();
  const attempts = new Map<string, { count: number; reset: number }>();
  const now = options.now ?? Date.now;
  const ttl = options.ttlMs ?? 15 * 60_000;
  app.disable('x-powered-by');
  app.use(express.json({ limit: '4kb' }));
  app.use((_req, res, next) => {
    res.set({ 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'", 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' });
    next();
  });
  app.use('/api', (req, res, next) => {
    const origin = req.get('origin');
    if (origin && !['http://127.0.0.1:5173', 'http://localhost:5173'].includes(origin)) { res.status(403).json({ error: 'Origin not allowed' }); return; }
    next();
  });
  const cookie = (req: Request) => req.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith('lab_session='))?.slice(12);
  const currentUser = (req: Request): UserId | undefined => {
    const token = cookie(req);
    if (!token) return undefined;
    const session = sessions.get(token);
    if (!session) return undefined;
    if (session.expires <= now()) { sessions.delete(token); return undefined; }
    return session.user;
  };
  const requireUser = (req: Request, res: Response, next: NextFunction) => {
    const user = currentUser(req);
    if (!user) { res.status(401).json({ error: 'Sign in to the local demo first.' }); return; }
    res.locals.user = user;
    next();
  };
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', mode: 'local-simulation' }));
  app.post('/api/login', (req, res) => {
    const key = req.ip ?? 'local';
    const rate = attempts.get(key) ?? { count: 0, reset: now() + 60_000 };
    if (now() >= rate.reset) { rate.count = 0; rate.reset = now() + 60_000; }
    if (++rate.count > 10) { attempts.set(key, rate); res.status(429).json({ error: 'Try again in one minute.' }); return; }
    attempts.set(key, rate);
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success || credentials[parsed.data.user] !== parsed.data.password) { res.status(401).json({ error: 'Demo sign-in failed.' }); return; }
    const token = randomBytes(32).toString('hex');
    sessions.set(token, { user: parsed.data.user, expires: now() + ttl });
    res.cookie('lab_session', token, { httpOnly: true, sameSite: 'strict', secure: false, maxAge: ttl, path: '/' });
    res.json({ user: parsed.data.user, expiresInSeconds: Math.floor(ttl / 1000) });
  });
  app.get('/api/session', (req, res) => {
    const user = currentUser(req);
    if (!user) { res.status(401).json({ error: 'No active demo session.' }); return; }
    res.json({ user });
  });
  app.post('/api/logout', (req, res) => {
    const token = cookie(req);
    if (token) sessions.delete(token);
    res.clearCookie('lab_session', { path: '/' });
    res.json({ ok: true });
  });
  app.post('/api/session/expire', requireUser, (req, res) => {
    const token = cookie(req);
    if (token) sessions.delete(token);
    res.clearCookie('lab_session', { path: '/' });
    res.json({ expired: true, lesson: 'An expired session can no longer read private records.' });
  });
  app.get('/api/trades', requireUser, (_req, res) => res.json({ trades: ownTrades(db, res.locals.user as UserId) }));
  app.get('/api/trades/:id', requireUser, (req, res) => {
    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    if (!id.success) { res.status(400).json({ error: 'Invalid trade ID.' }); return; }
    const trade = ownedTrade(db, id.data, res.locals.user as UserId);
    if (!trade) { res.status(404).json({ error: 'Trade not found in your records.' }); return; }
    res.json({ trade });
  });
  app.post('/api/notes/preview', requireUser, (req, res) => {
    const parsed = noteSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Note must be 1–120 characters.' }); return; }
    res.json({ note: parsed.data.note, renderedAs: 'text' });
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Demo route not found.' }));
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Local API error:', error instanceof Error ? error.message : 'unknown');
    res.status(500).json({ error: 'Local demo error.' });
  });
  return app;
}
