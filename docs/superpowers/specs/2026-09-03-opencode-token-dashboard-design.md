# OpenCode Token Usage Dashboard — Design Spec

## Overview

A local web dashboard that visualizes token/context usage for OpenCode agent sessions. Reads directly from OpenCode's SQLite database, presents session-level and per-turn token breakdowns with interactive charts and drill-down views.

## Data Source

**Primary:** SQLite database at `~/.local/share/opencode/opencode.db` (read-only).

Key tables:

| Table | Purpose |
|-------|---------|
| `session` | Aggregated token counts per session (`tokens_input`, `tokens_output`, `tokens_reasoning`, `tokens_cache_read`, `tokens_cache_write`, `cost`) |
| `message` | Messages within a session (links to parts) |
| `part` | Individual content parts (tool calls, text, reasoning, step-finish summaries, patches, files) |
| `project` | Project metadata |

Part types and their dashboard category mapping:

| Part Type | Dashboard Category | Token Source |
|-----------|-------------------|--------------|
| `text` | Messages | Embedded in part data |
| `tool` | Tool calls | `step-finish` for token counts; tool name from `part.tool` |
| `reasoning` | Reasoning | `step-finish` for token counts |
| `step-start` | System/setup | `step-finish` for token counts |
| `patch`, `file` | File operations | `step-finish` for token counts |
| `compaction` | Compaction | `step-finish` for token counts |

The `step-finish` parts carry the authoritative token breakdown per step:
```json
{
  "type": "step-finish",
  "tokens": {
    "input": 25973,
    "output": 3359,
    "reasoning": 0,
    "cache": { "read": 1856, "write": 0 }
  },
  "cost": 0
}
```

The `session` table has pre-aggregated totals, used for the session list.

## Architecture

```
┌─────────────────────┐     ┌─────────────────────────┐
│   Vite Dev Server   │────▶│   Express API Server    │
│  (React Frontend)   │proxy│   (Node.js + better-    │
│   :5173             │     │    sqlite3)  :3001       │
└─────────────────────┘     └────────┬────────────────┘
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │   opencode.db       │
                          │   (read-only)       │
                          └─────────────────────┘
```

**Dev mode:** `concurrently` runs Vite (port 5173) and Express (port 3001). Vite proxies `/api` requests to Express.

**Production mode:** `vite build` outputs to `dist/`. Express serves static files from `dist/` plus API routes.

## Project Structure

```
dev/opencode-dashboard/
├── package.json
├── README.md
├── server/
│   ├── index.js          # Express entry point, static file serving
│   ├── db.js             # SQLite connection, WAL mode, read-only
│   └── routes/
│       ├── sessions.js   # GET /api/sessions
│       └── breakdown.js  # /api/sessions/:id/breakdown, /turns, /parts
├── src/
│   ├── main.jsx
│   ├── App.jsx           # Layout, session state, routing
│   ├── api.js            # Fetch helpers
│   ├── index.css         # Global styles, dark theme
│   └── components/
│       ├── SessionPicker.jsx
│       ├── OverviewCards.jsx
│       ├── BreakdownTreemap.jsx  # D3 treemap
│       ├── BreakdownSunburst.jsx # D3 sunburst
│       ├── BreakdownBar.jsx      # Recharts bar chart
│       ├── BreakdownTabs.jsx     # Tab container for charts
│       ├── DrilldownView.jsx     # Breadcrumb + sortable list
│       └── PartDetail.jsx        # Expandable tool call/result
├── vite.config.js
└── index.html
```

## Backend API

### GET /api/sessions

Returns all sessions ordered by `time_updated DESC`.

```json
{
  "sessions": [
    {
      "id": "ses_...",
      "title": "Session title",
      "model": "claude-sonnet-4-20250514",
      "agent": "code",
      "directory": "/path/to/project",
      "tokens_input": 12345,
      "tokens_output": 678,
      "tokens_reasoning": 90,
      "tokens_cache_read": 5000,
      "tokens_cache_write": 200,
      "cost": 0.05,
      "time_created": 1725300000000,
      "time_updated": 1725301200000
    }
  ]
}
```

### GET /api/sessions/:id/breakdown

Aggregates token usage by category from `step-finish` parts. Maps part types to display categories, sums token fields.

