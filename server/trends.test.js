import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { aggregateTrends } from "./trends.js";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 6, 12, 0, 0);

function row(over = {}) {
  return {
    id: "ses_1",
    title: "t",
    model: "muse-spark-1.3-contributor-free",
    tokens_input: 100,
    tokens_output: 50,
    tokens_reasoning: 10,
    tokens_cache_read: 20,
    tokens_cache_write: 5,
    cost: 1.5,
    time_updated: NOW - DAY,
    contextPct: 10,
    ...over,
  };
}

describe("aggregateTrends", () => {
  it("buckets sessions by UTC day within the window", () => {
    const out = aggregateTrends(
      [row({ id: "a", time_updated: NOW - DAY }), row({ id: "b", time_updated: NOW - 2 * DAY })],
      { days: 7, now: NOW }
    );
    assert.equal(out.buckets.length, 7);
    assert.equal(out.totals.sessions, 2);
  });

  it("excludes sessions older than the window", () => {
    const out = aggregateTrends([row({ time_updated: NOW - 30 * DAY })], { days: 7, now: NOW });
    assert.equal(out.totals.sessions, 0);
    assert.equal(out.totals.tokens, 0);
  });

  it("bucket and per-model sums reconcile exactly to totals", () => {
    const out = aggregateTrends(
      [
        row({ id: "a", model: "m1", tokens_input: 101, cost: 2 }),
        row({ id: "b", model: "m2", tokens_input: 203, cost: 3 }),
      ],
      { days: 7, now: NOW }
    );
    const bucketSum = out.buckets.reduce((s, b) => s + b.tokens, 0);
    const modelSum = out.perModel.reduce((s, m) => s + m.tokens, 0);
    assert.equal(bucketSum, out.totals.tokens);
    assert.equal(modelSum, out.totals.tokens);
    assert.equal(out.totals.cost, 5);
  });

  it("ranks hottest sessions by live context pressure", () => {
    const out = aggregateTrends(
      [row({ id: "cool", contextPct: 5 }), row({ id: "hot", contextPct: 95 })],
      { days: 7, now: NOW }
    );
    assert.equal(out.hottest[0].id, "hot");
  });

  it("uses calendar-day windows so buckets always reconcile", () => {
    // NOW is midday Sep 6; the 7-day window is the calendar days
    // Aug 31–Sep 6. An Aug 30 evening session is outside it.
    const outside = row({ id: "old", time_updated: NOW - 6.6 * DAY, tokens_input: 7 });
    const inside = row({ id: "in", time_updated: NOW - 6.4 * DAY, tokens_input: 11 });
    const out = aggregateTrends([outside, inside], { days: 7, now: NOW });
    assert.equal(out.totals.sessions, 1);
    const bucketSum = out.buckets.reduce((s, b) => s + b.tokens, 0);
    assert.equal(bucketSum, out.totals.tokens);
  });
});
