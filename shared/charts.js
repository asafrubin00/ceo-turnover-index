import {
  buildCoverageNote,
  buildInsight,
  describeVisibleRange,
  displayLabel,
  formatCount,
  formatPct,
  formatYears,
  isValue,
  viewMeta,
} from "./data.js";

const palette = {
  incoming: "#7f9fbd",
  outgoing: "#b39a62",
  tenure: "#b39a62",
  women: "#b39a62",
  men: "#7f9fbd",
  internal: "#7f9fbd",
  external: "#b39a62",
  neutral: "#4a5f75",
  spotlight: "#b39a62",
};

const mapCoordinates = {
  ASX200: { x: 760, y: 262 },
  CAC40: { x: 394, y: 122 },
  DAX40: { x: 412, y: 112 },
  EuroNext100: { x: 402, y: 118 },
  FTSE100: { x: 376, y: 100 },
  FTSE250: { x: 376, y: 100 },
  HANGSENG: { x: 696, y: 168 },
  NSENifty50: { x: 616, y: 184 },
  Nikkei225: { x: 742, y: 136 },
  SMI: { x: 399, y: 118 },
  SP500: { x: 192, y: 130 },
  "SPTSX Composite": { x: 187, y: 99 },
  STI: { x: 663, y: 223 },
};

let tooltipNode;

export function initTooltip(node) {
  tooltipNode = node;
}

export function applyTooltipWiring(container) {
  container.querySelectorAll("[data-tooltip]").forEach((node) => {
    node.addEventListener("mouseenter", showTooltip);
    node.addEventListener("mousemove", moveTooltip);
    node.addEventListener("mouseleave", hideTooltip);
  });
}

function showTooltip(event) {
  if (!tooltipNode) return;
  tooltipNode.innerHTML = event.currentTarget.dataset.tooltip;
  tooltipNode.hidden = false;
  moveTooltip(event);
}

function moveTooltip(event) {
  if (!tooltipNode) return;
  tooltipNode.style.transform = `translate(${event.clientX + 14}px, ${event.clientY + 14}px)`;
}

function hideTooltip() {
  if (tooltipNode) tooltipNode.hidden = true;
}

export function renderKpis(container, context) {
  const { latestPoint } = context;
  if (!latestPoint) {
    container.innerHTML = "";
    return;
  }

  const cards = [
    {
      label: "Incoming appointments",
      value: formatCount(latestPoint.incomingCount),
      footLeft: `Rate ${formatPct(latestPoint.incomingPct)}`,
    },
    {
      label: "Outgoing departures",
      value: formatCount(latestPoint.outgoingCount),
      footLeft: `Rate ${formatPct(latestPoint.outgoingPct)}`,
    },
    {
      label: "Average outgoing tenure",
      value: formatYears(latestPoint.avgOutgoingTenureYears),
      footLeft: latestPoint.periodLabel,
    },
    {
      label: "Companies in scope",
      value: formatCount(latestPoint.companyCount),
      footLeft: latestPoint.displaySegment,
    },
  ];

  container.innerHTML = cards
    .map(
      (card) => `
        <article class="kpi-item">
          <div class="kpi-label">${card.label}</div>
          <h3 class="kpi-value">${card.value}</h3>
          <div class="kpi-foot">${card.footLeft}</div>
        </article>
      `
    )
    .join("");
}

export function updateHomeMeta(context, els, view) {
  const comparing = view === "flagship" && context.benchmarkSeries.length > 0;
  els.chartTitle.textContent = comparing ? "CEO departure rates by benchmark" : viewMeta[view].title;
  els.chartContext.textContent = comparing
    ? `Selected segment · ${displayLabel(context.state.segment)}`
    : context.latestPoint
      ? `${context.latestPoint.displaySegment} · ${context.latestPoint.periodLabel}`
      : "";
  els.coverageNote.textContent = buildCoverageNote(context.selectedCoverage);
}

export function renderHomeView(container, view, context) {
  if (view === "flagship") renderTrendChart(container, context);
  if (view === "regional") renderRegionalChart(container, context);
  if (view === "segment") renderSegmentChart(container, context.comparisonRows, context.state.segment);
  if (view === "tenure") renderTenureChart(container, context.visibleSeries);
  if (view === "gender") renderCompositionChart(container, context.genderRows, "gender");
  if (view === "appointments") renderCompositionChart(container, context.appointmentRows, "appointment");
}

export function renderManualCharts(registry, context) {
  renderTrendChart(registry.flagship, context);
  renderRegionalChart(registry.regional, context);
  renderSegmentChart(registry.segment, context.comparisonRows, context.state.segment);
  renderTenureChart(registry.tenure, context.visibleSeries);
  renderCompositionChart(registry.gender, context.genderRows, "gender");
  renderCompositionChart(registry.appointment, context.appointmentRows, "appointment");
}

