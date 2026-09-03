import Database from "better-sqlite3";
import path from "path";
import os from "os";
import fs from "fs";

const dataDir =
  process.env.OPENCODE_DATA_DIR || path.join(os.homedir(), ".local", "share", "opencode");
const dbPath = path.join(dataDir, "opencode.db");

if (!fs.existsSync(dbPath)) {
  console.error(`Database not found at ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });
db.pragma("journal_mode = WAL");

export function getAllSessions() {
  return db
    .prepare(
      `SELECT id, title, model, agent, directory,
              tokens_input, tokens_output, tokens_reasoning,
              tokens_cache_read, tokens_cache_write,
              cost, time_created, time_updated
       FROM session
       ORDER BY time_updated DESC`
    )
    .all();
}

export function getSession(id) {
  return db
    .prepare(
      `SELECT id, title, model, agent, directory,
              tokens_input, tokens_output, tokens_reasoning,
              tokens_cache_read, tokens_cache_write,
              cost, time_created, time_updated
       FROM session WHERE id = ?`
    )
    .get(id);
}

export function getStepFinishParts(sessionId) {
  return db
    .prepare(
      `SELECT data, time_created FROM part
       WHERE session_id = ? AND json_extract(data, '$.type') = 'step-finish'
       ORDER BY time_created ASC`
    )
    .all(sessionId)
    .map((row) => ({ ...JSON.parse(row.data), time_created: row.time_created }));
}

export function getPartsBySession(sessionId, category) {
  return db
    .prepare(
      `SELECT id, data, time_created FROM part
       WHERE session_id = ? AND json_extract(data, '$.type') = ?
       ORDER BY time_created ASC`
    )
    .all(sessionId, category)
    .map((row) => ({ id: row.id, time_created: row.time_created, ...JSON.parse(row.data) }));
}

export function getPartById(sessionId, partId) {
  const row = db
    .prepare(
      `SELECT id, data, time_created FROM part
       WHERE session_id = ? AND id = ?`
    )
    .get(sessionId, partId);
  if (!row) return null;
  return { id: row.id, time_created: row.time_created, ...JSON.parse(row.data) };
}

export default db;
