#!/usr/bin/env node
/**
 * One-command Cloudflare deploy, safe to re-run.
 * Used as the "Deploy command" in Cloudflare Workers Builds (GitHub → Cloudflare),
 * and works the same from a laptop after `npx wrangler login`.
 *
 *  1. Finds or creates the D1 database "artisan-kitchen" and the KV namespace
 *     "artisan-kitchen-images", and writes their IDs into wrangler.jsonc.
 *  2. Applies any pending D1 migrations.
 *  3. Deploys the Worker (API + built web app).
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const DB_NAME = 'artisan-kitchen';
const KV_TITLE = 'artisan-kitchen-images';
const CONFIG = 'wrangler.jsonc';

const run = (cmd, opts = {}) => {
  console.log(`\n$ ${cmd}`);
  return execSync(cmd, { encoding: 'utf8', stdio: opts.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit', env: { ...process.env, CI: 'true' } });
};
const json = (cmd) => {
  const out = run(cmd, { capture: true });
  const start = out.search(/[[{]/);
  return JSON.parse(out.slice(start));
};

let cfg = readFileSync(CONFIG, 'utf8');

if (cfg.includes('REPLACE_WITH_YOUR_D1_ID')) {
  let db = json('npx wrangler d1 list --json').find((d) => d.name === DB_NAME);
  if (!db) {
    const out = run(`npx wrangler d1 create ${DB_NAME}`, { capture: true });
    const id = out.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
    if (!id) throw new Error('Could not read the new D1 database id:\n' + out);
    db = { uuid: id };
  }
  cfg = cfg.replace('REPLACE_WITH_YOUR_D1_ID', db.uuid);
  console.log(`D1 database: ${db.uuid}`);
}

if (cfg.includes('REPLACE_WITH_YOUR_KV_ID')) {
  let ns = json('npx wrangler kv namespace list').find((n) => n.title === KV_TITLE || n.title.endsWith(KV_TITLE));
  if (!ns) {
    const out = run(`npx wrangler kv namespace create ${KV_TITLE}`, { capture: true });
    const id = out.match(/[0-9a-f]{32}/i)?.[0];
    if (!id) throw new Error('Could not read the new KV namespace id:\n' + out);
    ns = { id };
  }
  cfg = cfg.replace('REPLACE_WITH_YOUR_KV_ID', ns.id);
  console.log(`KV namespace: ${ns.id}`);
}

writeFileSync(CONFIG, cfg);
run(`npx wrangler d1 migrations apply ${DB_NAME} --remote`);
run('npx wrangler deploy');
