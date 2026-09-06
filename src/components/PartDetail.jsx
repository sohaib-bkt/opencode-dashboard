import { useState } from "react";
import { formatTokens, formatNumber, formatPct, formatTimestamp } from "../utils/format";

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

function renderValue(v) {
  if (v == null) return "";
  return typeof v === "string" ? v : JSON.stringify(v, null, 2);
}

export default function PartDetail({ part, total }) {
  const [open, setOpen] = useState(false);

  const toolName = part.tool || part.filename || part.type;
  const input = part.state?.input;
  const result = part.state?.output ?? part.state?.result;
  const status = part.state?.status ?? null;
  const stepTotal = part.step_tokens?.total || 0;
  const stepPct = total > 0 ? (stepTotal / total) * 100 : 0;

  const attrTokens = part.attr_tokens || 0;
  const attrPct = part.attr_pct ?? (total > 0 ? (attrTokens / total) * 100 : 0);

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
      ? part.role === "user"
        ? "User message"
        : "Assistant message"
      : part.type === "reasoning"
        ? "Thinking"
        : part.type === "file"
          ? "Attachment"
          : part.type === "patch"
            ? "Patch"
            : part.type === "system"
              ? "System"
              : part.kind === "result"
                ? "Tool result"
                : part.kind === "call"
                  ? "Tool call"
                  : "Tool";

  const roleChip = part.role
    ? part.role
    : part.kind === "history"
      ? "history"
      : "";

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
        title={`${formatNumber(attrTokens)} tokens (${formatPct(attrPct, 2)} of total)`}
      >
        <span style={{ width: 130, fontWeight: 600 }}>
          {formatNumber(attrTokens)}{" "}
          <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>
            ({formatTokens(attrTokens)})
          </span>
        </span>
        <span style={{ width: 70, color: "var(--text-secondary)" }}>
          {formatPct(attrPct, 2)}
        </span>
        <span style={{ width: 48, color: "var(--text-secondary)" }}>
          {part.turn ?? "—"}
        </span>
        <span style={{ width: 170, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
          {roleChip ? `[${roleChip}] ` : ""}
          {part.summary || part.text || ""}
        </span>
        <span style={{ color: "var(--text-secondary)" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ ...meta, marginBottom: 8 }}>
            {formatNumber(attrTokens)} tokens ({formatPct(attrPct, 2)} of conversation)
            {" · "}~{formatNumber(part.content_tokens || 0)} content tokens (est.)
            {part.turn != null ? ` · turn ${part.turn}` : ""} ·{" "}
            {formatTimestamp(part.time_created)}
            {part.role ? ` · role: ${part.role}` : ""}
            {part.synthetic ? " · synthetic (estimated)" : ""}
          </div>

          {stepTotal > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ ...meta, textTransform: "uppercase", marginBottom: 6 }}>
                Step Token Usage · turn {part.turn ?? "—"} · {formatTimestamp(part.time_created)}
              </div>
              <div className="token-rows">
                {tokenRows.map(([label, value]) => (
                  <div key={label} className="token-rows-item">
                    <span>{label}</span>
                    <span style={{ color: "var(--text-primary)" }}>
                      {formatNumber(value)} ({formatTokens(value)}) ·{" "}
                      {total > 0 ? formatPct((value / total) * 100, 2) : "0%"}
                    </span>
                  </div>
                ))}
                <div className="token-rows-item token-rows-total">
                  <span>Step TOTAL</span>
                  <span style={{ color: "var(--text-primary)" }}>
                    {formatNumber(stepTotal)} ({formatTokens(stepTotal)}) · {formatPct(stepPct, 2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {part.type === "system" && part.text && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 4 }}>
                System / Schema
              </div>
              <pre style={codeBlockStyle}>{part.text}</pre>
            </div>
          )}

          {part.type === "file" && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 4 }}>
                Attachment
              </div>
              <pre style={codeBlockStyle}>
                {renderValue({
                  filename: part.filename,
                  url: part.url,
                  mime: part.mime,
                })}
              </pre>
            </div>
          )}

          {part.type === "patch" && part.files && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 4 }}>
                Patch files
              </div>
              <pre style={codeBlockStyle}>{renderValue(part.files)}</pre>
            </div>
          )}

          {input != null && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 4 }}>
                Input (tool args)
              </div>
              <pre style={codeBlockStyle}>{renderValue(input)}</pre>
            </div>
          )}
          {part.text && part.type !== "system" && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 4 }}>
                {part.type === "reasoning" ? "Thinking" : "Message"}
              </div>
              <pre style={codeBlockStyle}>{part.text}</pre>
            </div>
          )}
          {(result != null || part.type === "patch") && part.kind !== "call" && (
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 4 }}>
                Result
              </div>
              <pre style={codeBlockStyle}>
                {renderValue(result ?? part.files ?? "(empty result)")}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
