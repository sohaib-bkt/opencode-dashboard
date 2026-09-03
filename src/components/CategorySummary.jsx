import { formatTokens, formatPct } from "../utils/format";
import { CATEGORY_COLORS } from "../utils/chart";

export default function CategorySummary({ categories, total, onCategorySelect }) {
  return (
    <div className="category-summary">
      {categories.map((c) => {
        const color = CATEGORY_COLORS[c.label] || "#8b949e";
        const pct = total > 0 ? (c.total / total) * 100 : 0;
        return (
          <button
            key={c.type}
            className="category-summary-row"
            onClick={() => onCategorySelect(c.type)}
            title={`${c.label} · ${c.items} items`}
          >
            <span className="category-dot" style={{ background: color }} />
            <span className="category-name">{c.label}</span>
            <span className="category-tokens">{formatTokens(c.total)}</span>
            <span className="category-pct">{formatPct(pct)}</span>
          </button>
        );
      })}
    </div>
  );
}
