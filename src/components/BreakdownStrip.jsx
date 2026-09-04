import { ATTR_COLORS } from "../utils/chart";
import { formatTokens, formatPct } from "../utils/format";

function itemsLabel(cat) {
  if (cat.estimated) return "estimated";
  const n = cat.items || 0;
  const noun =
    cat.key === "calls"
      ? n === 1
        ? "call"
        : "calls"
      : cat.key === "results"
        ? n === 1
          ? "result"
          : "results"
        : cat.key === "thinking"
          ? n === 1
            ? "block"
            : "blocks"
          : n === 1
            ? "message"
            : "messages";
  return `${n.toLocaleString()} ${noun}`;
}

export default function BreakdownStrip({ attribution, selectedKey, onSelect }) {
  const cats = attribution?.categories || [];
  const total = attribution?.total || 0;
  if (!cats.length) return null;

  const basisNote =
    attribution.basis === "live"
      ? "Live context mix · estimated"
      : "Full session · no live context · estimated";

  return (
    <div className="strip">
      <div
        className="strip-bar"
        role="img"
        aria-label="Proportional token mix by category"
      >
        {cats.map((c) => (
          <button
            key={c.key}
            className={`strip-seg${selectedKey === c.key ? " is-selected" : ""}`}
            style={{
              width: `${c.pct}%`,
              background: ATTR_COLORS[c.key] || "#5c6675",
            }}
            onClick={() => onSelect(selectedKey === c.key ? null : c.key)}
            title={`${c.label} · ${formatTokens(c.total)} (${formatPct(c.pct)})`}
            aria-label={`Zoom to ${c.label}`}
          >
            {c.pct >= 9 ? <span>{formatPct(c.pct, 0)}</span> : null}
          </button>
        ))}
      </div>
      <div className="strip-tiles">
        {cats.map((c) => (
          <button
            key={c.key}
            className={`strip-tile${selectedKey === c.key ? " is-selected" : ""}`}
            onClick={() => onSelect(selectedKey === c.key ? null : c.key)}
            aria-pressed={selectedKey === c.key}
          >
            <span
              className="strip-tile-band"
              style={{ background: ATTR_COLORS[c.key] || "#5c6675" }}
            />
            <span className="strip-tile-head">
              <span className="strip-tile-label">{c.label}</span>
              <span className="strip-tile-pct">{formatPct(c.pct, 1)}</span>
            </span>
            <span className="strip-tile-value">{formatTokens(c.total)}</span>
            <span className="strip-tile-sub">{itemsLabel(c)}</span>
          </button>
        ))}
      </div>
      <div className="strip-note">{basisNote}</div>
    </div>
  );
}
