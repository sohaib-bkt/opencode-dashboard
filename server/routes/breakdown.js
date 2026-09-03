import { Router } from "express";
import {
  getSession,
  getStepFinishParts,
  getPartsBySession,
  getPartById,
} from "../db.js";

const router = Router();

const CATEGORY_MAP = {
  "tool-calls": "Tool calls",
  stop: "Text & responses",
  unknown: "Uncategorized",
};

// Map category identifiers (from breakdown) to part types for the parts query
const CATEGORY_TO_PART_TYPE = {
  "tool-calls": "tool",
  stop: "text",
  unknown: "unknown",
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

// GET /api/sessions/:id/parts?category=tool-calls
router.get("/:id/parts", (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const category = req.query.category || "tool-calls";
  const partType = CATEGORY_TO_PART_TYPE[category] || category;
  const parts = getPartsBySession(req.params.id, partType);
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
