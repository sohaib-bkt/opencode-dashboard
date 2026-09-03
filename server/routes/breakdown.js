import { Router } from "express";
import {
  getSession,
  getStepFinishParts,
  getPartsWithStepTokens,
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

  res.json({
    ...breakdown,
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
  const label = CATEGORY_MAP[category] || category;

  const items = getPartsWithStepTokens(req.params.id).filter(
    (p) => (CATEGORY_MAP[p.step_reason] || p.step_reason || "Uncategorized") === label
  );

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

  res.json({ parts });
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
