export const CATEGORY_COLORS = {
  "Tool calls": "#58a6ff",
  Messages: "#3fb950",
  Reasoning: "#bc8cff",
  "System/setup": "#8b949e",
  "File operations": "#d29922",
  Compaction: "#f85149",
};

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
