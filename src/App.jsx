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
  const [parts, setParts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [toolFilter, setToolFilter] = useState(null);

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
    setSelectedCategory(null);
    setToolFilter(null);
    setParts([]);
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
    if (!selectedId || (!selectedCategory && !toolFilter)) return;
    const qs = toolFilter
      ? `tool=${encodeURIComponent(toolFilter.tool)}`
      : `category=${selectedCategory}`;
    fetch(`/api/sessions/${selectedId}/parts?${qs}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setParts(d.parts))
      .catch((err) => {
        console.error("Failed to fetch parts:", err);
      });
  }, [selectedId, selectedCategory, toolFilter]);

  const selectedSession = sessions.find((s) => s.id === selectedId);

  const handleCategorySelect = (type) => {
    setToolFilter(null);
    setSelectedCategory(type);
  };

  const handleToolSelect = (tool, label) => {
    setSelectedCategory(null);
    setToolFilter({ tool, label });
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
          />
        )}
        {parts.length > 0 && (
          <DrilldownView
            parts={parts}
            category={selectedCategory}
            title={toolFilter ? `${toolFilter.label} calls` : null}
            total={breakdown?.total || 0}
          />
        )}
      </div>
    </>
  );
}

