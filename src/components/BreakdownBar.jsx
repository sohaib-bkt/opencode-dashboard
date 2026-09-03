import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatTokens, formatPct, formatNumber } from "../utils/format";

const COLORS = {
  "Tool calls": "var(--accent-blue)",
  "Text & responses": "var(--accent-green)",
  Uncategorized: "var(--text-secondary)",
};

function BarTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;
  const pct = total > 0 ? (entry.tokens / total) * 100 : 0;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{entry.name}</div>
      <div>{formatNumber(entry.tokens)} tokens</div>
      <div className="chart-tooltip-sub">{formatPct(pct)} of total</div>
    </div>
  );
}

export default function BreakdownBar({ breakdown, onCategorySelect }) {
  const total = breakdown.total || 0;
  const data = breakdown.categories.map((c) => {
    const pct = total > 0 ? (c.total / total) * 100 : 0;
    return {
      name: c.label,
      tokens: c.total,
      fill: COLORS[c.label] || "var(--text-secondary)",
      pct,
      items: c.items || 0,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ left: 120 }}>
        <XAxis type="number" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
          width={110}
        />
        <Tooltip
          cursor={{ fill: "rgba(110,118,129,0.1)" }}
          content={<BarTooltip total={total} />}
        />
        <Bar
          dataKey="tokens"
          radius={[0, 4, 4, 0]}
          onClick={(data) => {
            const cat = breakdown.categories.find((c) => c.label === data.name);
            if (cat) onCategorySelect(cat.type);
          }}
          style={{ cursor: "pointer" }}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
