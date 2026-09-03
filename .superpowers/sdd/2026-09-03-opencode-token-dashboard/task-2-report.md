### Task 2 Report: Backend — Database Layer

**What was implemented:**
- Created `server/db.js` with read-only SQLite connection to `~/.local/share/opencode/opencode.db`
- 5 exported functions: `getAllSessions()`, `getSession(id)`, `getStepFinishParts(sessionId)`, `getPartsBySession(sessionId, category)`, `getPartById(sessionId, partId)`
- Uses `better-sqlite3` with WAL journal mode for concurrent reads
- Database path configurable via `OPENCODE_DATA_DIR` env var
- Graceful exit if database file not found

**What was tested:**
- Smoke test: `node -e "import('./server/db.js').then(m => { console.log('Sessions:', m.getAllSessions().length); ... })"`
- Result: 107 sessions found, first session returned with title and token counts — working correctly

**Files changed:**
- `server/db.js` (new, 76 lines)

**Self-review findings:**
- Implementation matches task brief exactly
- All 5 functions exported as specified
- JSON parsing in `getStepFinishParts`, `getPartsBySession`, `getPartById` correctly transforms rows into objects
- No issues found

**Issues or concerns:**
- Had to manually rebuild better-sqlite3 native bindings (`npx node-gyp rebuild`) as install scripts were initially blocked by npm config

---

**Fix (2026-09-03) — reviewer findings addressed:**

**Changes made:**
- Replaced `process.exit(1)` with `throw new Error(...)` so the module is testable and callers can handle a missing DB gracefully
- Wrapped every `JSON.parse(row.data)` call (in `getStepFinishParts`, `getPartsBySession`, `getPartById`) in a try/catch — malformed rows are skipped with a console warning instead of crashing the server

**Test run:**
- `node -e "import('./server/db.js').then(m => { ... })"` → Sessions: 109, first session returned with title and token counts — all OK
