import { useRef, useEffect } from "react";
import * as d3 from "d3";
import { CATEGORY_COLORS, createTooltip } from "../utils/chart";
import { formatTokens, formatNumber, formatPct } from "../utils/format";

export default function BreakdownTreemap({ breakdown, onCategorySelect }) {
  const svgRef = useRef();

  useEffect(() => {
    if (!breakdown?.categories?.length) return;

    const width = 900;
    const height = 400;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const catByLabel = {};
    const hierarchy = {
      name: "root",
      children: breakdown.categories.map((c) => {
        catByLabel[c.label] = c;
        return { name: c.label, value: c.total, type: c.type };
      }),
    };

    const root = d3.hierarchy(hierarchy).sum((d) => d.value);
    d3.treemap().size([width, height]).padding(3).round(true)(root);

    const tooltip = createTooltip(d3);
    const total = breakdown.total || 0;

    svg
      .selectAll("g")
      .data(root.leaves())
      .join("g")
      .attr("transform", (d) => `translate(${d.x0},${d.y0})`)
      .on("click", (event, d) => {
        const cat = breakdown.categories.find((c) => c.label === d.data.name);
        if (cat) onCategorySelect(cat.type);
      })
      .on("mouseover", (event, d) => {
        const cat = catByLabel[d.data.name];
        const pct = total > 0 ? (d.data.value / total) * 100 : 0;
        const items = cat?.items ?? 0;
        tooltip
          .style("opacity", 1)
          .html(
            `<div class="chart-tooltip-title">Category: ${d.data.name}</div>` +
              `<div>Tokens: ${formatNumber(d.data.value)}</div>` +
              `<div>Percentage: ${pct.toFixed(1)}% of total</div>` +
              (items ? `<div>Items: ${items}</div>` : "")
          );
      })
      .on("mousemove", (event) => {
        tooltip
          .style("left", event.pageX + 12 + "px")
          .style("top", event.pageY - 28 + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0))
      .call((g) =>
        g
          .append("rect")
          .attr("width", (d) => d.x1 - d.x0)
          .attr("height", (d) => d.y1 - d.y0)
          .attr("fill", (d) => CATEGORY_COLORS[d.data.name] || "#8b949e")
          .attr("rx", 4)
          .attr("opacity", 0.85)
          .style("cursor", "pointer")
      )
      .call((g) =>
        g
          .append("text")
          .attr("x", 8)
          .attr("y", 16)
          .text((d) => (d.x1 - d.x0 < 70 ? "" : d.data.name))
          .attr("fill", "#fff")
          .attr("font-size", "12px")
          .attr("font-weight", "600")
          .style("pointer-events", "none")
      )
      .call((g) =>
        g
          .append("text")
          .attr("x", 8)
          .attr("y", 32)
          .text((d) => {
            if (d.x1 - d.x0 < 130 || d.y1 - d.y0 < 36) return "";
            return formatTokens(d.data.value) + " tokens";
          })
          .attr("fill", "#fff")
          .attr("font-size", "11px")
          .attr("opacity", 0.9)
          .style("pointer-events", "none")
      )
      .call((g) =>
        g
          .append("text")
          .attr("x", 8)
          .attr("y", 46)
          .text((d) => {
            if (d.x1 - d.x0 < 130 || d.y1 - d.y0 < 52) return "";
            const pct = total > 0 ? (d.data.value / total) * 100 : 0;
            return formatPct(pct);
          })
          .attr("fill", "#fff")
          .attr("font-size", "11px")
          .attr("opacity", 0.75)
          .style("pointer-events", "none")
      )
      .call((g) =>
        g
          .append("text")
          .attr("x", 8)
          .attr("y", 60)
          .text((d) => {
            const cat = catByLabel[d.data.name];
            if (!cat || d.x1 - d.x0 < 200 || d.y1 - d.y0 < 66) return "";
            return `input ${formatTokens(cat.tokens_input)} · cache ${formatTokens(cat.tokens_cache_read)}`;
          })
          .attr("fill", "#fff")
          .attr("font-size", "10px")
          .attr("opacity", 0.6)
          .style("pointer-events", "none")
      );

    return () => {
      tooltip.remove();
    };
  }, [breakdown, onCategorySelect]);

  return (
    <div style={{ overflow: "hidden" }}>
      <svg ref={svgRef} width="100%" style={{ display: "block" }} />
    </div>
  );
}
