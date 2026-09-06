# OpenCode Token Dashboard

A local web dashboard that visualizes token/context usage for OpenCode agent sessions.

<img width="1919" height="842" alt="image" src="https://github.com/user-attachments/assets/a0657811-1361-4580-bc64-16eb5819c8e4" />
<img width="1920" height="766" alt="image" src="https://github.com/user-attachments/assets/90a4c7e7-8bab-438a-8c02-1cde36d3c562" />

## Prerequisites

- Node.js 18+
- OpenCode installed with at least one session

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Custom Data Directory

By default, the dashboard reads from `~/.local/share/opencode/opencode.db`. To use a different path:

```bash
OPENCODE_DATA_DIR=/path/to/opencode/data npm run dev
```

## Production Build

```bash
npm run build
npm start
```

The production server serves the built frontend and API from port 3001.

## What It Shows

Two views, switchable in the header:

### Session view

- **Live context hero**: current context-window pressure with per-model window sizes
  (unknown models fall back to 200K)
- **Overview cards**: total tokens, input/output split, cache hit rate, estimated cost
- **Token breakdown**: treemap, sunburst, and bar views over one shared taxonomy —
  system prompt + tool schemas, messages, tool calls, tool results, thinking, and
  conversation history. All charts reconcile exactly to the live snapshot total
  (values marked *estimated* are apportioned from content sizes at ~4 chars/token)
- **Drill-down**: click any category, leaf, or tool to list the underlying parts —
  user/assistant messages with roles, tool inputs and results, thinking blocks with
  durations, and per-row exact tokens + % of total. System prompt and history rows
  are honest estimates (that data isn't stored as parts)
- **Auto-refresh**: polls every 5 seconds while viewing a session

### Trends view

- **Tokens & cost per day** time-series (7/30/90-day windows, calendar-day buckets)
- **By-model** totals for cost/token comparison across models
- **Hottest sessions** ranked by live context pressure — click to jump into a session
