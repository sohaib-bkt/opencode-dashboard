import { Router } from "express";
import {
  getSession,
  getStepFinishParts,
  getPartsWithStepTokens,
  getContentParts,
  getCurrentContext,
  getPartById,
} from "../db.js";
import { getContextWindow } from "../models.js";

const router = Router();

const CATEGORY_MAP = {
  "tool-calls": "Tool calls",
  stop: "Text & responses",
  unknown: "Uncategorized",
};

function aggregateBreakdown(parts) {
  const cats = {};

  for (const part of parts) {
    const type = part.reason || "unknown";
    const label = CATEGORY_MAP[type] || type;
    const tokens = part.tokens || { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } };

    if (!cats[label]) {
      cats[label] = {
        type,
        label,
        tokens_input: 0,
        tokens_output: 0,
        tokens_reasoning: 0,
        tokens_cache_read: 0,
        tokens_cache_write: 0,
        total: 0,
      };
    }

    cats[label].tokens_input += tokens.input || 0;
    cats[label].tokens_output += tokens.output || 0;
    cats[label].tokens_reasoning += tokens.reasoning || 0;
    cats[label].tokens_cache_read += tokens.cache?.read || 0;
    cats[label].tokens_cache_write += tokens.cache?.write || 0;
    cats[label].total +=
      (tokens.input || 0) +
      (tokens.output || 0) +
      (tokens.reasoning || 0) +
      (tokens.cache?.read || 0) +
      (tokens.cache?.write || 0);
  }

  const total = Object.values(cats).reduce((sum, c) => sum + c.total, 0);

  return { categories: Object.values(cats), total };
}

