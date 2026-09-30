// ponytail: built-in node:sqlite, one file on disk. Swap to Postgres if you need multiple instances.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type { Profile, Debrief } from "./schemas";

const file = process.env.DB_PATH ?? path.join(process.cwd(), "data", "cupid.db");
fs.mkdirSync(path.dirname(file), { recursive: true });

const g = globalThis as unknown as { __db?: DatabaseSync };
// timeout: parallel build workers + request handlers share one file; wait instead of "database is locked".
export const db = (g.__db ??= new DatabaseSync(file, { timeout: 10_000 }));

db.exec(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  linkedin_url TEXT UNIQUE NOT NULL,
  instagram_url TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  name TEXT,
  photo TEXT,
  raw_linkedin TEXT,
  raw_instagram TEXT,
  profile TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS screens (
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  reason TEXT NOT NULL,
  PRIMARY KEY (from_id, to_id)
);
CREATE TABLE IF NOT EXISTS dates (
  id TEXT PRIMARY KEY,
  a_id TEXT NOT NULL,
  b_id TEXT NOT NULL,
  status TEXT NOT NULL,
  venue TEXT,
  transcript TEXT NOT NULL DEFAULT '[]',
  debrief_a TEXT,
  debrief_b TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  person_id TEXT,
  date_id TEXT,
  text TEXT NOT NULL
);
`);

export type Status =
  | "queued" | "scraping" | "reading" | "screening" | "dating" | "ready" | "error";

export type PersonRow = {
  id: string; linkedin_url: string; instagram_url: string; status: Status; error: string | null;
  name: string | null; photo: string | null; profile: Profile | null; created_at: number;
};

export type Line = { speaker: "a" | "b" | "narrator"; text: string };
export type DateRow = {
  id: string; a_id: string; b_id: string; status: "planning" | "live" | "debrief" | "done" | "error";
  venue: { venue: string; activity: string; why: string } | null;
  transcript: Line[]; debrief_a: Debrief | null; debrief_b: Debrief | null; created_at: number;
};

const j = <T>(s: unknown): T | null => (s ? (JSON.parse(String(s)) as T) : null);

function toPerson(r: Record<string, unknown>): PersonRow {
  return { ...(r as unknown as PersonRow), profile: j<Profile>(r.profile) };
}
function toDate(r: Record<string, unknown>): DateRow {
  return {
    ...(r as unknown as DateRow),
    venue: j(r.venue), transcript: j<Line[]>(r.transcript) ?? [],
    debrief_a: j(r.debrief_a), debrief_b: j(r.debrief_b),
  };
}

const PERSON_COLS = "id, linkedin_url, instagram_url, status, error, name, photo, profile, created_at";

export const people = {
  all: () => db.prepare(`SELECT ${PERSON_COLS} FROM people ORDER BY created_at`).all().map(toPerson),
  ready: () => db.prepare(`SELECT ${PERSON_COLS} FROM people WHERE profile IS NOT NULL ORDER BY created_at`).all().map(toPerson),
  get: (id: string) => {
    const r = db.prepare(`SELECT ${PERSON_COLS} FROM people WHERE id = ?`).get(id);
    return r ? toPerson(r) : null;
  },
  byLinkedin: (url: string) => {
    const r = db.prepare(`SELECT ${PERSON_COLS} FROM people WHERE linkedin_url = ?`).get(url);
    return r ? toPerson(r) : null;
  },
  raw: (id: string) =>
    db.prepare("SELECT raw_linkedin, raw_instagram FROM people WHERE id = ?").get(id) as
      { raw_linkedin: string | null; raw_instagram: string | null } | undefined,
  insert: (id: string, li: string, ig: string) =>
    db.prepare("INSERT INTO people (id, linkedin_url, instagram_url, status, created_at) VALUES (?, ?, ?, 'queued', ?)")
      .run(id, li, ig, Date.now()),
  set: (id: string, f: Partial<Record<"status" | "error" | "name" | "photo" | "raw_linkedin" | "raw_instagram" | "profile", string | null>>) => {
    const keys = Object.keys(f);
    db.prepare(`UPDATE people SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`)
      .run(...keys.map((k) => f[k as keyof typeof f] ?? null), id);
  },
};

export const screens = {
  put: (from: string, to: string, score: number, reason: string) =>
    db.prepare("INSERT OR REPLACE INTO screens VALUES (?, ?, ?, ?)").run(from, to, Math.round(score), reason),
  all: () => db.prepare("SELECT * FROM screens").all() as { from_id: string; to_id: string; score: number; reason: string }[],
};

export const dates = {
  all: () => db.prepare("SELECT * FROM dates ORDER BY created_at DESC").all().map(toDate),
  forPerson: (id: string) =>
    db.prepare("SELECT * FROM dates WHERE a_id = ? OR b_id = ? ORDER BY created_at DESC").all(id, id).map(toDate),
  get: (id: string) => {
    const r = db.prepare("SELECT * FROM dates WHERE id = ?").get(id);
    return r ? toDate(r) : null;
  },
  exists: (a: string, b: string) =>
    !!db.prepare("SELECT 1 FROM dates WHERE ((a_id = ? AND b_id = ?) OR (a_id = ? AND b_id = ?)) AND status != 'error'").get(a, b, b, a),
  insert: (id: string, a: string, b: string) =>
    db.prepare("INSERT INTO dates (id, a_id, b_id, status, created_at) VALUES (?, ?, ?, 'planning', ?)").run(id, a, b, Date.now()),
  set: (id: string, f: Partial<Record<"status" | "venue" | "transcript" | "debrief_a" | "debrief_b", string>>) => {
    const keys = Object.keys(f);
    db.prepare(`UPDATE dates SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`)
      .run(...keys.map((k) => f[k as keyof typeof f]!), id);
  },
};

export const events = {
  log: (text: string, person_id: string | null = null, date_id: string | null = null) =>
    db.prepare("INSERT INTO events (ts, person_id, date_id, text) VALUES (?, ?, ?, ?)").run(Date.now(), person_id, date_id, text),
  recent: (n = 40) =>
    db.prepare("SELECT * FROM events ORDER BY id DESC LIMIT ?").all(n) as
      { id: number; ts: number; person_id: string | null; date_id: string | null; text: string }[],
};
