import { formatTokens, formatNumber, formatPct } from "../utils/format";
import { calculateContextUsage, clampPct } from "../utils/math";

export default function OverviewCards({ session, breakdown }) {
  const total =
    session.tokens_input +
    session.tokens_output +
    session.tokens_reasoning +
    session.tokens_cache_read +
    session.tokens_cache_write;

  const contextTokens =
    session.tokens_input + session.tokens_output + session.tokens_reasoning;

  const contextWindow = session.contextWindow || 200000;
  const ctx = calculateContextUsage(contextTokens, contextWindow);
  const ctxBarPct = clampPct(ctx.pct);

  const inputPct = total > 0 ? (session.tokens_input / total) * 100 : 0;
  const outputPct = total > 0 ? (session.tokens_output / total) * 100 : 0;
  const reasoningPct = total > 0 ? (session.tokens_reasoning / total) * 100 : 0;
  const cacheTotal = session.tokens_cache_read + session.tokens_cache_write;
  const cacheReadPct = total > 0 ? (session.tokens_cache_read / total) * 100 : 0;
  const cacheWritePct = total > 0 ? (session.tokens_cache_write / total) * 100 : 0;

  const distribution = [
    { label: "INPUT", value: session.tokens_input, color: "var(--accent-blue)" },
    { label: "CACHE WRITE", value: session.tokens_cache_write, color: "var(--accent-orange)" },
    { label: "CACHE READ", value: session.tokens_cache_read, color: "var(--accent-purple)" },
    { label: "OUTPUT", value: session.tokens_output, color: "var(--accent-green)" },
  ];

  const ctxStateColor = {
    normal: "var(--accent-green)",
    warning: "var(--accent-orange)",
    critical: "var(--accent-red)",
    overflow: "var(--accent-red)",
  }[ctx.state];

  const ctxStateLabel = {
    normal: "Normal",
    warning: "Warning",
    critical: "Critical",
    overflow: "Context window exceeded",
  }[ctx.state];

  return (
    <>
      <h2 className="section-title">Overview</h2>
      <div className="cards-grid">
        <div className="card">
          <div className="label">Total Tokens</div>
          <div className="value">{formatTokens(total)}</div>
          <div className="sub">
            {formatTokens(contextTokens)} / {formatTokens(contextWindow)} context
          </div>
          <div className="sub">
            <span style={{ color: ctxStateColor }}>
              {formatPct(ctx.pct)} of context window
            </span>
          </div>
          <div className="progress-bar">
            <div
              className={`progress-fill progress-${ctx.state}`}
              style={{ width: `${ctxBarPct}%` }}
            />
          </div>
        </div>

        <div className="card">
          <div className="label">Context Window</div>
          <div className="value" style={{ fontSize: "22px" }}>
            {formatNumber(contextTokens)}
          </div>
          <div className="sub">
            {formatPct(ctx.pct)} of {formatNumber(contextWindow)} context
          </div>
          <div className="sub" style={{ color: ctxStateColor }}>
            {ctxStateLabel}
          </div>
          <div className="progress-bar" style={{ margin: "10px 0 14px" }}>
            <div
              className={`progress-fill progress-${ctx.state}`}
              style={{ width: `${ctxBarPct}%` }}
            />
          </div>
          <div className="context-dist">
            <div className="context-dist-bar">
              {distribution.map((d) => (
                <div
                  key={d.label}
                  className="context-dist-seg"
                  style={{
                    width: `${total > 0 ? (d.value / total) * 100 : 0}%`,
                    background: d.color,
                  }}
                  title={`${d.label}: ${formatTokens(d.value)}`}
                />
              ))}
            </div>
            {distribution.map((d) => (
              <div key={d.label} className="context-dist-row">
                <span style={{ color: d.color }}>{d.label}</span>
                <span className="context-dist-value">{formatTokens(d.value)}</span>
                <span className="context-dist-sub">
                  {total > 0 ? formatPct((d.value / total) * 100, 2) : "0%"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="label">Input / Output</div>
          <div className="value" style={{ fontSize: "20px" }}>
            <span style={{ color: "var(--accent-blue)" }}>{formatTokens(session.tokens_input)}</span>
            {" / "}
            <span style={{ color: "var(--accent-green)" }}>{formatTokens(session.tokens_output)}</span>
          </div>
          <div className="sub">{formatPct(inputPct, 1)} in / {formatPct(outputPct, 1)} out</div>
          {session.tokens_reasoning > 0 && (
            <div className="sub">
              {formatTokens(session.tokens_reasoning)} reasoning ({formatPct(reasoningPct, 1)})
            </div>
          )}
        </div>

        <div className="card">
          <div className="label">Cache Hit Rate</div>
          <div className="value">
            {cacheTotal > 0
              ? formatPct((session.tokens_cache_read / cacheTotal) * 100, 1)
              : "0%"}
          </div>
          <div className="sub">
            {formatTokens(session.tokens_cache_read)} read ({formatPct(cacheReadPct, 1)}) /{" "}
            {formatTokens(session.tokens_cache_write)} write ({formatPct(cacheWritePct, 1)})
          </div>        </div>

        <div className="card">
          <div className="label">Estimated Cost</div>
          <div className="value">${session.cost.toFixed(4)}</div>
          <div className="sub">{formatTokens(session.tokens_reasoning)} reasoning tokens</div>
        </div>
      </div>
    </>
  );
}
