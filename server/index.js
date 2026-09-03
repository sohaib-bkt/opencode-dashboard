import express from "express";
import { fileURLToPath } from "url";
import path from "path";
import sessionsRouter from "./routes/sessions.js";
import breakdownRouter from "./routes/breakdown.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.use("/api/sessions", sessionsRouter);
app.use("/api/sessions", breakdownRouter);

// Serve static files in production
const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});