export function buildDefaultAnalysisMarkup() {
  return `
    <p>CEO succession decisions affect governance stability, strategic continuity, and market confidence across major listed companies.</p>
    <p>Select a view and adjust filters to generate a focused reading of the current chart.</p>
  `;
}

export function buildAnalysisSummary(context, view) {
  return {
    coverageNote: buildCoverageNote(context.selectedCoverage),
    visibleRange: describeVisibleRange(context.visibleSeries),
    insight: buildInsight(context),
    latestIncomingRate: formatPct(context.latestPoint?.incomingPct),
    latestOutgoingRate: formatPct(context.latestPoint?.outgoingPct),
    latestIncomingCount: formatCount(context.latestPoint?.incomingCount),
    latestOutgoingCount: formatCount(context.latestPoint?.outgoingCount),
    latestTenure: formatYears(context.latestPoint?.avgOutgoingTenureYears),
    segmentLeader: context.comparisonRows[0]
      ? `${context.comparisonRows[0].displaySegment} at ${formatPct(context.comparisonRows[0].outgoingPct)}`
      : "No segment comparison available",
    view,
  };
}

const benchmarkColors = ["#7f9fbd", "#8fb3a4", "#b07f62", "#9a8fb8", "#c08c5c", "#8c8a62", "#6f93b0"];

export function getTrendData(context) {
  const { state, visibleSeries, benchmarkSeries } = context;
  const primary = { segment: state.segment, rows: visibleSeries };
  const isComparison = benchmarkSeries.length > 0;
  const series = [primary, ...benchmarkSeries];
  const periodsByKey = new Map();
  series.forEach(({ rows }) => rows.forEach((row) => periodsByKey.set(row.sortValue, row)));
  const periods = [...periodsByKey.values()].sort((a, b) => a.sortValue - b.sortValue);
  const definitions = isComparison
    ? series.map(({ segment, rows }, index) => ({
        label: displayLabel(segment),
        rows,
        flow: "outgoing",
        color: index === 0 ? "#b39a62" : benchmarkColors[(index - 1) % benchmarkColors.length],
        dash: index > benchmarkColors.length ? [3, 4] : [],
      }))
    : [
        { label: "Departures", rows: visibleSeries, flow: "outgoing", color: "#b39a62", dash: [] },
        { label: "Appointments", rows: visibleSeries, flow: "incoming", color: "#7f9fbd", dash: [] },
      ];
  const lines = definitions.map(({ label, rows, flow, color, dash }) => {
    const rowsByPeriod = new Map(rows.map((row) => [row.sortValue, row]));
    const points = periods.map(({ sortValue }) => {
      const row = rowsByPeriod.get(sortValue);
      const rate = row?.[`${flow}Pct`];
      return isValue(rate) ? { rate, count: row[`${flow}Count`] } : null;
    });
    return { label, color, dash, points };
  });
  return { periods, lines };
}

