import { useState, useMemo } from "react";
import PartDetail from "./PartDetail";

const CATEGORY_LABELS = {
  "tool-calls": "Tool calls",
  stop: "Messages",
  unknown: "Uncategorized",
};

export default function DrilldownView({ parts, category }) {
  const [sortBy, setSortBy] = useState("time");

  const sorted = useMemo(() => {
    const copy = [...parts];
    if (sortBy === "time") copy.sort((a, b) => a.time_created - b.time_created);
    return copy;
  }, [parts, sortBy]);

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <h2 className="section-title" style={{ marginBottom: 0 }}>
          Drill-down
        </h2>
        <span style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
          {CATEGORY_LABELS[category] || category}
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
          </select>
        </div>
      </div>
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        {sorted.length === 0 && (
          <div style={{ padding: 24, color: "var(--text-secondary)", textAlign: "center" }}>
            No parts in this category
          </div>
        )}
        {sorted.map((part) => (
          <PartDetail key={part.id} part={part} />
        ))}
      </div>
    </div>
  );
}
