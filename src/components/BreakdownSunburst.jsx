import { useRef, useEffect, useState } from "react";
import * as d3 from "d3";

const COLORS = {
  "Tool calls": "#58a6ff",
  Messages: "#3fb950",
  Reasoning: "#bc8cff",
  "System/setup": "#8b949e",
  "File operations": "#d29922",
  Compaction: "#f85149",
};

export default function BreakdownSunburst({ breakdown, onCategorySelect }) {
  const svgRef = useRef();
  const [zoomed, setZoomed] = useState(null);

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

    const tooltip = d3
      .select("body")
      .append("div")
      .style("position", "absolute")
      .style("background", "var(--bg-card)")
      .style("border", "1px solid var(--border)")
      .style("border-radius", "6px")
      .style("padding", "8px 12px")
      .style("font-family", "var(--font-mono)")
      .style("font-size", "12px")
      .style("color", "var(--text-primary)")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("z-index", 1000);

    g.selectAll("path")
      .data(root.descendants().filter((d) => d.depth > 0))
      .join("path")
      .attr("d", arc)
      .attr("fill", (d) => COLORS[d.data.name] || "#8b949e")
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
