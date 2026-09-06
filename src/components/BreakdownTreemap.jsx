import { useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import {
  TREEMAP_FOCUS_EXCLUDE,
  attrLeafColor,
  createTooltip,
} from "../utils/chart";
import { formatTokens, formatNumber, formatPct } from "../utils/format";

function truncate(s, maxChars) {
  if (s.length <= maxChars) return s;
  if (maxChars <= 1) return "";
  return `${s.slice(0, maxChars - 1)}…`;
}

export default function BreakdownTreemap({ attribution, zoomKey, onZoom, onToolSelect, onCategorySelect }) {
  const svgRef = useRef();
  const [focus, setFocus] = useState(true);

  const cats = attribution?.categories || [];
  const total = attribution?.total || 0;

  const excluded = focus ? cats.filter((c) => TREEMAP_FOCUS_EXCLUDE.includes(c.key)) : [];
  const excludedTotal = excluded.reduce((a, c) => a + c.total, 0);
  const visible = cats.filter(
    (c) => (!focus || !TREEMAP_FOCUS_EXCLUDE.includes(c.key)) && (!zoomKey || c.key === zoomKey)
  );

  useEffect(() => {
    if (!visible.length || !svgRef.current) return;

    const width = 960;
    const height = 420;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const hierarchy = {
      name: "root",
      children: visible.map((c) => ({
        name: c.label,
        key: c.key,
        children: c.children.map((l) => ({
          name: l.label,
          value: Math.max(l.value, 0.0001),
          catKey: c.key,
          catLabel: c.label,
          tool: l.tool || null,
          items: l.items || 0,
          estimated: !!l.estimated,
        })),
      })),
    };

    const root = d3.hierarchy(hierarchy).sum((d) => d.value);
    d3.treemap().size([width, height]).paddingOuter(4).paddingInner(3).round(true)(root);

    const tooltip = createTooltip(d3);
    const leaves = root.leaves();
    // Stable leaf ordering per parent for color variation
    const idxByParent = {};
    leaves.forEach((d) => {
      const k = d.data.catKey;
      idxByParent[k] = idxByParent[k] || [];
      idxByParent[k].push(d);
    });
    Object.values(idxByParent).forEach((arr) =>
      arr.sort((a, b) => b.data.value - a.data.value).forEach((d, i) => {
        d.data.colorIdx = i;
        d.data.colorTotal = arr.length;
      })
    );

    const g = svg
      .selectAll("g")
      .data(leaves)
      .join("g")
      .attr("transform", (d) => `translate(${d.x0},${d.y0})`)
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        if (d.data.tool) onToolSelect(d.data.tool, d.data.name, d.data.catKey);
        else if (!zoomKey) onZoom(d.data.catKey);
        else if (onCategorySelect) onCategorySelect(d.data.catKey, d.data.name);
      })
      .on("mouseover", (event, d) => {
        const pct = total > 0 ? (d.data.value / total) * 100 : 0;
        tooltip
          .style("opacity", 1)
          .html(
            `<div class="chart-tooltip-title">${d.data.name}</div>` +
              `<div>${d.data.catLabel} · ${formatNumber(Math.round(d.data.value))} tokens</div>` +
              `<div class="chart-tooltip-sub">${formatPct(pct, 1)} of total` +
              (d.data.items ? ` · ${d.data.items.toLocaleString()} items` : "") +
              (d.data.estimated ? " · estimated" : "") +
              `</div>` +
              (d.data.tool
                ? `<div class="chart-tooltip-sub">Click to list ${d.data.name} calls</div>`
                : !zoomKey
                  ? `<div class="chart-tooltip-sub">Click to zoom</div>`
                  : "")
          );
      })
      .on("mousemove", (event) => {
        tooltip
          .style("left", event.pageX + 12 + "px")
          .style("top", event.pageY - 28 + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0));

    g.append("rect")
      .attr("width", (d) => Math.max(d.x1 - d.x0, 0))
      .attr("height", (d) => Math.max(d.y1 - d.y0, 0))
      .attr("fill", (d) => attrLeafColor(d.data.catKey, d.data.colorIdx, d.data.colorTotal))
      .attr("rx", 5)
      .attr("opacity", 0.92);

    const text = (dy, size, weight, opacity, show) =>
      g
        .append("text")
        .attr("x", 8)
        .attr("y", dy)
        .text((d) => {
          const w = d.x1 - d.x0;
          const h = d.y1 - d.y0;
          const s = show(d);
          if (!s) return "";
          return truncate(s, Math.max(0, Math.floor((w - 12) / 6.5)));
        })
        .attr("fill", "#fff")
        .attr("font-size", `${size}px`)
        .attr("font-weight", weight)
        .attr("opacity", opacity)
        .style("pointer-events", "none");

    text(17, 12.5, 600, 1, (d) => (d.x1 - d.x0 >= 44 && d.y1 - d.y0 >= 20 ? d.data.name : ""));
    text(33, 11, 400, 0.92, (d) =>
      d.x1 - d.x0 >= 96 && d.y1 - d.y0 >= 38 ? formatTokens(d.data.value) : ""
    );
    text(47, 11, 400, 0.75, (d) => {
      if (d.x1 - d.x0 < 96 || d.y1 - d.y0 < 54) return "";
      const pct = total > 0 ? (d.data.value / total) * 100 : 0;
      return formatPct(pct, 1);
    });

    return () => {
      tooltip.remove();
    };
  }, [attribution, zoomKey, focus, onZoom, onToolSelect, onCategorySelect]);

  if (!cats.length) return null;

  const zoomCat = zoomKey ? cats.find((c) => c.key === zoomKey) : null;

  return (
    <div className="treemap-wrap">
      <div className="treemap-bar">
        <div className="treemap-crumbs">
          {zoomCat ? (
            <>
              <button className="link-btn" onClick={() => onZoom(null)}>
                All categories
              </button>
              <span className="crumb-sep">/</span>
              <span className="crumb-current">{zoomCat.label}</span>
            </>
          ) : (
            <span className="crumb-current">All categories</span>
          )}
        </div>
        <button className="link-btn" onClick={() => setFocus(!focus)}>
          {focus ? "Show system & history" : "Focus on work"}
        </button>
      </div>
      {excludedTotal > 0 && (
        <div className="treemap-note">
          Focus hides {excluded.map((c) => c.label).join(" + ")} ({formatPct((excludedTotal / total) * 100, 1)} of
          total)
        </div>
      )}
      {visible.length === 0 || visible.every((c) => !c.children.length) ? (
        <div className="treemap-empty">Nothing to show in this view</div>
      ) : (
        <svg ref={svgRef} width="100%" style={{ display: "block" }} />
      )}
    </div>
  );
}
