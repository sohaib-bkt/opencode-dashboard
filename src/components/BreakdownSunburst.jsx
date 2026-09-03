import { useRef, useEffect } from "react";
import * as d3 from "d3";
import { CATEGORY_COLORS, createTooltip } from "../utils/chart";

export default function BreakdownSunburst({ breakdown, onCategorySelect }) {
  const svgRef = useRef();

  useEffect(() => {
    if (!breakdown?.categories?.length) return;

    const width = 500;
    const height = 500;
    const radius = width / 2;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g").attr("transform", `translate(${radius},${radius})`);

    const hierarchy = {
      name: "root",
      children: breakdown.categories.map((c) => ({
        name: c.label,
        value: c.total,
        type: c.type,
      })),
    };

    const root = d3.hierarchy(hierarchy).sum((d) => d.value);
    const partition = d3.partition().size([2 * Math.PI, radius]);
    partition(root);

    const arc = d3.arc().startAngle((d) => d.x0).endAngle((d => d.x1)).innerRadius((d) => d.y0).outerRadius((d) => d.y1 - 1);

    const tooltip = createTooltip(d3);

    g.selectAll("path")
      .data(root.descendants().filter((d) => d.depth > 0))
      .join("path")
      .attr("d", arc)
      .attr("fill", (d) => CATEGORY_COLORS[d.data.name] || "#8b949e")
      .attr("opacity", 0.85)
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        const cat = breakdown.categories.find((c) => c.label === d.data.name);
        if (cat) onCategorySelect(cat.type);
      })
      .on("mouseover", (event, d) => {
        tooltip
          .style("opacity", 1)
          .html(`${d.data.name}<br/>${d.data.value.toLocaleString()} tokens`);
      })
      .on("mousemove", (event) => {
        tooltip
          .style("left", event.pageX + 12 + "px")
          .style("top", event.pageY - 28 + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0));

    // Center label
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("fill", "var(--text-primary)")
      .attr("font-size", "14px")
      .attr("font-family", "var(--font-mono)")
      .text("Click to drill down");

    return () => {
      tooltip.remove();
    };
  }, [breakdown, onCategorySelect]);

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <svg ref={svgRef} width="500" height="500" style={{ display: "block" }} />
    </div>
  );
}
