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

- **Overview cards**: Total tokens, input/output split, cache hit rate, estimated cost
- **Breakdown charts**: Bar chart, treemap, and sunburst views of token categories
- **Drill-down**: Click any category to see individual tool calls with full input/result content
- **Auto-refresh**: Polls every 5 seconds while viewing a session
