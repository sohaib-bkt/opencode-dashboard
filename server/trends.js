const DAY = 86_400_000;

function lifetime(s) {
  return (
    (s.tokens_input || 0) +
    (s.tokens_output || 0) +
    (s.tokens_reasoning || 0) +
    (s.tokens_cache_read || 0) +
    (s.tokens_cache_write || 0)
  );
}

function dayKey(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

// Pure aggregation over session rows. `now` is injectable for tests.
// Totals always reconcile: bucket and per-model sums equal totals exactly.
export function aggregateTrends(sessions, { days = 30, now = Date.now() } = {}) {
  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = dayKey(now - i * DAY);
    buckets.push({ key, label: key.slice(5), tokens: 0, cost: 0, sessions: 0 });
  }
  // Window starts at midnight of the oldest bucket's day, so every
  // in-window session lands in exactly one bucket and sums reconcile.
  const windowStart = Date.parse(`${buckets[0].key}T00:00:00.000Z`);
  const inWindow = (sessions || []).filter((s) => (s.time_updated || 0) >= windowStart);
  const byKey = new Map(buckets.map((b) => [b.key, b]));

  const perModel = new Map();
  let totalTokens = 0;
  let totalCost = 0;

  for (const s of inWindow) {
    const t = lifetime(s);
    totalTokens += t;
    totalCost += s.cost || 0;
    const b = byKey.get(dayKey(s.time_updated));
    if (b) {
      b.tokens += t;
      b.cost += s.cost || 0;
      b.sessions += 1;
    }
    const m = perModel.get(s.model || "unknown") || {
      model: s.model || "unknown",
      tokens: 0,
      cost: 0,
      sessions: 0,
    };
    m.tokens += t;
    m.cost += s.cost || 0;
    m.sessions += 1;
    perModel.set(s.model || "unknown", m);
  }

  const hottest = [...inWindow]
    .map((s) => ({
      id: s.id,
      title: s.title || s.id,
      model: s.model || "unknown",
      lifetime: lifetime(s),
      contextPct: s.contextPct ?? 0,
    }))
    .sort((a, b) => b.contextPct - a.contextPct)
    .slice(0, 10);

  return {
    days,
    buckets,
    perModel: [...perModel.values()].sort((a, b) => b.tokens - a.tokens),
    hottest,
    totals: { tokens: totalTokens, cost: totalCost, sessions: inWindow.length },
  };
}
