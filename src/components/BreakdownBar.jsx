import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const COLORS = {
  "Tool calls": "var(--accent-blue)",
  "Text & responses": "var(--accent-green)",
  Uncategorized: "var(--text-secondary)",
};

export default function BreakdownBar({ breakdown, onCategorySelect }) {
  const data = breakdown.categories.map((c) => ({
    name: c.label,
    tokens: c.total,
    fill: COLORS[c.label] || "var(--text-secondary)",
  }));

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
          contentStyle={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
          }}
          formatter={(value) => [value.toLocaleString() + " tokens", "Total"]}
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
