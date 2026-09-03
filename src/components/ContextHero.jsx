import { formatTokens, formatNumber, formatPct } from "../utils/format";
import { calculateContextUsage, clampPct } from "../utils/math";

const SEGS = 48;

export default function ContextHero({ session }) {
  const ctx = session.currentContext || {};
  const contextTokens = ctx.total ?? 0;
  const contextWindow = session.contextWindow || 200000;
  const usage = calculateContextUsage(contextTokens, contextWindow);
  const lit = Math.round((clampPct(usage.pct) / 100) * SEGS);

  const stateLabel = {
    normal: "Nominal",
    warning: "Running hot",
    critical: "Critical",
    overflow: "Over limit",
  }[usage.state];

  return (
    <section className="hero" aria-label="Live context meter">
      <div className="hero-top">
        <span className="eyebrow">Live context</span>
        <div className="hero-model">
          <div className="hero-model-name">
            {session.modelName || session.model || "Unknown model"}
          </div>
          <div className="hero-model-sub">
            {formatNumber(contextWindow)} token window
          </div>
        </div>
      </div>
      <div className="hero-main">
        <div className="hero-pct">
          {formatPct(usage.pct, 0).replace("%", "")}
          <span className="hero-pct-unit">%</span>
        </div>
        <div className="hero-detail">
          <div>
            <strong>{formatTokens(contextTokens)}</strong> of{" "}
            {formatTokens(contextWindow)} in use
          </div>
          <span className={`state-chip state-${usage.state}`}>{stateLabel}</span>
        </div>
      </div>
      <div
        className="gauge"
        role="img"
        aria-label={`${formatPct(usage.pct, 0)} of context window used`}
      >
        {Array.from({ length: SEGS }, (_, i) => {
          const on = i < lit;
          const ratio = SEGS <= 1 ? 0 : i / (SEGS - 1);
          const cls =
            "gauge-seg" +
            (on ? " lit" : "") +
            (on && ratio >= 0.85 ? " max" : on && ratio >= 0.6 ? " hot" : "");
          return (
            <span
              key={i}
              className={cls}
              style={on ? { animationDelay: `${i * 12}ms` } : undefined}
            />
          );
        })}
      </div>
    </section>
  );
}
