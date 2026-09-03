import { useState } from "react";
import { formatTokens, formatPct, formatTimestamp } from "../utils/format";

const codeBlockStyle = {
  background: "var(--bg-primary)",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  padding: "12px",
  fontSize: "12px",
  fontFamily: "var(--font-mono)",
  overflow: "auto",
  maxHeight: "300px",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  color: "var(--text-primary)",
};

const meta = { fontSize: "12px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" };

export default function PartDetail({ part, total }) {
  const [open, setOpen] = useState(false);

  const toolName = part.tool || part.type;
  const input = part.state?.input;
  const result = part.state?.output ?? part.state?.result;
  const status = part.state?.status ?? null;
  const stepTotal = part.step_tokens?.total || 0;
  const stepPct = total > 0 ? (stepTotal / total) * 100 : 0;

  const tokenRows = part.step_tokens
    ? [
        ["INPUT", part.step_tokens.input || 0],
        ["OUTPUT", part.step_tokens.output || 0],
        ["REASONING", part.step_tokens.reasoning || 0],
        ["CACHE READ", part.step_tokens.cache?.read || 0],
        ["CACHE WRITE", part.step_tokens.cache?.write || 0],
      ]
    : [];

  const typeLabel =
    part.type === "text"
      ? "Text"
      : part.type === "reasoning"
      ? "Reasoning"
      : "Tool";

  return (
    <div style={{ borderTop: "1px solid var(--border)" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          color: "var(--text-primary)",
          padding: "10px 16px",
          textAlign: "left",
          cursor: "pointer",
          fontFamily: "var(--font-mono)",
          fontSize: "12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ width: 90, fontWeight: 600 }}>
          {stepTotal ? formatTokens(stepTotal) : "—"}
        </span>
        <span style={{ width: 56, color: "var(--text-secondary)" }}>
          {stepTotal ? formatPct(stepPct) : "—"}
        </span>
        <span style={{ width: 48, color: "var(--text-secondary)" }}>
          {part.turn ?? "—"}
        </span>
        <span style={{ width: 150, color: "var(--text-secondary)" }}>
          <span style={{ color: status === "completed" ? "var(--accent-green)" : "var(--text-primary)" }}>
            {toolName}
          </span>{" "}
          <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>{typeLabel}</span>
        </span>
        <span
          style={{
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: "var(--text-secondary)",
            fontSize: 11,
          }}
          title={part.summary}
        >
          {part.summary || part.text || ""}
        </span>
        <span style={{ color: "var(--text-secondary)" }}>{open ? "\u25B2" : "\u25BC"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 16px 16px" }}>
          {stepTotal > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ ...meta, textTransform: "uppercase", marginBottom: 6 }}>
                Step Token Usage · turn {part.turn ?? "—"} · {formatTimestamp(part.time_created)}
              </div>
              <div className="token-rows">
                {tokenRows.map(([label, value]) => (
                  <div key={label} className="token-rows-item">
                    <span>{label}</span>
                    <span style={{ color: "var(--text-primary)" }}>{formatTokens(value)}</span>
                  </div>
                ))}
                <div className="token-rows-item token-rows-total">
                  <span>Step TOTAL</span>
                  <span style={{ color: "var(--text-primary)" }}>{formatTokens(stepTotal)}</span>
                </div>
                <div className="token-rows-item">
                  <span>% of conversation</span>
                  <span style={{ color: "var(--text-primary)" }}>{formatPct(stepPct)}</span>
                </div>
              </div>
            </div>
          )}
          {input && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 4 }}>
                Input
              </div>
              <pre style={codeBlockStyle}>
                {typeof input === "string" ? input : JSON.stringify(input, null, 2)}
              </pre>
            </div>
          )}
          {part.text && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 4 }}>
                Message
              </div>
              <pre style={codeBlockStyle}>{part.text}</pre>
            </div>
          )}
          {result && (
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 4 }}>
                Result
              </div>
              <pre style={codeBlockStyle}>
                {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
