export function calculatePercentage(value, total) {
  if (!total || !value) return 0;
  return (value / total) * 100;
}

export function calculateContextUsage(currentTokens, maxContextWindow) {
  const pct = calculatePercentage(currentTokens, maxContextWindow);
  let state = "normal";
  if (pct > 100) state = "overflow";
  else if (pct > 90) state = "critical";
  else if (pct > 70) state = "warning";
  return { pct, state };
}

export function clampPct(pct, max = 100) {
  return Math.min(pct, max);
}
