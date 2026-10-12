import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type UserId = 'alice' | 'bob';
export type Trade = { id: number; owner_id: UserId; symbol: string; side: string; note: string };

export function createDb(path = ':memory:') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('CREATE TABLE IF NOT EXISTS trades (id INTEGER PRIMARY KEY, owner_id TEXT NOT NULL, symbol TEXT NOT NULL, side TEXT NOT NULL, note TEXT NOT NULL)');
  const insert = db.prepare('INSERT OR IGNORE INTO trades (id, owner_id, symbol, side, note) VALUES (?, ?, ?, ?, ?)');
  insert.run(101, 'alice', 'DEMO-ALPHA', 'Buy', 'Alice practiced a fictional entry plan.');
  insert.run(202, 'bob', 'DEMO-BETA', 'Sell', 'Bob recorded a fictional risk review.');
  return db;
}

export function ownTrades(db: DatabaseSync, owner: UserId): Trade[] {
  return db.prepare('SELECT id, owner_id, symbol, side, note FROM trades WHERE owner_id = ? ORDER BY id').all(owner) as Trade[];
}

export function ownedTrade(db: DatabaseSync, id: number, owner: UserId): Trade | undefined {
  return db.prepare('SELECT id, owner_id, symbol, side, note FROM trades WHERE id = ? AND owner_id = ?').get(id, owner) as Trade | undefined;
}
