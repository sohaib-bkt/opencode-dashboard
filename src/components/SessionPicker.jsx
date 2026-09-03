export default function SessionPicker({ sessions, selectedId, onChange }) {
  return (
    <select
      value={selectedId || ""}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: "var(--bg-card)",
        color: "var(--text-primary)",
        border: "1px solid var(--border)",
        borderRadius: "6px",
        padding: "8px 12px",
        fontSize: "14px",
        fontFamily: "var(--font-mono)",
        cursor: "pointer",
        maxWidth: "400px",
      }}
    >
      {sessions.map((s) => (
        <option key={s.id} value={s.id}>
          {s.title || s.id.slice(0, 20)} — {formatTokens(s.tokens_input + s.tokens_output)}
        </option>
      ))}
    </select>
  );
}

function formatTokens(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}
