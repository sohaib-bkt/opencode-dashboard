import { useState, useMemo } from "react";
import PartDetail from "./PartDetail";
import { formatNumber, formatTokens, formatPct } from "../utils/format";

export default function DrilldownView({ drill, total }) {
  const [sortBy, setSortBy] = useState("time");

  const parts = drill?.parts || [];
  const categoryTotal = drill?.categoryTotal ?? parts.reduce((a, p) => a + (p.attr_tokens || 0), 0);
  const grand = total || drill?.total || 0;
  const catPct = grand > 0 ? (categoryTotal / grand) * 100 : 0;

  const sorted = useMemo(() => {
    const copy = [...parts];
    if (sortBy === "time") copy.sort((a, b) => (a.time_created || 0) - (b.time_created || 0));
    else if (sortBy === "tokens") copy.sort((a, b) => (b.attr_tokens || 0) - (a.attr_tokens || 0));
    return copy;
  }, [parts, sortBy]);

  const title = drill?.tool
    ? `${drill.tool} · ${drill?.label || ""}`
    : drill?.label || drill?.key || "";

  // Version-skew guard: the new UI needs the new /parts shape (label,
  // categoryTotal, per-row attr_tokens). A stale `node server/index.js`
  // serves the legacy shape — flag it instead of rendering silent zeros.
  const isLegacy =
    drill && (drill.label == null || (parts.length > 0 && parts[0].attr_tokens === undefined));

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <h2 className="section-title" style={{ marginBottom: 0 }}>
          Drill-down
        </h2>
        <span style={{ color: "var(--text-primary)", fontSize: "13px", fontWeight: 600 }}>
          {title}
        </span>
        <span style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
          ({parts.length} items)
        </span>
        <div style={{ marginLeft: "auto" }}>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              padding: "4px 8px",
              fontSize: "12px",
              fontFamily: "var(--font-mono)",
            }}
          >
            <option value="time">By time</option>
            <option value="tokens">By tokens</option>
          </select>
        </div>
      </div>

      <div
        style={{
          fontSize: 12,
          color: "var(--text-secondary)",
          fontFamily: "var(--font-mono)",
          marginBottom: 12,
        }}
      >
        {formatNumber(categoryTotal)} tokens ({formatTokens(categoryTotal)}) ·{" "}
        {formatPct(catPct, 2)} of {formatNumber(grand)} total
        {drill?.estimated ? " · estimated" : ""} · rows sum exactly to header
      </div>
      {drill?.note && (
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
          {drill.note}
        </div>
      )}
      {isLegacy && (
        <div
          style={{
            fontSize: 12,
            color: "#7a2e0e",
            background: "#fff7ed",
            border: "1px solid #fdba74",
            borderRadius: 6,
            padding: "8px 12px",
            marginBottom: 12,
          }}
        >
          API served the legacy drill-down shape — restart the backend (Ctrl+C, then{" "}
          <code>npm run dev</code>) so per-row tokens load.
        </div>
      )}

      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <div className="drill-head">
          <span style={{ width: 130 }}>TOKENS (exact)</span>
          <span style={{ width: 70 }}>%</span>
          <span style={{ width: 48 }}>TURN</span>
          <span style={{ width: 170 }}>TYPE</span>
          <span style={{ flex: 1 }}>SUMMARY</span>
        </div>
        {sorted.length === 0 && (
          <div style={{ padding: 24, color: "var(--text-secondary)", textAlign: "center" }}>
            No parts in this category
          </div>
        )}
        {sorted.map((part) => (
          <PartDetail key={part.id} part={part} total={grand} />
        ))}
      </div>
    </div>
  );
}
