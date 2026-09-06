import { useState, useEffect } from "react";
import SessionPicker from "./components/SessionPicker";
import ContextHero from "./components/ContextHero";
import OverviewCards from "./components/OverviewCards";
import BreakdownTabs from "./components/BreakdownTabs";
import DrilldownView from "./components/DrilldownView";
import { formatTokens } from "./utils/format";

export default function App() {
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [drill, setDrill] = useState(null);
  const [drillData, setDrillData] = useState(null);

  useEffect(() => {
    fetch("/api/sessions")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setSessions(d.sessions);
        if (d.sessions.length > 0) setSelectedId(d.sessions[0].id);
      })
      .catch((err) => {
        console.error("Failed to fetch sessions:", err);
        setSessions([]);
      });
  }, []);

  useEffect(() => {
    setBreakdown(null);
    setDrill(null);
    setDrillData(null);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    const load = () =>
      fetch(`/api/sessions/${selectedId}/breakdown`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((b) => {
          if (!cancelled) setBreakdown(b);
        })
        .catch((err) => {
          console.error("Failed to fetch session data:", err);
        });
    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || !drill?.key) return;
    const qs = new URLSearchParams();
    qs.set("key", drill.key);
    if (drill.tool) qs.set("tool", drill.tool);
    if (drill.leaf) qs.set("leaf", drill.leaf);
    fetch(`/api/sessions/${selectedId}/parts?${qs.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setDrillData(d))
      .catch((err) => {
        console.error("Failed to fetch parts:", err);
      });
  }, [selectedId, drill]);

  const selectedSession = sessions.find((s) => s.id === selectedId);

  const handleCategorySelect = (key, leaf = null) => {
    setDrill({ key, leaf, tool: null });
  };

  const handleToolSelect = (tool, label, key = null) => {
    setDrill({
      key: key || drill?.key || "calls",
      tool,
      leaf: label || null,
    });
  };

  const handleStripSelect = (key) => {
    if (!key) {
      setDrill(null);
      setDrillData(null);
      return;
    }
    setDrill({ key, leaf: null, tool: null });
  };

  return (
    <>
      <header className="header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>
            <span className="brand-name">Opencode</span>
            <br />
            <span className="brand-sub">Token meter</span>
          </span>
        </div>
        <SessionPicker
          sessions={sessions}
          selectedId={selectedId}
          onChange={setSelectedId}
        />
        {selectedSession && (
          <div
            className="model-badge"
            title={`${selectedSession.model || ""} · ${selectedSession.contextWindow?.toLocaleString()} token context window`}
          >
            <span className="model-badge-name">
              {selectedSession.modelName || selectedSession.model || "Unknown model"}
            </span>
            <span className="model-badge-sub">
              {formatTokens(selectedSession.contextWindow)} window
            </span>
          </div>
        )}
        {selectedSession && (
          <div className="total-display">
            <small>Lifetime tokens</small>
            {formatTokens(
              selectedSession.tokens_input +
                selectedSession.tokens_output +
                selectedSession.tokens_reasoning +
                selectedSession.tokens_cache_read +
                selectedSession.tokens_cache_write
            )}
          </div>
        )}
      </header>
      <div className="container">
        {selectedSession && <ContextHero session={selectedSession} />}
        {selectedSession && (
          <OverviewCards session={selectedSession} breakdown={breakdown} />
        )}
        {breakdown && (
          <BreakdownTabs
            sessionId={selectedId}
            breakdown={breakdown}
            onCategorySelect={handleCategorySelect}
            onToolSelect={handleToolSelect}
            onStripSelect={handleStripSelect}
          />
        )}
        {drillData && drillData.parts && (
          <DrilldownView
            drill={drillData}
            total={drillData.total || breakdown?.attribution?.total || 0}
          />
        )}
      </div>
    </>
  );
}
