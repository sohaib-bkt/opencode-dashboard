export const CATEGORY_COLORS = {
  "Tool calls": "#58a6ff",
  "Text & responses": "#3fb950",
  Uncategorized: "#8b949e",
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
