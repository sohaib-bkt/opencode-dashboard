import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { formatTokens, formatPct, formatNumber } from "../utils/format";
import { ATTR_COLORS } from "../utils/chart";

function BarTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{entry.name}</div>
      <div>
        {formatNumber(entry.tokens)} tokens ({formatTokens(entry.tokens)})
      </div>
      <div className="chart-tooltip-sub">
        {formatPct(entry.pct, 2)} of total · {(entry.items || 0).toLocaleString()} items
        {entry.estimated ? " · estimated" : ""}
      </div>
      <div className="chart-tooltip-sub">Click to drill down</div>
    </div>
  );
}

export default function BreakdownBar({ attribution, onCategorySelect }) {
  const cats = attribution?.categories || [];
  const total = attribution?.total || 0;
  const data = cats.map((c) => ({
    key: c.key,
    name: c.label,
    tokens: Math.round(c.total),
    fill: ATTR_COLORS[c.key] || "var(--text-secondary)",
    pct: c.pct || 0,
    items: c.items || 0,
    estimated: !!c.estimated,
    leaves: (c.children || []).length,
  }));

  if (!data.length) return null;

  return (
    <div>
      <ResponsiveContainer width="100%" height={Math.max(300, data.length * 56)}>
        <BarChart data={data} layout="vertical" margin={{ left: 24, right: 90 }}>
          <XAxis type="number" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            width={190}
          />
          <Tooltip
            cursor={{ fill: "rgba(110,118,129,0.1)" }}
            content={<BarTooltip total={total} />}
          />
          <Bar
            dataKey="tokens"
            radius={[0, 4, 4, 0]}
            onClick={(d) => {
              const row = d?.payload || d;
              if (row?.key) onCategorySelect(row.key, null);
            }}
            style={{ cursor: "pointer" }}
          >
            {data.map((entry) => (
              <Cell key={entry.key} fill={entry.fill} />
            ))}
            <LabelList
              dataKey="tokens"
              position="right"
              formatter={(v) => `${formatNumber(v)} (${formatPct(total > 0 ? (v / total) * 100 : 0, 1)})`}
              style={{ fill: "var(--text-secondary)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
        Total {formatNumber(Math.round(total))} tokens ({formatTokens(total)}) across {data.length} categories — sums to 100%.
      </div>
    </div>
  );
}
