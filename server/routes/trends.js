import { Router } from "express";
import { getAllSessions, getCurrentContext } from "../db.js";
import { parseModelId, getContextWindow } from "../models.js";
import { aggregateTrends } from "../trends.js";

const router = Router();

// GET /api/trends?days=30 — cross-session tokens/cost buckets, per-model
// totals, and hottest sessions by live context pressure.
router.get("/", (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
  const sessions = getAllSessions().map((s) => {
    const ctx = getCurrentContext(s.id) || {};
    const window = getContextWindow(s.model);
    const total = ctx.total || 0;
    return {
      id: s.id,
      title: s.title,
      model: parseModelId(s.model) || "unknown",
      tokens_input: s.tokens_input,
      tokens_output: s.tokens_output,
      tokens_reasoning: s.tokens_reasoning,
      tokens_cache_read: s.tokens_cache_read,
      tokens_cache_write: s.tokens_cache_write,
      cost: s.cost,
      time_updated: s.time_updated,
      contextPct: window > 0 ? (total / window) * 100 : 0,
    };
  });
  res.json(aggregateTrends(sessions, { days }));
});

export default router;
