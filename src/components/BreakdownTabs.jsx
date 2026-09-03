import { useState } from "react";
import BreakdownBar from "./BreakdownBar";
import BreakdownTreemap from "./BreakdownTreemap";
import BreakdownSunburst from "./BreakdownSunburst";
import CategorySummary from "./CategorySummary";

const TABS = [
  { id: "bar", label: "Bar Chart" },
  { id: "treemap", label: "Treemap" },
  { id: "sunburst", label: "Sunburst" },
];

export default function BreakdownTabs({ breakdown, onCategorySelect }) {
  const [active, setActive] = useState("bar");
  const total = breakdown?.total || 0;

  return (
    <div style={{ marginBottom: 32 }}>
      <h2 className="section-title">Token Breakdown</h2>

      <CategorySummary categories={breakdown.categories} total={total} onCategorySelect={onCategorySelect} />

      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 16,
          marginTop: 16,
          borderBottom: "1px solid var(--border)",
          paddingBottom: 8,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            style={{
              background: active === tab.id ? "var(--bg-card)" : "transparent",
              color: active === tab.id ? "var(--text-primary)" : "var(--text-secondary)",
              border: "none",
              borderRadius: "6px 6px 0 0",
              padding: "8px 16px",
              fontSize: "13px",
              cursor: "pointer",
              fontWeight: active === tab.id ? 600 : 400,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {active === "bar" && <BreakdownBar breakdown={breakdown} onCategorySelect={onCategorySelect} />}
      {active === "treemap" && <BreakdownTreemap breakdown={breakdown} onCategorySelect={onCategorySelect} />}
      {active === "sunburst" && <BreakdownSunburst breakdown={breakdown} onCategorySelect={onCategorySelect} />}
    </div>
  );
}