function renderTrendChart(container, context) {
  const { periods, lines } = getTrendData(context);
  if (!periods.length) return renderEmpty(container, "No turnover data for the selected period.");

  const width = 760;
  const height = 292;
  const margin = { top: 18, right: 34, bottom: 34, left: 52 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(...lines.flatMap((line) => line.points.map((point) => point?.rate ?? 0)), 1);
  const xFor = (i) => margin.left + (periods.length === 1 ? innerWidth / 2 : (i / (periods.length - 1)) * innerWidth);
  const yFor = (value) => margin.top + innerHeight - (value / maxValue) * innerHeight;

  container.innerHTML = `
    <div class="trend-fallback">
      <ul class="trend-legend">
        ${lines.map(({ label, color, dash }) => `<li><span style="--line-color:${color}; --line-style:${dash.length ? "dashed" : "solid"}"></span>${label}</li>`).join("")}
      </ul>
      <svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="Quarterly turnover trend">
        ${yGrid(maxValue, margin, width, yFor, true)}
        ${sparseIndices(periods.length, 5).map((index) => `<text x="${xFor(index)}" y="${height - 9}" text-anchor="middle" class="tick-text">${periods[index].periodLabel}</text>`).join("")}
        ${lines.map(({ label, color, dash, points }) => {
          const path = points.map((point, index) => point
            ? `${points[index - 1] ? "L" : "M"} ${xFor(index)} ${yFor(point.rate)}`
            : "").join(" ");
          const markers = points.map((point, index) => point ? `
            <circle cx="${xFor(index)}" cy="${yFor(point.rate)}" r="3" fill="${color}"
              data-tooltip="<strong>${label} · ${periods[index].periodLabel}</strong><span>${formatPct(point.rate)} · ${formatCount(point.count)} CEOs</span>" />
          ` : "").join("");
          return `<path d="${path}" stroke="${color}" stroke-dasharray="${dash.join(" ")}" class="chart-line" />${markers}`;
        }).join("")}
      </svg>
    </div>
  `;
  applyTooltipWiring(container);
}

function renderRegionalChart(container, context) {
  const nodes = context.mapRows;
  if (!nodes.length) return renderEmpty(container, "No regional benchmark values are available.");
  const width = 860;
  const height = 278;
  const maxValue = Math.max(...nodes.map((row) => row.outgoingPct || 0), 1);

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" aria-label="regional view">
      <g class="map-grid">
        <line x1="68" y1="68" x2="790" y2="68" />
        <line x1="68" y1="116" x2="790" y2="116" />
        <line x1="68" y1="164" x2="790" y2="164" />
        <line x1="68" y1="212" x2="790" y2="212" />
      </g>
      <g class="map-continents">
        <path d="M87 132l22-29 39-13 48-2 38 14 23 15 11 26-17 22-16 5-2 21-28 20-34-8-16-21-27-10-23-40-18-4z" />
        <path d="M278 103l24-21 64-11 63 4 38 18 9 20-15 16 8 18-11 19-18 2-19 17-15 34-31 9-25-16-16 13-30-8-16-34-24-21-11-31 15-17z" />
        <path d="M448 108l44-22 70-6 70 9 60 28 33 25 32 1 32 22-7 22-22 17-27-3-21 19-42 11-17 27-37 4-19-13-21 6-13 19-40 11-39-16-18-30-25-15-21-45 10-31z" />
        <path d="M635 281l32-8 36 8 26 22-6 31-31 22-40 2-20-15-4-29z" />
        <path d="M732 108l27-12 27 11-10 16-19 5-25-7z" />
      </g>
      ${nodes
        .filter((row) => mapCoordinates[row.segment])
        .map((row) => {
          const coord = mapCoordinates[row.segment];
          const radius = 6 + ((row.outgoingPct || 0) / maxValue) * 12;
          const selected = row.segment === context.state.segment;
          return `
            <g class="map-node" data-tooltip="<strong>${row.displaySegment}</strong><span>${row.periodLabel}<br />Outgoing rate ${formatPct(row.outgoingPct)}<br />Outgoing count ${formatCount(row.outgoingCount)}</span>">
              <circle cx="${coord.x}" cy="${coord.y}" r="${radius + (selected ? 6 : 3)}" fill="${selected ? "rgba(179,154,98,0.2)" : "rgba(127,159,189,0.14)"}" />
              <circle cx="${coord.x}" cy="${coord.y}" r="${radius}" fill="${selected ? palette.spotlight : palette.incoming}" />
              <text x="${coord.x}" y="${coord.y - radius - 8}" text-anchor="middle" class="tick-text">${row.displaySegment}</text>
            </g>
          `;
        })
        .join("")}
      ${
        context.state.scope === "industry"
          ? `<text x="430" y="262" text-anchor="middle" class="annotation-text">Industry mode reuses the benchmark map as a geographic market reference because the source data is sector-based rather than location-based.</text>`
          : ""
      }
    </svg>
  `;
  applyTooltipWiring(container);
}

function renderSegmentChart(container, rows, currentSegment) {
  if (!rows.length) return renderEmpty(container, "No segment comparison is available for this filter.");
  const width = 780;
  const height = Math.max(218, rows.length * 24 + 16);
  const margin = { top: 8, right: 46, bottom: 8, left: 164 };
  const innerWidth = width - margin.left - margin.right;
  const maxValue = Math.max(...rows.map((row) => row.outgoingPct || 0), 1);

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" aria-label="segment comparison">
      ${rows
        .map((row, index) => {
          const y = margin.top + index * 22;
          const widthValue = ((row.outgoingPct || 0) / maxValue) * innerWidth;
          const active = row.segment === currentSegment;
          return `
            <text x="${margin.left - 9}" y="${y + 11}" text-anchor="end" class="tick-text">${row.displaySegment}</text>
            <rect x="${margin.left}" y="${y}" width="${innerWidth}" height="12" rx="2" fill="rgba(46,59,79,0.35)" />
            <rect x="${margin.left}" y="${y}" width="${widthValue}" height="12" rx="2" fill="${active ? palette.spotlight : palette.neutral}" class="chart-pill" data-tooltip="<strong>${row.displaySegment}</strong><span>${row.periodLabel}<br />Outgoing rate ${formatPct(row.outgoingPct)}<br />Outgoing count ${formatCount(row.outgoingCount)}</span>" />
            <text x="${margin.left + widthValue + 6}" y="${y + 10.5}" class="value-text">${formatPct(row.outgoingPct)}</text>
          `;
        })
        .join("")}
    </svg>
  `;
  applyTooltipWiring(container);
}

function renderTenureChart(container, rows) {
  const points = rows.filter((row) => isValue(row.avgOutgoingTenureYears));
  if (!points.length) return renderEmpty(container, "No tenure values are available for this filter.");

  const width = 760;
  const height = 228;
  const margin = { top: 12, right: 14, bottom: 30, left: 34 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(...points.map((row) => row.avgOutgoingTenureYears || 0), 1);
  const xFor = (i) => margin.left + (points.length === 1 ? innerWidth / 2 : (i / (points.length - 1)) * innerWidth);
  const yFor = (value) => margin.top + innerHeight - (value / maxValue) * innerHeight;

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" aria-label="tenure chart">
      ${yGrid(maxValue, margin, width, yFor, false)}
      ${sparseIndices(points.length, 5).map((index) => `<text x="${xFor(index)}" y="${height - 8}" text-anchor="middle" class="tick-text">${points[index].periodLabel}</text>`).join("")}
      ${points
        .map((row, index) => {
          const x = xFor(index);
          const y = yFor(row.avgOutgoingTenureYears);
          return `
            <line x1="${x}" y1="${margin.top + innerHeight}" x2="${x}" y2="${y}" stroke="rgba(179,154,98,0.22)" stroke-width="1" />
            <circle cx="${x}" cy="${y}" r="3" fill="${palette.tenure}" data-tooltip="<strong>${row.periodLabel}</strong><span>Outgoing tenure ${formatYears(row.avgOutgoingTenureYears)}</span>" />
          `;
        })
        .join("")}
    </svg>
  `;
  applyTooltipWiring(container);
}

function renderCompositionChart(container, rows, type) {
  if (!rows.length) {
    const message =
      type === "gender"
        ? "No extracted gender split values are populated for this selection."
        : "No extracted appointment split values are populated for this selection.";
    return renderEmpty(container, message);
  }

  const ordered = type === "gender" ? ["Women", "Men"] : ["Internal", "External"];
  const colors =
    type === "gender"
      ? { Women: palette.women, Men: palette.men }
      : { Internal: palette.internal, External: palette.external };
  const lookup = new Map(rows.map((row) => [`${row.flow}:${row.splitValue}`, row]));
  const flows = ["incoming", "outgoing"];
  const width = 720;
  const height = 228;
  const barWidth = 176;
  const topY = 14;
  const usableHeight = 132;
  const startX = 74;

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" aria-label="composition chart">
      ${flows
        .map((flow, index) => {
          const x = startX + index * 270;
          let cursor = topY;
          return `
            ${ordered
              .map((value) => lookup.get(`${flow}:${value}`))
              .filter(Boolean)
              .map((part) => {
                const h = (part.pctValue / 100) * usableHeight;
                const y = cursor;
                cursor += h;
                return `
                  <rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="2" fill="${colors[part.splitValue]}" class="chart-bar" data-tooltip="<strong>${capitalize(flow)} · ${part.splitValue}</strong><span>${part.periodLabel}<br />Share ${formatPct(part.pctValue)}<br />Count ${formatCount(part.countValue)}</span>" />
                  <text x="${x + barWidth / 2}" y="${y + h / 2 + 4}" text-anchor="middle" class="value-text">${h > 34 ? formatPct(part.pctValue) : ""}</text>
                `;
              })
              .join("")}
            <text x="${x + barWidth / 2}" y="${height - 10}" text-anchor="middle" class="tick-text">${capitalize(flow)}</text>
          `;
        })
        .join("")}
      ${ordered
        .map(
          (value, index) => `
            <rect x="${24 + index * 138}" y="188" width="9" height="9" rx="2" fill="${colors[value]}" />
            <text x="${38 + index * 138}" y="196" class="legend-text">${value}</text>
          `
        )
        .join("")}
    </svg>
  `;
  applyTooltipWiring(container);
}

function renderEmpty(container, message) {
  container.innerHTML = `<div class="empty-panel"><p>${message}</p></div>`;
}

function yGrid(maxValue, margin, width, yFor, usePct) {
  return [0, 0.25, 0.5, 0.75, 1]
    .map((fraction) => {
      const value = maxValue * fraction;
      const y = yFor(value);
      return `
        <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" class="grid-line" />
        <text x="${margin.left - 10}" y="${y + 4}" text-anchor="end" class="tick-text">${usePct ? `${value.toFixed(1)}%` : value.toFixed(1)}</text>
      `;
    })
    .join("");
}

function sparseIndices(length, target) {
  if (length <= target) return Array.from({ length }, (_, index) => index);
  return Array.from({ length: target + 1 }, (_, index) => Math.round((index / target) * (length - 1))).filter(
    (value, index, arr) => arr.indexOf(value) === index
  );
}

function capitalize(value) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
