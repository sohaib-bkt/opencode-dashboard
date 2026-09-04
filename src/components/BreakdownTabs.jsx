import { useState, useEffect } from "react";
import BreakdownBar from "./BreakdownBar";
import BreakdownTreemap from "./BreakdownTreemap";
import BreakdownSunburst from "./BreakdownSunburst";
import BreakdownStrip from "./BreakdownStrip";

const TABS = [
  { id: "treemap", label: "Treemap" },
  { id: "sunburst", label: "Sunburst" },
  { id: "bar", label: "Bar" },
];

export default function BreakdownTabs({
  sessionId,
  breakdown,
  onCategorySelect,
  onToolSelect,
}) {
  const [active, setActive] = useState("treemap");
  const [zoomKey, setZoomKey] = useState(null);
  const total = breakdown?.total || 0;

  useEffect(() => {
    setZoomKey(null);
  }, [sessionId]);

  return (
    <div style={{ marginBottom: 32 }}>
      <h2 className="section-title">Token Breakdown</h2>

      {breakdown.attribution && (
        <BreakdownStrip
          attribution={breakdown.attribution}
          selectedKey={zoomKey}
          onSelect={setZoomKey}
        />
      )}

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
      {active === "treemap" && breakdown.attribution && (
        <BreakdownTreemap
          attribution={breakdown.attribution}
          zoomKey={zoomKey}
          onZoom={setZoomKey}
          onToolSelect={onToolSelect}
        />
      )}
      {active === "treemap" && !breakdown.attribution && (
        <BreakdownBar breakdown={breakdown} onCategorySelect={onCategorySelect} />
      )}
      {active === "sunburst" && (
        <BreakdownSunburst breakdown={breakdown} onCategorySelect={onCategorySelect} />
      )}
      {active === "bar" && (
        <BreakdownBar breakdown={breakdown} onCategorySelect={onCategorySelect} />
      )}
    </div>
  );
}
