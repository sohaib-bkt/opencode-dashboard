import { Router } from "express";
import {
  getSession,
  getStepFinishParts,
  getPartsBySession,
  getPartById,
} from "../db.js";

const router = Router();

const CATEGORY_MAP = {
  tool: "Tool calls",
  text: "Messages",
  reasoning: "Reasoning",
  "step-start": "System/setup",
  patch: "File operations",
  file: "File operations",
  compaction: "Compaction",
};

function aggregateBreakdown(parts) {
  const cats = {};
  const toolTotals = {};

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

  return { categories: Object.values(cats), total, tools: Object.values(toolTotals) };
}

// GET /api/sessions/:id/breakdown
router.get("/:id/breakdown", (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const parts = getStepFinishParts(req.params.id);
  const breakdown = aggregateBreakdown(parts);
  res.json(breakdown);
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

// GET /api/sessions/:id/parts?category=tool
router.get("/:id/parts", (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const category = req.query.category || "tool";
  const parts = getPartsBySession(req.params.id, category);
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
