import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, scrypt as derive, timingSafeEqual, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { promisify } from 'node:util';
const scrypt = promisify(derive);
export const now = () => Date.now();
export const day = 86400000;
export const uuid = randomUUID;
export const digest = v => createHash('sha256').update(v).digest('hex');
export const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
export const cleanState = () => ({ profile: null, profileVersion: 0, faceId: null, cart: [], messages: [], conversationId: uuid() });
export async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return salt + ':' + (await scrypt(password, salt, 64)).toString('hex');
}
export async function checkPassword(password, stored) {
  const [salt] = (stored || '0'.repeat(32)).split(':');
  const encoded = await hashPassword(password, salt);
  return Boolean(stored) && timingSafeEqual(Buffer.from(stored), Buffer.from(encoded));
}
export function createStore(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY,owner TEXT NOT NULL,user_id TEXT,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS states (owner TEXT PRIMARY KEY, value TEXT NOT NULL, updated INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY,owner TEXT NOT NULL,kind TEXT NOT NULL,data BLOB NOT NULL,hash TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS media_exp ON media(expires);
    CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY,owner TEXT NOT NULL,type TEXT NOT NULL,cache_key TEXT NOT NULL,status TEXT NOT NULL,payload TEXT NOT NULL,created INTEGER NOT NULL,expires INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS jobs_cache ON jobs(owner,type,cache_key,created);
    CREATE TABLE IF NOT EXISTS usage (date TEXT PRIMARY KEY,count INTEGER NOT NULL);`);
  const get = (sql,...params) => db.prepare(sql).get(...params);
  const all = (sql,...params) => db.prepare(sql).all(...params);
  const run = (sql,...params) => db.prepare(sql).run(...params);
  const txn = fn => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (e) { db.exec('ROLLBACK'); throw e; }
  };
  const state = owner => {
    const row = get('SELECT value FROM states WHERE owner=?',owner);
    if (row) return JSON.parse(row.value);
    const value = cleanState(); put(owner,value); return value;
  };
  const put = (owner,value) => run('INSERT INTO states VALUES (?,?,?) ON CONFLICT(owner) DO UPDATE SET value=excluded.value, updated=excluded.updated',owner,JSON.stringify(value),now());
  const sweep = () => txn(() => {
    run('DELETE FROM sessions WHERE expires<=?',now());
    run("DELETE FROM states WHERE owner LIKE 'g:%' AND owner NOT IN (SELECT owner FROM sessions)");
    run('DELETE FROM media WHERE expires<=?',now());
    run('DELETE FROM jobs WHERE expires<=?',now());
  });
  return { db, get, all, run, txn, state, put, sweep };
}
