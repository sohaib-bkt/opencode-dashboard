import { useState, useEffect } from "react";
import SessionPicker from "./components/SessionPicker";
import OverviewCards from "./components/OverviewCards";
import BreakdownTabs from "./components/BreakdownTabs";
import DrilldownView from "./components/DrilldownView";

export default function App() {
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [turns, setTurns] = useState([]);
  const [parts, setParts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedPartId, setSelectedPartId] = useState(null);

  useEffect(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((d) => {
        setSessions(d.sessions);
        if (d.sessions.length > 0) setSelectedId(d.sessions[0].id);
      });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    Promise.all([
      fetch(`/api/sessions/${selectedId}/breakdown`).then((r) => r.json()),
      fetch(`/api/sessions/${selectedId}/turns`).then((r) => r.json()),
    ]).then(([b, t]) => {
      setBreakdown(b);
      setTurns(t.turns);
      setSelectedCategory(null);
      setSelectedPartId(null);
      setParts([]);
    });
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || !selectedCategory) return;
    fetch(`/api/sessions/${selectedId}/parts?category=${selectedCategory}`)
      .then((r) => r.json())
      .then((d) => setParts(d.parts));
  }, [selectedId, selectedCategory]);

  const selectedSession = sessions.find((s) => s.id === selectedId);

  return (
    <>
      <header className="header">
        <h1>OpenCode Dashboard</h1>
        <SessionPicker
          sessions={sessions}
          selectedId={selectedId}
          onChange={setSelectedId}
        />
        {selectedSession && (
          <div className="total-display">
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
        {selectedSession && <OverviewCards session={selectedSession} />}
        {breakdown && (
          <BreakdownTabs
            breakdown={breakdown}
            onCategorySelect={setSelectedCategory}
          />
        )}
        {parts.length > 0 && (
          <DrilldownView
            parts={parts}
            category={selectedCategory}
            onPartSelect={setSelectedPartId}
            selectedPartId={selectedPartId}
          />
        )}
      </div>
    </>
  );
}

function formatTokens(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}
