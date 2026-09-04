import Database from "better-sqlite3";
import path from "path";
import os from "os";
import fs from "fs";

const dataDir =
  process.env.OPENCODE_DATA_DIR || path.join(os.homedir(), ".local", "share", "opencode");
const dbPath = path.join(dataDir, "opencode.db");

if (!fs.existsSync(dbPath)) {
  throw new Error(`Database not found at ${dbPath}`);
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

// Returns the tokens object of the most recent message that carries token
// usage ({total, input, output, reasoning, cache}). This is the active
// context OpenCode reports (current context window usage), distinct from the
// session's cumulative lifetime counters.
export function getCurrentContext(sessionId) {
  const rows = db
    .prepare(
      `SELECT data, time_updated FROM message
       WHERE session_id = ?
       ORDER BY time_updated ASC`
    )
    .all(sessionId);
  let latest = null;
  for (const row of rows) {
    try {
      const d = JSON.parse(row.data);
      if (d && d.tokens) latest = d.tokens;
    } catch {
      // ignore malformed rows
    }
  }
  return latest;
}

export function getStepFinishParts(sessionId) {
  return db
    .prepare(
      `SELECT data, time_created FROM part
       WHERE session_id = ? AND json_extract(data, '$.type') = 'step-finish'
       ORDER BY time_created ASC`
    )
    .all(sessionId)
    .map((row) => {
      try {
        return { ...JSON.parse(row.data), time_created: row.time_created };
      } catch {
        console.warn(`Skipping malformed part row for session ${sessionId}`);
        return null;
      }
    })
    .filter(Boolean);
}

// Returns non step-start/step-finish parts in chronological order, each
// annotated with the token total of the step-finish that closes its turn
// (`step_tokens`) and a `turn` index. Parts never closed by a step-finish
// get null step_tokens / turn.
export function getPartsWithStepTokens(sessionId) {
  const rows = db
    .prepare(
      `SELECT id, data, time_created FROM part
       WHERE session_id = ?
       ORDER BY time_created ASC`
    )
    .all(sessionId);

  const parts = rows
    .map((row) => {
      try {
        return { id: row.id, time_created: row.time_created, ...JSON.parse(row.data) };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const result = [];
  const pending = [];
  let turn = 0;

  for (const part of parts) {
    if (part.type === "step-finish") {
      turn += 1;
      const stepTokens = part.tokens || null;
      const stepReason = part.reason || "unknown";
      for (const p of pending) {
        p.step_tokens = stepTokens;
        p.step_reason = stepReason;
        p.turn = turn;
        result.push(p);
      }
      pending.length = 0;
    } else if (part.type === "step-start") {
      // ignore boundary markers
    } else {
      pending.push(part);
    }
  }
  // Any trailing parts not closed by a step-finish
  for (const p of pending) {
    p.step_tokens = null;
    p.step_reason = null;
    p.turn = null;
    result.push(p);
  }
  return result;
}

export function getPartById(sessionId, partId) {
  const row = db
    .prepare(
      `SELECT id, data, time_created FROM part
       WHERE session_id = ? AND id = ?`
    )
    .get(sessionId, partId);
  if (!row) return null;
  try {
    return { id: row.id, time_created: row.time_created, ...JSON.parse(row.data) };
  } catch {
    console.warn(`Skipping malformed part row ${partId} for session ${sessionId}`);
    return null;
  }
}

// Returns content parts (text, reasoning, tool, file) annotated with the
// role of their parent message (user / assistant / null). Boundary markers
// (step-start / step-finish) and compaction markers are excluded.
export function getContentParts(sessionId) {
  const rows = db
    .prepare(
      `SELECT p.id, p.data, p.time_created, m.data AS mdata
       FROM part p LEFT JOIN message m ON p.message_id = m.id
       WHERE p.session_id = ?
       ORDER BY p.time_created ASC`
    )
    .all(sessionId);

  const result = [];
  for (const row of rows) {
    let data;
    try {
      data = JSON.parse(row.data);
    } catch {
      continue;
    }
    if (data.type === "step-start" || data.type === "step-finish") continue;
    if (data.type === "compaction") continue;
    let role = null;
    if (row.mdata) {
      try {
        role = JSON.parse(row.mdata).role || null;
      } catch {
        role = null;
      }
    }
    result.push({ id: row.id, time_created: row.time_created, role, ...data });
  }
  return result;
}

export default db;
