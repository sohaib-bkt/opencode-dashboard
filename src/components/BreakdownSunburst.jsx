import { useRef, useEffect } from "react";
import * as d3 from "d3";
import { ATTR_COLORS, attrLeafColor, createTooltip } from "../utils/chart";
import { formatTokens, formatNumber, formatPct } from "../utils/format";

export default function BreakdownSunburst({ attribution, onCategorySelect, onToolSelect }) {
  const svgRef = useRef();

  const cats = attribution?.categories || [];
  const total = attribution?.total || 0;

  useEffect(() => {
    if (!cats.length || !svgRef.current) return;

    const width = 560;
    const height = 560;
    const radius = width / 2;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g").attr("transform", `translate(${width / 2},${height / 2})`);

    // Two levels: category ring + leaf ring, so ALL attribution buckets
    // (system, messages, calls, results, thinking, history) appear.
    const hierarchy = {
      name: "root",
      children: cats.map((c) => ({
        name: c.label,
        key: c.key,
        children: (c.children || []).map((l) => ({
          name: l.label,
          value: Math.max(l.value || 0, 0.0001),
          catKey: c.key,
          catLabel: c.label,
          tool: l.tool || null,
          items: l.items || 0,
          estimated: !!l.estimated,
          exact: l.value || 0,
        })),
      })),
    };

    const root = d3.hierarchy(hierarchy).sum((d) => d.value);
    const partition = d3.partition().size([2 * Math.PI, radius]);
    partition(root);

    const arc = d3
      .arc()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .innerRadius((d) => d.y0)
      .outerRadius((d) => d.y1 - 1);

    const tooltip = createTooltip(d3);

    g.selectAll("path")
      .data(root.descendants().filter((d) => d.depth > 0))
      .join("path")
      .attr("d", arc)
      .attr("fill", (d) => {
        if (d.depth === 1) return ATTR_COLORS[d.data.key] || "#8b949e";
        return attrLeafColor(d.data.catKey, 0, 1);
      })
      .attr("opacity", (d) => (d.depth === 1 ? 0.9 : 0.65))
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        if (d.depth === 2 && d.data.tool && onToolSelect) {
          onToolSelect(d.data.tool, d.data.name, d.data.catKey);
        } else {
          const key = d.depth === 1 ? d.data.key : d.data.catKey;
          const leaf = d.depth === 2 ? d.data.name : null;
          onCategorySelect(key, leaf);
        }
      })
      .on("mouseover", (event, d) => {
        const v = d.depth === 2 ? d.data.exact : d.value;
        const pct = total > 0 ? (v / total) * 100 : 0;
        const parentValue = d.parent ? d.parent.value : total;
        const pctParent = parentValue > 0 ? (v / parentValue) * 100 : 0;
        let html =
          `<div class="chart-tooltip-title">${d.data.name}</div>` +
          `<div>${formatNumber(Math.round(v))} tokens (${formatPct(pct, 1)} of total)</div>`;
        if (d.depth === 1) {
          const cat = cats.find((c) => c.key === d.data.key);
          html += `<div>${formatPct(pctParent, 1)} of parent</div>`;
          if (cat) html += `<div>${(cat.items || 0).toLocaleString()} items · click to drill down</div>`;
        } else {
          html += `<div>${formatPct(pctParent, 1)} of ${d.parent.data.name}</div>`;
          if (d.data.items) html += `<div>${d.data.items.toLocaleString()} items</div>`;
          if (d.data.estimated) html += `<div>estimated</div>`;
          html += `<div class="chart-tooltip-sub">Click to drill down</div>`;
        }
        tooltip.style("opacity", 1).html(html);
      })
      .on("mousemove", (event) => {
        tooltip.style("left", event.pageX + 12 + "px").style("top", event.pageY - 28 + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0));

    // Labels for category arcs large enough to fit
    g.selectAll("text.cat-label")
      .data(root.children.filter((d) => d.x1 - d.x0 > 0.3))
      .join("text")
      .attr("class", "cat-label")
      .attr("transform", (d) => {
        const mid = (d.x0 + d.x1) / 2;
        const r = (d.y0 + d.y1) / 2;
        return `translate(${Math.sin(mid) * r},${-Math.cos(mid) * r}) rotate(${(mid * 180) / Math.PI - 90})`;
      })
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("fill", "#fff")
      .attr("font-size", "10px")
      .attr("font-weight", "600")
      .style("pointer-events", "none")
      .text((d) => d.data.name);

    // Center label: exact total
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.2em")
      .attr("fill", "var(--text-primary)")
      .attr("font-size", "16px")
      .attr("font-weight", "700")
      .attr("font-family", "var(--font-mono)")
      .text(formatTokens(total));

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1.2em")
      .attr("fill", "var(--text-secondary)")
      .attr("font-size", "11px")
      .attr("font-family", "var(--font-mono)")
      .text(`${formatNumber(Math.round(total))} tokens`);

    return () => {
      tooltip.remove();
    };
  }, [attribution, onCategorySelect, onToolSelect]);

  if (!cats.length) return null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <svg ref={svgRef} width="560" height="560" style={{ display: "block", maxWidth: "100%" }} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 8 }}>
        {cats.map((c) => (
          <button
            key={c.key}
            onClick={() => onCategorySelect(c.key, null)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "var(--text-secondary)",
              fontFamily: "var(--font-mono)",
            }}
            title={`${c.label}: ${formatNumber(Math.round(c.total))} tokens (${formatPct(c.pct, 1)}) — click to drill down`}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: ATTR_COLORS[c.key] || "#5c6675",
                display: "inline-block",
              }}
            />
            {c.label} · {formatTokens(c.total)} ({formatPct(c.pct, 1)})
          </button>
        ))}
      </div>
    </div>
  );
}