// Count non step-finish items that fall under each step reason
function countItemsByCategory(sessionId) {
  const counts = {};
  for (const part of getPartsWithStepTokens(sessionId)) {
    const label = CATEGORY_MAP[part.step_reason] || part.step_reason || "Uncategorized";
    counts[label] = (counts[label] || 0) + 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Rich token attribution: how tokens break down into system prompt + tool
// schemas, user/assistant messages, per-tool calls, per-tool results,
// thinking, and (for live snapshots) older conversation history.
//
// The primary basis is the LIVE context snapshot (the latest message tokens,
// i.e. what is actually in the context window right now), because cumulative
// step sums re-count re-read context on every step and would park ~99% of
// tokens in one slice. Content sizes are estimated at ~4 chars per token and
// weighted toward recent turns (what is most likely still in context); the
// system slice is the data-driven median per-step overhead. Everything is
// marked estimated in the UI. Totals always reconcile with the basis total.
// Sessions with no live context fall back to cumulative step sums.
// ---------------------------------------------------------------------------
const CHARS_PER_TOKEN = 4;
const RECENCY_DECAY = 0.85;

function contentTokens(value) {
  if (value == null) return 0;
  const s = typeof value === "string" ? value : JSON.stringify(value);
  return s.length / CHARS_PER_TOKEN;
}

function titleCase(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Collects per-part content weights with turn indices, plus per-step fresh
// input and per-step input-side content (for the system-overhead prior).
function collectContent(sessionId) {
  const steps = getStepFinishParts(sessionId);
  const turnOf = new Map();
  for (const p of getPartsWithStepTokens(sessionId)) turnOf.set(p.id, p.turn);
  const maxTurn = steps.length;

  const items = [];
  const contentInByTurn = new Map();
  const add = (it) => {
    items.push(it);
    if (it.side === "in") {
      contentInByTurn.set(it.turn, (contentInByTurn.get(it.turn) || 0) + it.w);
    }
  };

  for (const p of getContentParts(sessionId)) {
    const turn = turnOf.get(p.id) ?? maxTurn;
    if (p.type === "text") {
      const w = contentTokens(p.text);
      if (p.role === "assistant") add({ kind: "assistant", side: "out", w, turn, n: 1 });
      else if (p.role === "user") add({ kind: "user", side: "in", w, turn, n: 1 });
    } else if (p.type === "reasoning") {
      add({ kind: "thinking", side: "out", w: contentTokens(p.text), turn, n: 1 });
    } else if (p.type === "tool" && p.tool) {
      const tool = String(p.tool);
      add({ kind: "call", side: "out", tool, w: contentTokens(p.state?.input), turn, n: 1 });
      const out = p.state?.output ?? p.state?.result;
      const w = contentTokens(out);
      add({ kind: "result", side: "in", tool, w, turn, n: w > 0 ? 1 : 0 });
    }
  }

  const overheads = steps.map((s, i) => {
    const t = s.tokens || {};
    const freshIn = (t.input || 0) + (t.cache?.write || 0);
    return Math.max(0, freshIn - (contentInByTurn.get(i + 1) || 0));
  });

  return { items, maxTurn, overheads };
}

function decayed(items, maxTurn, pred) {
  let w = 0,
    n = 0;
  for (const it of items) {
    if (!pred(it)) continue;
    const f = Math.pow(RECENCY_DECAY, Math.max(0, maxTurn - (it.turn ?? maxTurn)));
    w += it.w * f;
    n += (it.n || 0) * f;
  }
  return { w, n: Math.round(n) };
}

function toolLeaves(items, maxTurn, kind, scale) {
  const byTool = new Map();
  for (const it of items) {
    if (it.kind !== kind) continue;
    const f = Math.pow(RECENCY_DECAY, Math.max(0, maxTurn - (it.turn ?? maxTurn)));
    const e = byTool.get(it.tool) || { w: 0, n: 0 };
    e.w += it.w * f;
    e.n += (it.n || 0) * f;
    byTool.set(it.tool, e);
  }
  return [...byTool.entries()]
    .map(([tool, e]) => ({ label: titleCase(tool), tool, value: e.w * scale, items: Math.round(e.n) }))
    .filter((l) => l.value > 0.5)
    .sort((a, b) => b.value - a.value);
}

function finalize(cats, total) {
  const categories = cats
    .map((c) => ({ ...c, total: c.children.reduce((a, l) => a + l.value, 0) }))
    .filter((c) => c.total > 0.5 || c.items > 0);
  const sum = categories.reduce((a, c) => a + c.total, 0);
  for (const c of categories) c.pct = sum > 0 ? (c.total / sum) * 100 : 0;
  return { categories, total: total ?? sum };
}

function attributeLive(sessionId) {
  const snapshot = getCurrentContext(sessionId);
  if (!snapshot || !(snapshot.total > 0)) return null;
  const { items, maxTurn, overheads } = collectContent(sessionId);
  if (!maxTurn) return null;

  const inputSide = (snapshot.input || 0) + (snapshot.cache?.read || 0) + (snapshot.cache?.write || 0);
  const output = snapshot.output || 0;
  const reasoning = snapshot.reasoning || 0;

  const system = Math.min(inputSide, median(overheads));
  const remaining = inputSide - system;

  const user = decayed(items, maxTurn, (it) => it.kind === "user");
  const resW = decayed(items, maxTurn, (it) => it.kind === "result").w;
  const inW = user.w + resW;
  const scale = inW > 0 ? Math.min(1, remaining / inW) : 0;
  const history = Math.max(0, remaining - inW * scale);

  const think = decayed(items, maxTurn, (it) => it.kind === "thinking");
  const assist = decayed(items, maxTurn, (it) => it.kind === "assistant");
  const calls = decayed(items, maxTurn, (it) => it.kind === "call");
  // Output-side pool split proportionally across assistant text, tool-call
  // args and thinking content; measured reasoning tokens sit on top.
  const outW = assist.w + calls.w + think.w;
  const assistShare = outW > 0 ? (output * assist.w) / outW : 0;
  const callsShare = outW > 0 ? (output * calls.w) / outW : 0;
  const thinkShare = outW > 0 ? (output * think.w) / outW : 0;
  const thinkingVal = reasoning + thinkShare;

  return {
    basis: "live",
    ...finalize(
      [
        {
          key: "system",
          label: "System prompt + tool schemas",
          estimated: true,
          items: 0,
          children: [{ label: "System prompt + tool schemas", value: system, items: 0, estimated: true }],
        },
        {
          key: "messages",
          label: "Messages",
          items: user.n + assist.n,
          children: [
            { label: "User messages", value: user.w * scale, items: user.n },
            { label: "Assistant messages", value: assistShare, items: assist.n },
          ].filter((l) => l.value > 0.5 || l.items > 0),
        },
        {
          key: "calls",
          label: "Tool calls",
          items: calls.n,
          children: toolLeaves(items, maxTurn, "call", calls.w > 0 ? callsShare / calls.w : 0),
        },
        {
          key: "results",
          label: "Tool results",
          items: decayed(items, maxTurn, (it) => it.kind === "result").n,
          children: toolLeaves(items, maxTurn, "result", scale),
        },
        {
          key: "thinking",
          label: "Thinking",
          items: think.n,
          children:
            thinkingVal > 0.5 || think.n > 0
              ? [{ label: "Reasoning blocks", value: thinkingVal, items: think.n }]
              : [],
        },
        {
          key: "history",
          label: "Conversation history",
          estimated: true,
          items: 0,
          children:
            history > 0.5
              ? [{ label: "Earlier turns", value: history, items: 0, estimated: true }]
              : [],
        },
      ],
      snapshot.total
    ),
  };
}

function attributeCumulative(sessionId, measured) {
  const { items } = collectContent(sessionId);

  const user = { w: 0, n: 0 };
  const assist = { w: 0, n: 0 };
  let thinkN = 0;
  const argsW = {},
    argsN = {},
    resW = {},
    resN = {};
  for (const it of items) {
    if (it.kind === "user") {
      user.w += it.w;
      user.n += it.n || 0;
    } else if (it.kind === "assistant") {
      assist.w += it.w;
      assist.n += it.n || 0;
    } else if (it.kind === "thinking") {
      thinkN += it.n || 0;
    } else if (it.kind === "call") {
      argsW[it.tool] = (argsW[it.tool] || 0) + it.w;
      argsN[it.tool] = (argsN[it.tool] || 0) + 1;
    } else if (it.kind === "result") {
      resW[it.tool] = (resW[it.tool] || 0) + it.w;
      resN[it.tool] = (resN[it.tool] || 0) + (it.n || 0);
    }
  }

  const inputSide = measured.input + measured.cache_read + measured.cache_write;
  const resTotal = Object.values(resW).reduce((a, b) => a + b, 0);
  const system = Math.max(0, inputSide - user.w - resTotal);

  const argsTotal = Object.values(argsW).reduce((a, b) => a + b, 0);
  const denom = assist.w + argsTotal;
  const assistShare = denom > 0 ? (measured.output * assist.w) / denom : 0;
  const argsShare = denom > 0 ? (measured.output * argsTotal) / denom : 0;

  const leaf = (weights, counts, s) =>
    Object.entries(weights)
      .map(([tool, w]) => ({ label: titleCase(tool), tool, value: w * s, items: counts[tool] || 0 }))
      .filter((l) => l.value > 0.5)
      .sort((a, b) => b.value - a.value);

  return {
    basis: "cumulative",
    ...finalize([
      {
        key: "system",
        label: "System prompt + tool schemas",
        estimated: true,
        items: 0,
        children: [{ label: "System prompt + tool schemas", value: system, items: 0, estimated: true }],
      },
      {
        key: "messages",
        label: "Messages",
        items: user.n + assist.n,
        children: [
          { label: "User messages", value: user.w, items: user.n },
          { label: "Assistant messages", value: assistShare, items: assist.n },
        ].filter((l) => l.value > 0.5 || l.items > 0),
      },
      {
        key: "calls",
        label: "Tool calls",
        items: Object.values(argsN).reduce((a, b) => a + b, 0),
        children: leaf(argsW, argsN, argsTotal > 0 ? argsShare / argsTotal : 0),
      },
      {
        key: "results",
        label: "Tool results",
        items: Object.values(resN).reduce((a, b) => a + b, 0),
        children: leaf(resW, resN, 1),
      },
      {
        key: "thinking",
        label: "Thinking",
        items: thinkN,
        children:
          measured.reasoning > 0.5 || thinkN > 0
            ? [{ label: "Reasoning blocks", value: measured.reasoning, items: thinkN }]
            : [],
      },
    ]),
  };
}

// GET /api/sessions/:id/breakdown
router.get("/:id/breakdown", (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const parts = getStepFinishParts(req.params.id);
  const breakdown = aggregateBreakdown(parts);
  const itemCounts = countItemsByCategory(req.params.id);

  breakdown.categories = breakdown.categories.map((c) => ({
    ...c,
    items: itemCounts[c.label] || 0,
    total_live: c.tokens_input + c.tokens_output + c.tokens_reasoning,
    pct: breakdown.total > 0 ? (c.total / breakdown.total) * 100 : 0,
  }));

  const totals = breakdown.categories.reduce(
    (acc, c) => {
      acc.input += c.tokens_input;
      acc.output += c.tokens_output;
      acc.reasoning += c.tokens_reasoning;
      acc.cache_read += c.tokens_cache_read;
      acc.cache_write += c.tokens_cache_write;
      return acc;
    },
    { input: 0, output: 0, reasoning: 0, cache_read: 0, cache_write: 0 }
  );

  const live = attributeLive(req.params.id);

  res.json({
    ...breakdown,
    attribution:
      live ||
      attributeCumulative(req.params.id, {
        input: totals.input,
        output: totals.output,
        reasoning: totals.reasoning,
        cache_read: totals.cache_read,
        cache_write: totals.cache_write,
      }),
    totals: {
      ...totals,
      total: totals.input + totals.output + totals.reasoning + totals.cache_read + totals.cache_write,
    },
    contextWindow: getContextWindow(session.model),
  });
});

// GET /api/sessions/:id/turns
router.get("/:id/turns", (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const parts = getStepFinishParts(req.params.id);
  const turns = parts.map((p, i) => ({
    index: i,
    reason: p.reason,
    tokens: p.tokens,
    cost: p.cost,
    time_created: p.time_created,
  }));
  res.json({ turns });
});

// GET /api/sessions/:id/parts?category=tool-calls
router.get("/:id/parts", (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const category = req.query.category || "tool-calls";
  const tool = req.query.tool || null;
  const label = CATEGORY_MAP[category] || category;

  let items = getPartsWithStepTokens(req.params.id);
  if (tool) {
    items = items.filter((p) => p.tool === tool);
  } else {
    items = items.filter(
      (p) => (CATEGORY_MAP[p.step_reason] || p.step_reason || "Uncategorized") === label
    );
  }

  const parts = items.map((p) => {
    let summary = "";
    if (p.type === "text") {
      summary = typeof p.text === "string" ? p.text : "";
    } else if (p.state?.input) {
      const input = p.state.input;
      if (typeof input === "string") summary = input;
      else {
        const parts2 = [];
        if (input.command) parts2.push(input.command);
        if (input.filePath) parts2.push(input.filePath.replace(/^.*\//, ""));
        if (input.name) parts2.push(input.name);
        if (Object.keys(input).length && parts2.length === 0)
          parts2.push(JSON.stringify(input));
        summary = parts2.join(" ");
      }
    }
    return {
      id: p.id,
      time_created: p.time_created,
      type: p.type,
      tool: p.tool || null,
      state: p.state || null,
      text: p.type === "text" ? p.text || null : null,
      turn: p.turn ?? null,
      step_reason: p.step_reason ?? null,
      step_tokens: p.step_tokens || null,
      summary: summary.slice(0, 200),
    };
  });

  res.json({ parts, tool: tool || null });
});

// GET /api/sessions/:id/parts/:partId
router.get("/:id/parts/:partId", (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const part = getPartById(req.params.id, req.params.partId);
  if (!part) return res.status(404).json({ error: "Part not found" });
  res.json(part);
});

export default router;
