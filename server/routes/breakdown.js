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
  // Round leaf values to whole tokens and reconcile so everything adds up
  // exactly: category totals = sum of leaves, grand total = sum of
  // categories (or the measured basis total with drift parked on largest).
  // Keep every category (even zero-total ones like history) so the
  // sunburst/bar/strip always contain the full taxonomy and rows reconcile.
  const categories = cats.map((c) => {
    const children = (c.children || []).map((l) => ({
      ...l,
      value: Math.round(l.value || 0),
    }));
    const catTotal = children.reduce((a, l) => a + l.value, 0);
    return { ...c, children, total: catTotal };
  });
  let sum = categories.reduce((a, c) => a + c.total, 0);
  const basisTotal = total != null ? Math.round(total) : sum;
  // Park rounding drift on the largest category so sum === basisTotal.
  if (categories.length && sum !== basisTotal) {
    let biggest = categories[0];
    for (const c of categories) if (c.total > biggest.total) biggest = c;
    const diff = basisTotal - sum;
    biggest.total += diff;
    if (biggest.children.length) {
      let bigLeaf = biggest.children[0];
      for (const l of biggest.children) if (l.value > bigLeaf.value) bigLeaf = l;
      bigLeaf.value += diff;
    }
    sum = basisTotal;
  }
  for (const c of categories) {
    c.pct = sum > 0 ? (c.total / sum) * 100 : 0;
    for (const l of c.children) l.pct = sum > 0 ? (l.value / sum) * 100 : 0;
  }
  return { categories, total: sum };
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
      {
        key: "history",
        label: "Conversation history",
        estimated: true,
        items: 0,
        children: [],
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

  const { attribution, totals } = buildAttribution(req.params.id);

  res.json({
    ...breakdown,
    attribution,
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

// ---------------------------------------------------------------------------
// Drill-down: one taxonomy everywhere. `key` is the attribution category
// (system | messages | calls | results | thinking | history). `tool`
// narrows to one tool, `leaf` to one leaf label (e.g. "User messages").
// Legacy `category=tool-calls|stop|unknown` still works by mapping onto the
// closest attribution key. Every row carries exact (rounded, reconciled)
// `attr_tokens` + `attr_pct` so rows sum exactly to `categoryTotal` which
// sums exactly to `total`. System prompt + tool schemas and conversation
// history have no 1:1 stored parts, so they return honest synthetic rows
// (estimated, labelled) instead of an empty list.
// ---------------------------------------------------------------------------
const LEGACY_TO_KEY = {
  "tool-calls": "calls",
  stop: "messages",
  unknown: "messages",
};

function summarizePart(p) {
  if (p.summary) return p.summary;
  if (p.type === "text") {
    if (typeof p.text === "string" && p.text.trim()) return p.text;
    return p.role === "user" ? "(empty user message)" : "(empty assistant message)";
  }
  if (p.type === "reasoning") {
    if (typeof p.text === "string" && p.text.trim()) return p.text;
    const t = p.state?.time ?? p.time;
    const dur =
      t?.start && t?.end ? ` (${(((t.end - t.start) / 1000).toFixed(1))}s)` : "";
    return `(encrypted / empty thinking block${dur})`;
  }
  if (p.type === "file")
    return p.filename || p.url || p.mime || "file attachment";
  if (p.type === "patch")
    return Array.isArray(p.files) ? p.files.join(", ") : "patch";
  const input = p.state?.input;
  if (typeof input === "string") return input;
  if (input && typeof input === "object") {
    const bits = [];
    if (input.command) bits.push(String(input.command).slice(0, 120));
    if (input.filePath) bits.push(String(input.filePath).replace(/^.*\//, ""));
    if (input.name) bits.push(String(input.name));
    if (input.url) bits.push(String(input.url));
    if (input.pattern) bits.push(String(input.pattern));
    if (!bits.length) {
      const keys = Object.keys(input);
      if (keys.length) bits.push(keys.slice(0, 3).join(", "));
    }
    if (bits.length) return bits.join(" ");
  }
  if (p.tool) return p.tool;
  return "";
}

function rawWeight(p, key) {
  if (key === "calls") return contentTokens(p.state?.input);
  if (key === "results")
    return contentTokens(p.state?.output ?? p.state?.result ?? p.files);
  if (key === "thinking" || key === "messages" || key === "history")
    return contentTokens(
      p.text ?? p.filename ?? p.url ?? (p.files || []).join(" ")
    );
  return 0;
}

function buildAttribution(sessionId) {
  const steps = getStepFinishParts(sessionId);
  const breakdown = aggregateBreakdown(steps);
  const itemCounts = countItemsByCategory(sessionId);
  breakdown.categories = breakdown.categories.map((c) => ({
    ...c,
    items: itemCounts[c.label] || 0,
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
  const live = attributeLive(sessionId);
  const attribution =
    live ||
    attributeCumulative(sessionId, {
      input: totals.input,
      output: totals.output,
      reasoning: totals.reasoning,
      cache_read: totals.cache_read,
      cache_write: totals.cache_write,
    });
  return { attribution, totals };
}

// GET /api/sessions/:id/parts?key=messages&tool=bash&leaf=User%20messages
router.get("/:id/parts", (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });

  let key = req.query.key || null;
  if (!key && req.query.category) {
    key = LEGACY_TO_KEY[req.query.category] || "messages";
  }
  if (!key && req.query.tool) key = "calls";
  if (!key) key = "calls";
  const tool = req.query.tool || null;
  const leaf = req.query.leaf || null;

  const { attribution } = buildAttribution(req.params.id);
  const total = attribution.total || 0;
  const cat = attribution.categories.find((c) => c.key === key);
  const categoryTotal = cat?.total || 0;

  const leafOf = (label) => cat?.children?.find((l) => l.label === label);

  // Turn + step-token annotation for every content part.
  const turnOf = new Map();
  const stepOf = new Map();
  for (const p of getPartsWithStepTokens(req.params.id)) {
    turnOf.set(p.id, p.turn);
    stepOf.set(p.id, { tokens: p.step_tokens || null, reason: p.step_reason || null });
  }
  const content = getContentParts(req.params.id).map((p) => ({
    ...p,
    turn: turnOf.has(p.id) ? turnOf.get(p.id) : null,
    step_tokens: stepOf.has(p.id) ? stepOf.get(p.id).tokens : null,
    step_reason: stepOf.has(p.id) ? stepOf.get(p.id).reason : null,
  }));

  const titleOf = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  let candidates = [];
  let note = null;
  let estimated = true;

  if (key === "system") {
    // No stored parts: surface tool schemas + a system-prompt row carrying
    // the estimated category tokens.
    const byTool = new Map();
    for (const p of content) {
      if (p.type === "tool" && p.tool) byTool.set(p.tool, (byTool.get(p.tool) || 0) + 1);
    }
    const sysLeaf = cat?.children?.[0];
    const sysTotal = sysLeaf?.value || categoryTotal || 0;
    candidates = [
      {
        id: "system-prompt",
        type: "system",
        tool: null,
        role: "system",
        text: "System prompt + tool schemas (estimated — not stored as parts in the DB)",
        state: null,
        summary: "System prompt + tool schemas",
        w: Math.max(sysTotal, 1),
        synthetic: true,
      },
      ...[...byTool.entries()]
        .map(([t, n]) => ({
          id: `schema-${t}`,
          type: "system",
          tool: t,
          role: "system",
          text: `Tool schema: ${t} (${n} call${n === 1 ? "" : "s"} in session)`,
          state: null,
          summary: `schema: ${t}`,
          w: 1,
          synthetic: true,
        }))
        .sort((a, b) => b.text.localeCompare(a.text)),
    ];
    if (tool) candidates = candidates.filter((c) => c.tool === tool);
    note = "System prompt text is not stored as parts; tokens are estimated from per-step overhead.";
  } else if (key === "messages") {
    candidates = content
      .filter((p) => {
        if (p.type === "text" && (p.role === "user" || p.role === "assistant")) return true;
        if (p.type === "file") return true;
        return false;
      })
      .map((p) => ({
        ...p,
        w: Math.max(rawWeight(p, key), 0.01),
        kind: p.type === "file" ? "attachment" : p.role === "user" ? "user" : "assistant",
      }));
    if (leaf === "User messages") candidates = candidates.filter((c) => c.kind === "user" || c.kind === "attachment");
    if (leaf === "Assistant messages") candidates = candidates.filter((c) => c.kind === "assistant");
    if (tool) candidates = [];
    note = "User + assistant message texts and file attachments.";
  } else if (key === "calls") {
    candidates = content
      .filter((p) => p.type === "tool" && p.tool)
      .map((p) => ({ ...p, w: Math.max(rawWeight(p, key), 0.01), kind: "call" }));
    if (tool) candidates = candidates.filter((c) => c.tool === tool);
    if (leaf) {
      const t = [...(cat?.children || [])].find((l) => l.label === leaf)?.tool;
      if (t) candidates = candidates.filter((c) => c.tool === t);
    }
    note = "Tool-call arguments (input side). Click a result in Tool results for outputs.";
  } else if (key === "results") {
    candidates = content
      .filter((p) => {
        if (p.type === "tool" && (p.state?.output !== undefined || p.state?.result !== undefined)) return true;
        if (p.type === "patch") return true;
        return false;
      })
      .map((p) => ({ ...p, w: Math.max(rawWeight(p, key), 0.01), kind: "result" }));
    if (tool) candidates = candidates.filter((c) => c.tool === tool);
    if (leaf) {
      const t = [...(cat?.children || [])].find((l) => l.label === leaf)?.tool;
      if (t) candidates = candidates.filter((c) => c.tool === t);
    }
    note = "Tool outputs / results (input side of next step).";
  } else if (key === "thinking") {
    candidates = content
      .filter((p) => p.type === "reasoning")
      .map((p) => ({ ...p, w: Math.max(rawWeight(p, key), 0.01), kind: "thinking" }));
    if (tool) candidates = [];
    note = "Reasoning / thinking blocks plus measured reasoning tokens.";
  } else if (key === "history") {
    // Estimated earlier-turns slice: show the oldest content as what the
    // estimate is grounded in, labelled honestly.
    const sorted = [...content].sort((a, b) => (a.time_created || 0) - (b.time_created || 0));
    const half = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)));
    candidates = half.map((p) => ({ ...p, w: Math.max(rawWeight(p, "history"), 0.01), kind: "history" }));
    if (tool) candidates = candidates.filter((c) => c.tool === tool);
    note =
      (cat?.total || 0) > 0
        ? "Estimated earlier-turns context (oldest halves shown as grounding; tokens estimated)."
        : "No estimated history tokens in this snapshot — oldest turns shown for context (0 tokens).";
  } else {
    return res.status(400).json({ error: `Unknown drill key: ${key}` });
  }

  if (leaf && key !== "system" && !["User messages", "Assistant messages"].includes(leaf)) {
    // leaf already applied for calls/results via tool lookup above
  }

  // Apportion the (already reconciled) category/leaf total across rows so
  // displayed tokens are exact and sum exactly to the header.
  let target = categoryTotal;
  if (leaf) {
    const l = leafOf(leaf);
    if (l) target = l.value;
    else if (key === "system") target = categoryTotal;
    else if ((key === "calls" || key === "results") && tool) {
      const l2 = (cat?.children || []).find((c) => c.tool === tool);
      if (l2) target = l2.value;
    }
  } else if (tool && (key === "calls" || key === "results")) {
    const l2 = (cat?.children || []).find((c) => c.tool === tool);
    if (l2) target = l2.value;
  }
  const wSum = candidates.reduce((a, c) => a + (c.w || 0), 0);
  let rows = candidates.map((c) => ({
    ...c,
    attr_tokens: wSum > 0 ? Math.round(((c.w || 0) / wSum) * target) : 0,
  }));
  // Reconcile rounding drift onto the largest row.
  const rSum = rows.reduce((a, r) => a + r.attr_tokens, 0);
  if (rows.length && rSum !== target) {
    let big = rows[0];
    for (const r of rows) if (r.attr_tokens > big.attr_tokens) big = r;
    big.attr_tokens += target - rSum;
  }

  const parts = rows.map((p) => {
    const summary = summarizePart(p);
    return {
      id: p.id,
      time_created: p.time_created || null,
      type: p.type,
      kind: p.kind || null,
      tool: p.tool || null,
      role: p.role || null,
      state: p.state || null,
      text: p.type === "text" || p.type === "reasoning" || p.type === "system" ? p.text || null : null,
      filename: p.filename || null,
      url: p.url || null,
      mime: p.mime || null,
      files: p.files || null,
      turn: p.turn ?? null,
      step_reason: p.step_reason ?? null,
      step_tokens: p.step_tokens || null,
      content_tokens: Math.round(p.w || 0),
      attr_tokens: p.attr_tokens,
      attr_pct: total > 0 ? (p.attr_tokens / total) * 100 : 0,
      synthetic: !!p.synthetic,
      summary: String(summary || "").slice(0, 200),
    };
  });

  // Most useful first for big lists is by tokens, but keep chronological
  // default stable; frontend offers the sort toggle.
  parts.sort((a, b) => (a.time_created || 0) - (b.time_created || 0));

  res.json({
    parts,
    key,
    tool: tool || null,
    leaf: leaf || null,
    label: tool ? titleOf(tool) : leaf || cat?.label || key,
    categoryTotal: target,
    total,
    estimated,
    note,
  });
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
