import { formatTokens } from "../utils/format";

export default function SessionPicker({ sessions, selectedId, onChange }) {
  return (
    <select
      value={selectedId || ""}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Choose a session"
    >
      {sessions.map((s) => (
        <option key={s.id} value={s.id}>
          {s.title || s.id.slice(0, 20)} — {formatTokens(s.tokens_input + s.tokens_output)}
        </option>
      ))}
    </select>
  );
}
