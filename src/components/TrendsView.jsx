import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { formatTokens, formatNumber, formatPct } from "../utils/format";

const MODEL_FILL = "#2b3fee";

function fmtCost(v) {
  return `$${Number(v || 0).toFixed(2)}`;
}

function SeriesTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{label}</div>
      <div>
        {formatNumber(row.tokens)} tokens ({formatTokens(row.tokens)})
      </div>
      <div>{fmtCost(row.cost)} · {row.sessions} session{row.sessions === 1 ? "" : "s"}</div>
    </div>
  );
}

function ModelTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{row.model}</div>
      <div>
        {formatNumber(row.tokens)} tokens ({formatTokens(row.tokens)})
      </div>
      <div className="chart-tooltip-sub">
        {fmtCost(row.cost)} · {row.sessions} session{row.sessions === 1 ? "" : "s"}
      </div>
    </div>
  );
}

export default function TrendsView({ data, days, onDaysChange, onSelectSession }) {
  if (!data) {
    return <div style={{ color: "var(--text-secondary)" }}>Loading trends…</div>;
  }
  const t = data.totals || { tokens: 0, cost: 0, sessions: 0 };

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <h2 className="section-title" style={{ marginBottom: 0 }}>
          Trends
        </h2>
        <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
          {formatNumber(t.tokens)} tokens ({formatTokens(t.tokens)}) · {fmtCost(t.cost)} ·{" "}
          {t.sessions} sessions
        </span>
        <div style={{ marginLeft: "auto" }}>
          <select
            value={days}
            onChange={(e) => onDaysChange(Number(e.target.value))}
            style={{
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              padding: "4px 8px",
              fontSize: "12px",
              fontFamily: "var(--font-mono)",
            }}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      <h3 className="section-title" style={{ fontSize: 13 }}>Tokens &amp; cost per day</h3>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data.buckets} margin={{ left: 8, right: 8 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} />
          <YAxis
            yAxisId="tokens"
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            tickFormatter={(v) => formatTokens(v)}
          />
          <YAxis
            yAxisId="cost"
            orientation="right"
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip content={<SeriesTooltip />} />
          <Bar yAxisId="tokens" dataKey="tokens" fill="var(--accent-blue)" radius={[3, 3, 0, 0]} />
          <Line
            yAxisId="cost"
            type="monotone"
            dataKey="cost"
            stroke="var(--accent-orange)"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <h3 className="section-title" style={{ fontSize: 13, marginTop: 24 }}>By model</h3>
      <ResponsiveContainer width="100%" height={Math.max(140, (data.perModel || []).length * 52)}>
        <ComposedChart data={data.perModel} layout="vertical" margin={{ left: 24, right: 90 }}>
          <XAxis type="number" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} tickFormatter={(v) => formatTokens(v)} />
          <YAxis
            type="category"
            dataKey="model"
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            width={200}
          />
          <Tooltip content={<ModelTooltip />} />
          <Bar dataKey="tokens" radius={[0, 4, 4, 0]}>
            {(data.perModel || []).map((m) => (
              <Cell key={m.model} fill={MODEL_FILL} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>

      <h3 className="section-title" style={{ fontSize: 13, marginTop: 24 }}>Hottest sessions (live context pressure)</h3>
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <div className="drill-head">
          <span style={{ width: 130 }}>LIFETIME</span>
          <span style={{ width: 90 }}>CONTEXT</span>
          <span style={{ width: 170 }}>MODEL</span>
          <span style={{ flex: 1 }}>SESSION</span>
        </div>
        {(data.hottest || []).map((s) => (
          <button
            key={s.id}
            onClick={() => onSelectSession(s.id)}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              borderTop: "1px solid var(--border)",
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
            title="Open this session"
          >
            <span style={{ width: 130, fontWeight: 600 }}>{formatNumber(s.lifetime)}</span>
            <span
              style={{
                width: 90,
                color: s.contextPct > 90 ? "var(--accent-red)" : s.contextPct > 70 ? "var(--accent-orange)" : "var(--text-secondary)",
              }}
            >
              {formatPct(s.contextPct, 0)}
            </span>
            <span style={{ width: 170, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.model}
            </span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-secondary)" }}>
              {s.title}
            </span>
          </button>
        ))}
        {(!data.hottest || !data.hottest.length) && (
          <div style={{ padding: 24, color: "var(--text-secondary)", textAlign: "center" }}>
            No sessions in this window
          </div>
        )}
      </div>
    </div>
  );
}
