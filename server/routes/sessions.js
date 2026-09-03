import { Router } from "express";
import { getAllSessions } from "../db.js";

const router = Router();

router.get("/", (req, res) => {
  const sessions = getAllSessions();
  res.json({ sessions });
});

export default router;