```json
{
  "categories": [
    {
      "type": "tool",
      "label": "Tool calls",
      "tokens_input": 50000,
      "tokens_output": 3000,
      "tokens_reasoning": 0,
      "tokens_cache_read": 10000,
      "tokens_cache_write": 0,
      "total": 63000
    }
  ],
  "total": 100000,
  "tools": [
    { "name": "bash", "total": 15000 },
    { "name": "edit", "total": 12000 },
    { "name": "read", "total": 8000 }
  ]
}
```

### GET /api/sessions/:id/turns

Returns per-turn token data from `step-finish` parts, chronologically sorted.

```json
{
  "turns": [
    {
      "index": 0,
      "reason": "tool-calls",
      "tokens": { "input": 5000, "output": 800, "reasoning": 0, "cache": { "read": 2000, "write": 0 } },
      "cost": 0.001,
      "time_created": 1725300000000
    }
  ]
}
```

### GET /api/sessions/:id/parts?category=tool

Returns parts of a given type, with truncated content for list view.

```json
{
  "parts": [
    {
      "id": "part_...",
      "type": "tool",
      "tool": "read",
      "callID": "call_...",
      "state": { "status": "completed", "input": "...truncated...", "result": "...truncated..." },
      "time_created": 1725300000000
    }
  ]
}
```

### GET /api/sessions/:id/parts/:partId

Full detail of one part — no truncation.

## Frontend

### Layout

- **Header:** Sticky top bar with session picker dropdown + total tokens big number
- **Body:** Scrollable content area with cards and charts

### Components

**SessionPicker** — Dropdown listing sessions with title, model, and total tokens. Sorted by most recent.

**OverviewCards** — Grid of 4 cards:
- Total Tokens (with % of context window, default 200k configurable)
- Input vs Output split (pie/donut mini-chart)
- Cache Hit % (`cache_read / (cache_read + cache_write)`)
- Estimated Cost

**BreakdownTabs** — Tab bar switching between Treemap, Sunburst, Bar views. All render the same breakdown data.

**BreakdownTreemap (D3)** — Nested rectangles. Top level = category (Tool calls, Messages, etc.). Within Tool calls = individual tool names (Bash, Edit, Read, etc.). Sized by token count. Color-coded by category. Tooltip on hover shows token details.

**BreakdownSunburst (D3)** — Radial layout of the same hierarchy. Inner ring = categories, outer ring = individual tools. Click to zoom into a category.

**BreakdownBar (Recharts)** — Horizontal stacked bar chart. One bar per category showing input/output/cache breakdown.

**DrilldownView** — Below the charts. Breadcrumb: "All items > Tool calls > Read". Sortable table (by tokens or time). Click a row to expand PartDetail inline.

**PartDetail** — Shows full tool input and result content in a code-style pre block. Collapsible.

### Styling

Dark theme. CSS custom properties for colors:
```css
:root {
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-card: #1c2128;
  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --accent-blue: #58a6ff;
  --accent-green: #3fb950;
  --accent-orange: #d29922;
  --accent-red: #f85149;
  --accent-purple: #bc8cff;
  --border: #30363d;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}
```

Monospace font for numbers. Cards with subtle borders and rounded corners.

### Auto-refresh

When viewing a session, poll `/api/sessions/:id/breakdown` every 5 seconds. Cards show a subtle pulse animation when values change. Session list polls every 10 seconds.

## Dependencies

**Backend:**
- `express` ^4.x
- `better-sqlite3` ^11.x

**Frontend:**
- `react` ^19.x, `react-dom` ^19.x
- `recharts` ^2.x
- `d3` ^7.x, `d3-hierarchy` ^3.x

**Dev:**
- `vite` ^6.x
- `@vitejs/plugin-react` ^4.x
- `concurrently` ^9.x

## Configuration

Environment variable `OPENCODE_DATA_DIR` overrides the default `~/.local/share/opencode/` path. The server reads `OPENCODE_DATA_DIR/opencode.db`.

## Error Handling

- DB not found: API returns 500 with `{ error: "Database not found at <path>" }`
- Invalid session ID: 404 with `{ error: "Session not found" }`
- DB locked (WAL mode handles this, but fallback): 503 with retry header
- Frontend: Shows error state cards with retry button

## README Content

1. What this is
2. Prerequisites (Node.js 18+)
3. `npm install && npm run dev`
4. How to set `OPENCODE_DATA_DIR` for custom paths
5. What the dashboard shows

## Scope (MVP)

- SQLite-only data source (no JSON fallback)
- Polling for real-time (no SSE/WebSocket)
- Dark theme only (no light mode toggle)
- No authentication (local-only tool)
- No unit tests (visual verification against real data)
