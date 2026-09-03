import { Router } from "express";
import { getAllSessions } from "../db.js";
import { parseModelId, getContextWindow } from "../models.js";

const router = Router();

router.get("/", (req, res) => {
  const sessions = getAllSessions().map((s) => ({
    ...s,
    model: parseModelId(s.model),
    contextWindow: getContextWindow(s.model),
  }));
  res.json({ sessions });
});

export default router;
