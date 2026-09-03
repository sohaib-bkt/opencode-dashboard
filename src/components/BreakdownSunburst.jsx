import { useRef, useEffect } from "react";
import * as d3 from "d3";
import { CATEGORY_COLORS, createTooltip } from "../utils/chart";
import { formatTokens, formatNumber } from "../utils/format";

export default function BreakdownSunburst({ breakdown, onCategorySelect }) {
  const svgRef = useRef();

  useEffect(() => {
    if (!breakdown?.categories?.length) return;

    const width = 520;
    const height = 520;
    const radius = width / 2;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g").attr("transform", `translate(${width / 2},${height / 2})`);

    const catByLabel = {};
    const hierarchy = {
      name: "root",
      children: breakdown.categories.map((c) => {
        catByLabel[c.label] = c;
        return { name: c.label, value: c.total, type: c.type };
      }),
    };

    const root = d3.hierarchy(hierarchy).sum((d) => d.value);
    const partition = d3.partition().size([2 * Math.PI, radius]);
    partition(root);

    const arc = d3.arc().startAngle((d) => d.x0).endAngle((d) => d.x1).innerRadius((d) => d.y0).outerRadius((d) => d.y1 - 1);

    const tooltip = createTooltip(d3);
    const total = breakdown.total || 0;

    const slice = g
      .selectAll("path")
      .data(root.descendants().filter((d) => d.depth > 0))
      .join("path")
      .attr("d", arc)
      .attr("fill", (d) => (d.depth === 1 ? CATEGORY_COLORS[d.data.name] || "#8b949e" : "var(--text-secondary)"))
      .attr("opacity", (d) => (d.depth === 1 ? 0.85 : 0.6))
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        const cat = breakdown.categories.find((c) => c.label === d.data.name);
        if (cat) onCategorySelect(cat.type);
      })
      .on("mouseover", (event, d) => {
        const parentValue = d.parent ? d.parent.value : total;
        const pctTotal = total > 0 ? (d.value / total) * 100 : 0;
        const pctParent = parentValue > 0 ? (d.value / parentValue) * 100 : 0;
        const cat = catByLabel[d.data.name];
        let html =
          `<div class="chart-tooltip-title">${d.data.name}</div>` +
          `<div>Tokens: ${formatNumber(d.value)}</div>` +
          `<div>${pctTotal.toFixed(1)}% of total</div>`;
        if (d.depth === 1) {
          html += `<div>${pctParent.toFixed(1)}% of parent</div>`;
          if (cat?.items) html += `<div>Items: ${cat.items}</div>`;
        } else {
          html += `<div>${pctParent.toFixed(1)}% of ${d.parent.data.name}</div>`;
        }
        tooltip.style("opacity", 1).html(html);
      })
      .on("mousemove", (event) => {
        tooltip.style("left", event.pageX + 12 + "px").style("top", event.pageY - 28 + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0));

    // arc labels for large-enough segments
    slice
      .filter((d) => d.depth === 1 && d.x1 - d.x0 > 0.35 && d.y1 - d.y0 > 24)
      .append("text")
      .attr("transform", (d) => {
        const mid = (d.x0 + d.x1) / 2;
        return `translate(${Math.sin(mid) * ((d.y0 + d.y1) / 2)},${-Math.cos(mid) * ((d.y0 + d.y1) / 2)}) rotate(${(mid * 180) / Math.PI - 90})`;
      })
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("fill", "#0d1117")
      .attr("font-size", "10px")
      .attr("font-weight", "600")
      .text((d) => d.data.name);

    // Center label
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
      .attr("dy", "1.4em")
      .attr("fill", "var(--text-secondary)")
      .attr("font-size", "11px")
      .attr("font-family", "var(--font-mono)")
      .text("total tokens");

    return () => {
      tooltip.remove();
    };
  }, [breakdown, onCategorySelect]);

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <svg ref={svgRef} width="520" height="520" style={{ display: "block" }} />
    </div>
  );
}
