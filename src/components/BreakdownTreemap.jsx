import { useRef, useEffect } from "react";
import * as d3 from "d3";

const COLORS = {
  "Tool calls": "#58a6ff",
  Messages: "#3fb950",
  Reasoning: "#bc8cff",
  "System/setup": "#8b949e",
  "File operations": "#d29922",
  Compaction: "#f85149",
};

export default function BreakdownTreemap({ breakdown, onCategorySelect }) {
  const svgRef = useRef();

  useEffect(() => {
    if (!breakdown?.categories?.length) return;

    const width = 900;
    const height = 400;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const hierarchy = {
      name: "root",
      children: breakdown.categories.map((c) => ({
        name: c.label,
        value: c.total,
        type: c.type,
      })),
    };

    const root = d3.hierarchy(hierarchy).sum((d) => d.value);
    d3.treemap().size([width, height]).padding(3).round(true)(root);

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
        tooltip
          .style("opacity", 1)
          .html(`${d.data.name}<br/>${d.data.value.toLocaleString()} tokens`);
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
          .attr("fill", (d) => COLORS[d.data.name] || "#8b949e")
          .attr("rx", 4)
          .attr("opacity", 0.85)
          .style("cursor", "pointer")
      )
      .call((g) =>
        g
          .append("text")
          .attr("x", 8)
          .attr("y", 20)
          .text((d) => {
            const w = d.x1 - d.x0;
            if (w < 60) return "";
            return d.data.name;
          })
          .attr("fill", "#fff")
          .attr("font-size", "12px")
          .attr("font-weight", "600")
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
