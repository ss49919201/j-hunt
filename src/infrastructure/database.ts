import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SCHEMA_VERSION = 1;

export function openDatabase(path: string): Database {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });

  const database = new Database(path, { create: true, strict: true });
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA busy_timeout = 5000");
  if (path !== ":memory:") database.exec("PRAGMA journal_mode = WAL");

  migrate(database);
  return database;
}

function migrate(database: Database): void {
  const version = database.query<{ user_version: number }, []>("PRAGMA user_version").get()?.user_version ?? 0;
  if (version > SCHEMA_VERSION) {
    throw new Error(`このDBは新しいバージョンで作成されています (DB: ${version}, CLI: ${SCHEMA_VERSION})。`);
  }
  if (version === SCHEMA_VERSION) return;

  database.transaction(() => {
    database.exec(`
      CREATE TABLE companies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE,
        website TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE events (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN (
          'casual_interview_applied',
          'casual_interview_scheduled',
          'casual_interview_completed',
          'resume_submitted',
          'selection_scheduled',
          'selection_completed',
          'offer_received',
          'rejected'
        )),
        occurred_at TEXT NOT NULL,
        round INTEGER CHECK (round IS NULL OR round > 0),
        payload TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload)),
        created_at TEXT NOT NULL
      );

      CREATE INDEX events_company_timeline_idx
        ON events(company_id, occurred_at, created_at);

      CREATE TABLE notes (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX notes_company_created_idx ON notes(company_id, created_at);

      CREATE TABLE resumes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE,
        content BLOB NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE resume_submissions (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE RESTRICT,
        submitted_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX resume_submissions_company_idx
        ON resume_submissions(company_id, submitted_at);
      CREATE INDEX resume_submissions_resume_idx
        ON resume_submissions(resume_id, submitted_at);

      PRAGMA user_version = 1;
    `);
  })();
}
