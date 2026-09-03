import { useState } from "react";

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

export default function PartDetail({ part }) {
  const [open, setOpen] = useState(false);

  const toolName = part.tool || part.type;
  const input = part.state?.input;
  const result = part.state?.result;
  const status = part.state?.status;

  return (
    <div style={{ borderTop: "1px solid var(--border)" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          color: "var(--text-primary)",
          padding: "12px 16px",
          textAlign: "left",
          cursor: "pointer",
          fontFamily: "var(--font-mono)",
          fontSize: "13px",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>
          {toolName}{" "}
          <span style={{ color: status === "completed" ? "var(--accent-green)" : "var(--accent-red)" }}>
            [{status}]
          </span>
        </span>
        <span style={{ color: "var(--text-secondary)" }}>{open ? "\u25B2" : "\u25BC"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 16px 16px" }}>
          {input && (
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: "11px",
                  textTransform: "uppercase",
                  color: "var(--text-secondary)",
                  marginBottom: 4,
                }}
              >
                Input
              </div>
              <pre style={codeBlockStyle}>
                {typeof input === "string" ? input : JSON.stringify(input, null, 2)}
              </pre>
            </div>
          )}
          {result && (
            <div>
              <div
                style={{
                  fontSize: "11px",
                  textTransform: "uppercase",
                  color: "var(--text-secondary)",
                  marginBottom: 4,
                }}
              >
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
