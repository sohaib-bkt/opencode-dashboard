export const CATEGORY_COLORS = {
  "Tool calls": "#2b3fee",
  "Text & responses": "#0e9f6e",
  Uncategorized: "#5c6675",
};

// Base hues for the rich attribution taxonomy (key -> hex)
export const ATTR_COLORS = {
  system: "#64748b",
  messages: "#0e9384",
  calls: "#2b3fee",
  results: "#c2410c",
  thinking: "#7a5af8",
  history: "#9aa3b2",
};

export const ATTR_LABELS = {
  system: "System prompt + tool schemas",
  messages: "Messages",
  calls: "Tool calls",
  results: "Tool results",
  thinking: "Thinking",
  history: "Conversation history",
};

// Categories hidden from the treemap in focus mode (shown via "Show all")
export const TREEMAP_FOCUS_EXCLUDE = ["system", "history"];

// Mix a hex color toward white (f > 0) or black (f < 0); f in [-1, 1].
// Used to vary treemap leaves within their parent category hue.
export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const t = f < 0 ? 0 : 255;
  const p = Math.abs(f);
  const r = Math.round(((n >> 16) & 255) * (1 - p) + t * p);
  const g = Math.round(((n >> 8) & 255) * (1 - p) + t * p);
  const b = Math.round((n & 255) * (1 - p) + t * p);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function attrLeafColor(key, index, total) {
  const base = ATTR_COLORS[key] || "#5c6675";
  if (total <= 1) return base;
  // Spread leaves from slightly deep to light within the parent hue
  const f = -0.18 + (index / (total - 1)) * 0.45;
  return shade(base, f);
}

export function createTooltip(d3) {
  return d3
    .select("body")
    .append("div")
    .style("position", "absolute")
    .style("background", "var(--bg-card)")
    .style("border", "1px solid var(--border)")
    .style("border-radius", "6px")
    .style("padding", "8px 12px")
    .style("font-family", "var(--font-mono)")
    .style("font-size", "12px")
    .style("color", "var(--text-primary)")
    .style("pointer-events", "none")
    .style("opacity", 0)
    .style("z-index", 1000);
}
