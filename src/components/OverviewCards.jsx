export default function OverviewCards({ session }) {
  const total =
    session.tokens_input +
    session.tokens_output +
    session.tokens_reasoning +
    session.tokens_cache_read +
    session.tokens_cache_write;

  const inputPct = total > 0 ? ((session.tokens_input / total) * 100).toFixed(1) : 0;
  const outputPct = total > 0 ? ((session.tokens_output / total) * 100).toFixed(1) : 0;
  const cacheTotal = session.tokens_cache_read + session.tokens_cache_write;
  const cacheHitPct = cacheTotal > 0 ? ((session.tokens_cache_read / cacheTotal) * 100).toFixed(1) : 0;
  const contextPct = total > 0 ? ((total / 200000) * 100).toFixed(1) : 0;

  return (
    <>
      <h2 className="section-title">Overview</h2>
      <div className="cards-grid">
        <div className="card">
          <div className="label">Total Tokens</div>
          <div className="value">{formatTokens(total)}</div>
          <div className="sub">{contextPct}% of 200K context</div>
        </div>
        <div className="card">
          <div className="label">Input / Output</div>
          <div className="value" style={{ fontSize: "20px" }}>
            <span style={{ color: "var(--accent-blue)" }}>{formatTokens(session.tokens_input)}</span>
            {" / "}
            <span style={{ color: "var(--accent-green)" }}>{formatTokens(session.tokens_output)}</span>
          </div>
          <div className="sub">{inputPct}% in / {outputPct}% out</div>
        </div>
        <div className="card">
          <div className="label">Cache Hit Rate</div>
          <div className="value">{cacheHitPct}%</div>
          <div className="sub">{formatTokens(session.tokens_cache_read)} read / {formatTokens(session.tokens_cache_write)} write</div>
        </div>
        <div className="card">
          <div className="label">Estimated Cost</div>
          <div className="value">${session.cost.toFixed(4)}</div>
          <div className="sub">{formatTokens(session.tokens_reasoning)} reasoning tokens</div>
        </div>
      </div>
    </>
  );
}

function formatTokens(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}
