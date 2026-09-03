import { Router } from "express";
import { getAllSessions, getCurrentContext } from "../db.js";
import { parseModelId, getContextWindow } from "../models.js";

const router = Router();

router.get("/", (req, res) => {
  const sessions = getAllSessions().map((s) => {
    const ctx = getCurrentContext(s.id) || {};
    return {
      ...s,
      model: parseModelId(s.model),
      contextWindow: getContextWindow(s.model),
      currentContext: {
        total: ctx.total ?? 0,
        input: ctx.input ?? 0,
        output: ctx.output ?? 0,
        reasoning: ctx.reasoning ?? 0,
        cacheRead: ctx.cache?.read ?? 0,
        cacheWrite: ctx.cache?.write ?? 0,
      },
    };
  });
  res.json({ sessions });
});

export default router;
