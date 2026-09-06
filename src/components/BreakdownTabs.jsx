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
  onStripSelect,
}) {
  const [active, setActive] = useState("treemap");
  const [zoomKey, setZoomKey] = useState(null);
  const attribution = breakdown?.attribution || null;

  useEffect(() => {
    setZoomKey(null);
  }, [sessionId]);

  const handleCategory = (key, leaf = null) => {
    setZoomKey(key);
    onCategorySelect(key, leaf);
  };

  const handleTool = (tool, label, key = null) => {
    if (key) setZoomKey(key);
    onToolSelect(tool, label, key);
  };

  const handleStrip = (key) => {
    setZoomKey(key);
    if (onStripSelect) onStripSelect(key);
    else if (key) onCategorySelect(key, null);
  };

  return (
    <div style={{ marginBottom: 32 }}>
      <h2 className="section-title">Token Breakdown</h2>

      {attribution && (
        <BreakdownStrip
          attribution={attribution}
          selectedKey={zoomKey}
          onSelect={handleStrip}
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
      {active === "treemap" && attribution && (
        <BreakdownTreemap
          attribution={attribution}
          zoomKey={zoomKey}
          onZoom={setZoomKey}
          onToolSelect={handleTool}
          onCategorySelect={handleCategory}
        />
      )}
      {active === "sunburst" && attribution && (
        <BreakdownSunburst
          attribution={attribution}
          onCategorySelect={handleCategory}
          onToolSelect={handleTool}
        />
      )}
      {active === "bar" && attribution && (
        <BreakdownBar attribution={attribution} onCategorySelect={handleCategory} />
      )}
    </div>
  );
}
