#!/usr/bin/env node
/**
 * Runs a .sql file against a Supabase project via the Management API.
 *
 * Reads SUPABASE_ACCESS_TOKEN from .env (falling back to ~/.supabase-token), so the
 * token never appears on a command line, in shell history, or in a process listing.
 *
 * READ-ONLY BY DEFAULT. Anything that isn't a bare SELECT is refused unless you
 * pass --allow-write, so running a diagnostic can never modify the database by
 * accident.
 *
 * Usage:
 *   node scripts/supabase-sql.mjs supabase/diagnostics.sql
 *   node scripts/supabase-sql.mjs supabase/migrations/xxx.sql --allow-write
 *   node scripts/supabase-sql.mjs <file> --project <ref>   # override target
 */
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const sqlPath = args.find((a) => !a.startsWith("--"));
const allowWrite = args.includes("--allow-write");
const projectFlag = args.indexOf("--project");
const dryRun = args.includes("--dry-run");

if (!sqlPath) {
  console.error("usage: node scripts/supabase-sql.mjs <file.sql> [--allow-write] [--project <ref>] [--dry-run]");
  process.exit(2);
}

/** Minimal .env reader — no dependency, tolerant of quotes and comments. */
const readEnvFile = (path) => {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
};

const env = readEnvFile(resolve(process.cwd(), ".env"));

// Token: .env first, then the standalone file, then the environment.
let token = env.SUPABASE_ACCESS_TOKEN?.trim();
if (!token) {
  const tokenFile = join(homedir(), ".supabase-token");
  if (existsSync(tokenFile)) token = readFileSync(tokenFile, "utf8").trim();
}
if (!token) token = process.env.SUPABASE_ACCESS_TOKEN?.trim();

if (!token) {
  console.error("No access token found. Set SUPABASE_ACCESS_TOKEN in .env");
  console.error("Get one at: https://supabase.com/dashboard/account/tokens");
  process.exit(3);
}
if (!token.startsWith("sbp_")) {
  console.error("That doesn't look like a Supabase personal access token (expected an sbp_ prefix).");
  process.exit(3);
}

// Target project: --project wins, else derive the ref from VITE_SUPABASE_URL.
let project = projectFlag >= 0 ? args[projectFlag + 1] : undefined;
if (!project) {
  const m = (env.VITE_SUPABASE_URL ?? "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  project = m?.[1];
}
if (!project) {
  console.error("No project ref. Pass --project <ref> or set VITE_SUPABASE_URL in .env");
  process.exit(3);
}

const raw = readFileSync(resolve(sqlPath), "utf8");

// Strip comments AND string literals for the safety check — the server still
// receives the original. Literals matter: a read-only query that merely mentions a
// policy called 'Users update their own profile' would otherwise look like a write.
const stripped = raw
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/--[^\n]*/g, "")
  .replace(/\$\$[\s\S]*?\$\$/g, " ") // dollar-quoted bodies
  .replace(/'(?:[^']|'')*'/g, " ") // single-quoted literals
  .trim();

const WRITE = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|COMMENT)\b/i;
if (!allowWrite && WRITE.test(stripped)) {
  console.error("Refusing to run: this file modifies the database and --allow-write was not passed.");
  console.error("Re-run with --allow-write once you've reviewed it.");
  process.exit(4);
}

console.log(`file    : ${sqlPath}`);
console.log(`project : ${project}`);
console.log(`mode    : ${allowWrite ? "READ-WRITE" : "read-only"}`);
if (dryRun) {
  console.log("\n--dry-run: nothing was sent.");
  process.exit(0);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: raw }),
});

const text = await res.text();
if (!res.ok) {
  console.error(`\nHTTP ${res.status}`);
  console.error(text);
  process.exit(1);
}

try {
  console.log("\n" + JSON.stringify(JSON.parse(text), null, 2));
} catch {
  console.log("\n" + text);
}
