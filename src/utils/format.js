export function formatNumber(n) {
  return Math.round(n).toLocaleString("en-US");
}

export function formatTokens(n) {
  n = n || 0;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.?0+$/, "") + "K";
  return formatNumber(n);
}

export function formatPct(pct, digits = 1) {
  return pct.toFixed(digits) + "%";
}

export function formatTimestamp(ms) {
  if (!ms) return "—";
  const d = new Date(ms);
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function summarize(value, maxLen = 140) {
  if (value == null) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const single = text.replace(/\s+/g, " ").trim();
  return single.length > maxLen ? single.slice(0, maxLen) + "…" : single;
}
