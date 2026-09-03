// Known context window sizes per model id (tokens).
// The session `model` column stores only a provider id/string, not a context
// window, so we maintain this map. Values are best-effort and configurable.
// big-pickle is intentionally NOT overridden: measured usage (17,273 tokens
// reported as ~9% used) confirms it uses the 200K default below.
const CONTEXT_WINDOWS = {};

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
  if (id && CONTEXT_WINDOWS[id] != null) return CONTEXT_WINDOWS[id];
  return DEFAULT_CONTEXT_WINDOW;
}
