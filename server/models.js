// Per-model metadata keyed by model id.
// context = model context window (tokens). name = display name.
// Values sourced from OpenCode's own registry (`opencode models --verbose`,
// Sep 2026) so each model's context window is accurate rather than a single
// static value. Model ids not listed here (legacy/custom ids such as
// deepseek-v4-flash-free, minimax-m2.5-free, claude-sonnet-4-6, and ollama
// passthrough models without an explicit limit) fall back to the defaults
// below; for those the raw id is used as the display name.
const MODEL_META = {
  "big-pickle": { context: 200_000, name: "Big Pickle" },
  "mimo-v2.5-free": { context: 200_000, name: "MiMo V2.5 Free" },
  "muse-spark-1.2-contributor-free": { context: 1_048_576, name: "Muse Spark 1.2 Free" },
  "muse-spark-1.3-contributor-free": { context: 1_048_576, name: "Muse Spark 1.3 Free" },
  "nemotron-3-ultra-free": { context: 1_000_000, name: "Nemotron 3 Ultra Free" },
  "nemotron-3.5-lightning-free": { context: 262_144, name: "Nemotron 3.5 Lightning Free" },
  "glm-4.6:cloud": { context: 202_752, name: "glm-4.6:cloud" },
};

const DEFAULT_CONTEXT_WINDOW = 200_000;

export function parseModelId(raw) {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed?.id || raw;
    } catch {
      return raw;
    }
  }
  return raw?.id || null;
}

export function getContextWindow(modelRaw) {
  const id = parseModelId(modelRaw);
  const meta = id ? MODEL_META[id] : undefined;
  if (meta && meta.context) return meta.context;
  return DEFAULT_CONTEXT_WINDOW;
}

export function getModelName(modelRaw) {
  const id = parseModelId(modelRaw);
  const meta = id ? MODEL_META[id] : undefined;
  return (meta && meta.name) || id || "";
}
