/**
 * Minimal stand-ins for the two Cloudflare bindings the API uses, so the exact
 * same route code runs on a plain Node server (Oracle Cloud, Riyadh):
 *   - D1Database  → node:sqlite (built into Node 22+, no native build)
 *   - KVNamespace → files on disk (one file per photo + a small .json sidecar)
 * Only the methods the code base actually calls are implemented.
 */
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';

type Param = string | number | bigint | null | Uint8Array;

const toParam = (v: unknown): Param => {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'bigint') return v;
  if (v instanceof Uint8Array) return v;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  return String(v);
};

class Stmt {
  constructor(private db: DatabaseSync, private sql: string, private params: Param[] = []) {}
  private prepared(): StatementSync { return this.db.prepare(this.sql); }
  bind(...args: unknown[]) { return new Stmt(this.db, this.sql, args.map(toParam)); }
  async first<T = any>(col?: string): Promise<T | null> {
    const row = this.prepared().get(...this.params) as any;
    if (!row) return null;
    return (col ? row[col] : { ...row }) as T;
  }
  async all<T = any>() {
    const rows = this.prepared().all(...this.params) as any[];
    return { results: rows.map((r) => ({ ...r })) as T[], success: true, meta: {} };
  }
  async run() {
    const r = this.prepared().run(...this.params);
    return { success: true, results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
  /** used by batch(): executes synchronously inside the surrounding transaction */
  runSync() {
    if (/^\s*(SELECT|WITH|PRAGMA)\b/i.test(this.sql) || /\bRETURNING\b/i.test(this.sql)) {
      const rows = this.prepared().all(...this.params) as any[];
      return { success: true, results: rows.map((r) => ({ ...r })), meta: { changes: 0, last_row_id: 0 } };
    }
    const r = this.prepared().run(...this.params);
    return { success: true, results: [] as any[], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
}

export class SqliteD1 {
  readonly db: DatabaseSync;
  constructor(file: string) {
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  }
  prepare(sql: string) { return new Stmt(this.db, sql); }
  /** D1 batches are atomic — mirror that with a transaction. */
  async batch(stmts: Stmt[]) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const out = stmts.map((s) => s.runSync());
      this.db.exec('COMMIT');
      return out;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  async exec(sql: string) { this.db.exec(sql); return { count: 0, duration: 0 }; }
}

/** Applies migrations/*.sql once each, in name order, tracked in _migrations. */
export function migrate(d1: SqliteD1, files: { name: string; sql: string }[]) {
  d1.db.exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const done = new Set((d1.db.prepare('SELECT name FROM _migrations').all() as any[]).map((r) => r.name));
  for (const f of files.sort((a, b) => a.name.localeCompare(b.name))) {
    if (done.has(f.name)) continue;
    d1.db.exec('BEGIN');
    try {
      d1.db.exec(f.sql);
      d1.db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(f.name, new Date().toISOString());
      d1.db.exec('COMMIT');
      console.log(`[db] applied migration ${f.name}`);
    } catch (e) {
      d1.db.exec('ROLLBACK');
      throw e;
    }
  }
}

const SAFE_KEY = /^[A-Za-z0-9_.-]+$/;

export class DiskKV {
  constructor(private dir: string) { mkdirSync(dir, { recursive: true }); }
  private path(key: string) {
    if (!SAFE_KEY.test(key)) throw new Error('Invalid storage key');
    return join(this.dir, key);
  }
  async put(key: string, value: ArrayBuffer | Uint8Array | string, opts?: { metadata?: unknown }) {
    const p = this.path(key);
    const bytes = typeof value === 'string' ? Buffer.from(value) : Buffer.from(value instanceof Uint8Array ? value : new Uint8Array(value));
    writeFileSync(p + '.tmp', bytes);
    renameSync(p + '.tmp', p);
    writeFileSync(p + '.json', JSON.stringify(opts?.metadata ?? null));
  }
  async getWithMetadata<M = unknown>(key: string, _opts?: unknown): Promise<{ value: ArrayBuffer | null; metadata: M | null }> {
    const p = this.path(key);
    if (!existsSync(p)) return { value: null, metadata: null };
    const buf = readFileSync(p);
    let metadata: M | null = null;
    try { metadata = JSON.parse(readFileSync(p + '.json', 'utf8')); } catch { /* none */ }
    return { value: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, metadata };
  }
  async delete(key: string) {
    const p = this.path(key);
    rmSync(p, { force: true });
    rmSync(p + '.json', { force: true });
  }
}
