const DATA_FILES = {
  indexMetrics: "./data/index_quarterly_metrics.csv",
  indexSplits: "./data/index_quarterly_splits.csv",
  industryMetrics: "./data/industry_quarterly_metrics.csv",
  industrySplits: "./data/industry_quarterly_splits.csv",
  denominators: "./data/denominators_companies.csv",
};

const state = {
  scope: "index",
  segment: "Global",
  year: "All",
  quarter: "All",
};

const quarterLabels = {
  1: "Q1",
  2: "Q2",
  3: "Q3",
  4: "Q4",
};

const scopeLabels = {
  index: "Index",
  industry: "Industry",
};

const colors = {
  incoming: "#0e5a5a",
  outgoing: "#9a3b35",
  tenure: "#9c6b2f",
  grid: "rgba(19, 33, 42, 0.12)",
  text: "#13212a",
  muted: "#5e6c73",
  fill: "rgba(14, 90, 90, 0.12)",
  bar: "#16384b",
  women: "#9c6b2f",
  men: "#0e5a5a",
  internal: "#0e5a5a",
  external: "#9c6b2f",
};

const els = {
  scopeToggle: document.getElementById("scope-toggle"),
  segmentSelect: document.getElementById("segment-select"),
  yearSelect: document.getElementById("year-select"),
  quarterSelect: document.getElementById("quarter-select"),
  kpiGrid: document.getElementById("kpi-grid"),
  trendChart: document.getElementById("trend-chart"),
  tenureChart: document.getElementById("tenure-chart"),
  comparisonChart: document.getElementById("comparison-chart"),
  genderChart: document.getElementById("gender-chart"),
  appointmentChart: document.getElementById("appointment-chart"),
  trendNote: document.getElementById("trend-note"),
  genderNote: document.getElementById("gender-note"),
  appointmentNote: document.getElementById("appointment-note"),
  comparisonTitle: document.getElementById("comparison-title"),
  coverageReliable: document.getElementById("coverage-reliable"),
  coverageSegments: document.getElementById("coverage-segments"),
  coverageLatest: document.getElementById("coverage-latest"),
};

let dataset = null;

initialize();

async function initialize() {
  try {
    const [indexMetrics, indexSplits, industryMetrics, industrySplits, denominators] =
      await Promise.all(Object.values(DATA_FILES).map(fetchCsv));

    dataset = {
      metrics: {
        index: normalizeMetrics(indexMetrics),
        industry: normalizeMetrics(industryMetrics),
      },
      splits: {
        index: normalizeSplits(indexSplits),
        industry: normalizeSplits(industrySplits),
      },
      denominators: normalizeDenominators(denominators),
    };

    bindEvents();
    populateYearOptions();
    refreshSegmentOptions();
    render();
  } catch (error) {
    console.error(error);
    document.body.innerHTML = `<main class="page-shell"><div class="card empty-state"><div><h2>Data could not be loaded</h2><p>Run this project from a local web server so the browser can fetch the CSV files.</p></div></div></main>`;
  }
}

function bindEvents() {
  els.scopeToggle.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-scope]");
    if (!button) return;
    state.scope = button.dataset.scope;
    [...els.scopeToggle.querySelectorAll("button")].forEach((node) => {
      node.classList.toggle("active", node === button);
    });
    refreshSegmentOptions();
    render();
  });

  els.segmentSelect.addEventListener("change", () => {
    state.segment = els.segmentSelect.value;
    render();
  });

  els.yearSelect.addEventListener("change", () => {
    state.year = els.yearSelect.value;
    render();
  });

  els.quarterSelect.addEventListener("change", () => {
    state.quarter = els.quarterSelect.value;
    render();
  });
}

async function fetchCsv(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path}`);
  return parseCsv(await response.text());
}

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current);
      if (row.length > 1 || row[0]) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  if (current || row.length) {
    row.push(current);
    rows.push(row);
  }

  const [header, ...body] = rows;
  return body.map((cells) =>
    header.reduce((acc, key, index) => {
      acc[key] = cells[index] ?? "";
      return acc;
    }, {})
  );
}

function normalizeMetrics(rows) {
  return rows.map((row) => ({
    year: Number(row.year),
    quarter: Number(row.quarter),
    segment: row.segment,
    incomingCount: toNumber(row.incoming_count),
    incomingPct: toNumber(row.incoming_pct),
    outgoingCount: toNumber(row.outgoing_count),
    outgoingPct: toNumber(row.outgoing_pct),
    avgOutgoingTenureYears: toNumber(row.avg_outgoing_tenure_years),
    companyCount: toNumber(row.company_count),
    periodLabel: `${row.year} ${quarterLabels[Number(row.quarter)]}`,
    sortValue: Number(row.year) * 10 + Number(row.quarter),
  }));
}

function normalizeSplits(rows) {
  return rows.map((row) => ({
    year: Number(row.year),
    quarter: Number(row.quarter),
    segment: row.segment,
    flow: row.flow,
    splitType: row.split_type,
    splitValue: row.split_value,
    countValue: toNumber(row.count_value),
    pctValue: toNumber(row.pct_value),
    periodLabel: `${row.year} ${quarterLabels[Number(row.quarter)]}`,
    sortValue: Number(row.year) * 10 + Number(row.quarter),
  }));
}

function normalizeDenominators(rows) {
  return rows.map((row) => ({
    year: Number(row.year),
    quarter: Number(row.quarter),
    scope: row.scope,
    segment: row.segment,
    companyCount: toNumber(row.company_count),
    sortValue: Number(row.year) * 10 + Number(row.quarter),
  }));
}

function toNumber(value) {
  if (value === "") return null;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
}

function populateYearOptions() {
  const years = [...new Set(dataset.metrics.index.map((row) => row.year))].sort((a, b) => a - b);
  els.yearSelect.innerHTML = ['<option value="All">All years</option>']
    .concat(years.map((year) => `<option value="${year}">${year}</option>`))
    .join("");
}

function refreshSegmentOptions() {
  const options = getAvailableSegments(state.scope);
  if (!options.includes(state.segment)) {
    state.segment = "Global";
  }
  els.segmentSelect.innerHTML = options
    .map((segment) => `<option value="${segment}">${segment}</option>`)
    .join("");
  els.segmentSelect.value = state.segment;
}

function getAvailableSegments(scope) {
  const metrics = dataset.metrics[scope];
  const score = new Map();

  metrics.forEach((row) => {
    const current = score.get(row.segment) ?? 0;
    const filled =
      row.incomingPct !== null || row.outgoingPct !== null || row.avgOutgoingTenureYears !== null;
    score.set(row.segment, current + (filled ? 1 : 0));
  });

  return [...score.entries()]
    .filter(([segment, count]) => segment === "Global" || count >= 6)
    .sort((a, b) => {
      if (a[0] === "Global") return -1;
      if (b[0] === "Global") return 1;
      return a[0].localeCompare(b[0]);
    })
    .map(([segment]) => segment);
}

function render() {
  const metrics = getMetricSeries(state.scope, state.segment);
  const filteredMetrics = applyTimeFilter(metrics);
  const latestMetric = filteredMetrics[filteredMetrics.length - 1] ?? metrics[metrics.length - 1];
  const comparisonRows = getComparisonRows();
  const latestSplitPeriod = getLatestSplitPeriod(state.scope, state.segment);
  const genderRows = getSplitRows(state.scope, state.segment, "incoming", "gender", latestSplitPeriod);
  const appointmentRows = getSplitRows(
    state.scope,
    state.segment,
    "incoming",
    "appointment",
    latestSplitPeriod
  );

  renderCoverage();
  renderKpis(filteredMetrics, latestMetric);

  els.trendNote.textContent = describeFilterRange(filteredMetrics, metrics);
  els.genderNote.textContent = latestSplitPeriod ? `Latest split: ${latestSplitPeriod}` : "No split data";
  els.appointmentNote.textContent = latestSplitPeriod
    ? `Latest split: ${latestSplitPeriod}`
    : "No split data";
  els.comparisonTitle.textContent = `${scopeLabels[state.scope]} view by segment`;

  renderLineChart(els.trendChart, filteredMetrics, [
    { key: "incomingPct", label: "Incoming %", color: colors.incoming },
    { key: "outgoingPct", label: "Outgoing %", color: colors.outgoing },
  ]);

  renderLineChart(els.tenureChart, filteredMetrics, [
    { key: "avgOutgoingTenureYears", label: "Tenure (years)", color: colors.tenure, fill: true },
  ]);

  renderHorizontalBarChart(els.comparisonChart, comparisonRows, {
    valueKey: "outgoingPct",
    labelKey: "segment",
    valueFormatter: formatPct,
    barColor: colors.bar,
  });

  renderSplitBarChart(els.genderChart, genderRows, {
    order: ["Women", "Men"],
    colors: { Women: colors.women, Men: colors.men },
    valueFormatter: formatPct,
  });

  renderSplitBarChart(els.appointmentChart, appointmentRows, {
    order: ["Internal", "External"],
    colors: { Internal: colors.internal, External: colors.external },
    valueFormatter: formatPct,
  });
}

function renderCoverage() {
  const scopeSegments = getAvailableSegments(state.scope);
  const latestGlobal = dataset.metrics[state.scope]
    .filter((row) => row.segment === "Global" && row.incomingPct !== null)
    .sort((a, b) => a.sortValue - b.sortValue)
    .at(-1);

  els.coverageReliable.textContent = "Global trend series complete across all quarters";
  els.coverageSegments.textContent = `${scopeSegments.length} usable ${state.scope} segments exposed in V1`;
  els.coverageLatest.textContent = latestGlobal ? `${latestGlobal.periodLabel} is the latest loaded quarter` : "Coverage unavailable";
}

function renderKpis(filteredMetrics, latestMetric) {
  if (!latestMetric) {
    els.kpiGrid.innerHTML = "";
    return;
  }

  const incomingAvg = average(filteredMetrics.map((row) => row.incomingPct).filter(isValue));
  const outgoingAvg = average(filteredMetrics.map((row) => row.outgoingPct).filter(isValue));
  const tenureAvg = average(filteredMetrics.map((row) => row.avgOutgoingTenureYears).filter(isValue));

  const cards = [
    {
      label: "Incoming appointments",
      value: formatCount(latestMetric.incomingCount),
      footLeft: `Rate ${formatPct(latestMetric.incomingPct)}`,
      footRight: `Avg ${formatPct(incomingAvg)}`,
      rate: true,
    },
    {
      label: "Outgoing departures",
      value: formatCount(latestMetric.outgoingCount),
      footLeft: `Rate ${formatPct(latestMetric.outgoingPct)}`,
      footRight: `Avg ${formatPct(outgoingAvg)}`,
      rate: true,
    },
    {
      label: "Outgoing tenure",
      value: formatYears(latestMetric.avgOutgoingTenureYears),
      footLeft: `Latest ${latestMetric.periodLabel}`,
      footRight: `Avg ${formatYears(tenureAvg)}`,
    },
    {
      label: "Companies in scope",
      value: formatCount(latestMetric.companyCount),
      footLeft: `${scopeLabels[state.scope]} | ${state.segment}`,
      footRight: buildPeriodTag(),
    },
  ];

  els.kpiGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="kpi-card card">
          <div class="kpi-label">${card.label}</div>
          <h3 class="kpi-value ${card.rate ? "rate" : ""}">${card.value}</h3>
          <div class="kpi-foot">
            <span>${card.footLeft}</span>
            <span>${card.footRight}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function getMetricSeries(scope, segment) {
  return dataset.metrics[scope]
    .filter((row) => row.segment === segment)
    .filter((row) => row.incomingPct !== null || row.outgoingPct !== null || row.avgOutgoingTenureYears !== null)
    .sort((a, b) => a.sortValue - b.sortValue);
}

function applyTimeFilter(rows) {
  return rows.filter((row) => {
    const matchesYear = state.year === "All" || row.year === Number(state.year);
    const matchesQuarter = state.quarter === "All" || row.quarter === Number(state.quarter);
    return matchesYear && matchesQuarter;
  });
}

function getComparisonRows() {
  const rows = dataset.metrics[state.scope]
    .filter((row) => row.segment !== "Global")
    .filter((row) => row.outgoingPct !== null);

  const filtered = rows.filter((row) => {
    const matchesYear = state.year === "All" || row.year === Number(state.year);
    const matchesQuarter = state.quarter === "All" || row.quarter === Number(state.quarter);
    return matchesYear && matchesQuarter;
  });

  const latestBySegment = new Map();
  filtered.forEach((row) => {
    const existing = latestBySegment.get(row.segment);
    if (!existing || row.sortValue > existing.sortValue) {
      latestBySegment.set(row.segment, row);
    }
  });

  return [...latestBySegment.values()]
    .sort((a, b) => b.outgoingPct - a.outgoingPct)
    .slice(0, 8);
}

function getLatestSplitPeriod(scope, segment) {
  const rows = dataset.splits[scope]
    .filter((row) => row.segment === segment)
    .filter((row) => row.pctValue !== null);

  const filtered = rows.filter((row) => {
    const matchesYear = state.year === "All" || row.year === Number(state.year);
    const matchesQuarter = state.quarter === "All" || row.quarter === Number(state.quarter);
    return matchesYear && matchesQuarter;
  });

  const selected = filtered.sort((a, b) => a.sortValue - b.sortValue).at(-1) || rows.sort((a, b) => a.sortValue - b.sortValue).at(-1);
  return selected ? selected.periodLabel : null;
}

function getSplitRows(scope, segment, flow, splitType, periodLabel) {
  if (!periodLabel) return [];
  return dataset.splits[scope]
    .filter((row) => row.segment === segment)
    .filter((row) => row.flow === flow && row.splitType === splitType && row.periodLabel === periodLabel)
    .filter((row) => row.pctValue !== null)
    .sort((a, b) => b.pctValue - a.pctValue);
}

function describeFilterRange(filteredMetrics, fullSeries) {
  if (!filteredMetrics.length) return "No values for the current filter";
  if (filteredMetrics.length === fullSeries.length) {
    return `${filteredMetrics[0].periodLabel} to ${filteredMetrics.at(-1).periodLabel}`;
  }
  if (filteredMetrics.length === 1) return filteredMetrics[0].periodLabel;
  return `${filteredMetrics[0].periodLabel} to ${filteredMetrics.at(-1).periodLabel}`;
}

function buildPeriodTag() {
  const year = state.year === "All" ? "All years" : state.year;
  const quarter = state.quarter === "All" ? "All quarters" : quarterLabels[Number(state.quarter)];
  return `${year} | ${quarter}`;
}

function renderLineChart(container, rows, series) {
  if (!rows.length) {
    container.innerHTML = `<div class="empty-state">No trend values match the current filters.</div>`;
    return;
  }

  const width = 760;
  const height = 330;
  const margin = { top: 28, right: 18, bottom: 54, left: 52 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const values = rows.flatMap((row) => series.map((item) => row[item.key]).filter(isValue));
  const maxValue = Math.max(...values, 0);
  const minValue = 0;
  const steps = Math.min(rows.length - 1, 6);

  const xForIndex = (index) =>
    margin.left + (rows.length === 1 ? innerWidth / 2 : (index / (rows.length - 1)) * innerWidth);
  const yForValue = (value) =>
    margin.top + innerHeight - ((value - minValue) / Math.max(maxValue - minValue || 1, 1)) * innerHeight;

  const yTicks = 4;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, idx) => (maxValue / yTicks) * idx);
  const labelsToShow = Array.from({ length: steps + 1 }, (_, idx) =>
    Math.round((idx / Math.max(steps, 1)) * (rows.length - 1))
  );

  const paths = series
    .map((item) => {
      const points = rows
        .map((row, index) => (isValue(row[item.key]) ? `${xForIndex(index)},${yForValue(row[item.key])}` : null))
        .filter(Boolean);

      if (!points.length) return "";

      return `
        ${item.fill ? `${buildAreaPath(rows, item.key, xForIndex, yForValue, height - margin.bottom, margin.left, innerWidth, margin.top)}<path d="${buildLinePath(rows, item.key, xForIndex, yForValue)}" fill="none" stroke="${item.color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />` : `<path d="${buildLinePath(rows, item.key, xForIndex, yForValue)}" fill="none" stroke="${item.color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />`}
      `;
    })
    .join("");

  const points = series
    .map((item) =>
      rows
        .map((row, index) =>
          isValue(row[item.key])
            ? `<circle cx="${xForIndex(index)}" cy="${yForValue(row[item.key])}" r="4.5" fill="${item.color}" />`
            : ""
        )
        .join("")
    )
    .join("");

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" aria-label="line chart">
      ${tickValues
        .map((tick) => {
          const y = yForValue(tick);
          return `
            <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="${colors.grid}" />
            <text x="${margin.left - 10}" y="${y + 4}" text-anchor="end" class="tick-label">${formatAxisValue(tick, series)}</text>
          `;
        })
        .join("")}

      ${labelsToShow
        .map((index) => {
          const x = xForIndex(index);
          return `<text x="${x}" y="${height - 18}" text-anchor="middle" class="tick-label">${rows[index].periodLabel}</text>`;
        })
        .join("")}

      ${paths}
      ${points}

      <text x="${margin.left}" y="18" class="axis-label">Quarterly series</text>
      ${series
        .map(
          (item, index) => `
            <circle cx="${margin.left + index * 140}" cy="${height - 6}" r="5" fill="${item.color}" />
            <text x="${margin.left + 12 + index * 140}" y="${height - 2}" class="legend-label">${item.label}</text>
          `
        )
        .join("")}
    </svg>
  `;
}

function buildLinePath(rows, key, xForIndex, yForValue) {
  return rows
    .map((row, index) => {
      if (!isValue(row[key])) return "";
      const command = index === firstDefinedIndex(rows, key) ? "M" : "L";
      return `${command} ${xForIndex(index)} ${yForValue(row[key])}`;
    })
    .filter(Boolean)
    .join(" ");
}

function buildAreaPath(rows, key, xForIndex, yForValue, baseline) {
  const defined = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => isValue(row[key]));

  if (!defined.length) return "";

  const first = defined[0];
  const last = defined[defined.length - 1];
  const line = defined
    .map(({ row, index }, idx) => `${idx === 0 ? "M" : "L"} ${xForIndex(index)} ${yForValue(row[key])}`)
    .join(" ");

  return `<path d="${line} L ${xForIndex(last.index)} ${baseline} L ${xForIndex(first.index)} ${baseline} Z" fill="${colors.fill}" />`;
}

function firstDefinedIndex(rows, key) {
  return rows.findIndex((row) => isValue(row[key]));
}

function renderHorizontalBarChart(container, rows, config) {
  if (!rows.length) {
    container.innerHTML = `<div class="empty-state">No comparable segment values match the current filters.</div>`;
    return;
  }

  const width = 560;
  const height = Math.max(320, rows.length * 42 + 40);
  const margin = { top: 22, right: 40, bottom: 18, left: 148 };
  const innerWidth = width - margin.left - margin.right;
  const maxValue = Math.max(...rows.map((row) => row[config.valueKey]));

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" aria-label="bar chart">
      ${rows
        .map((row, index) => {
          const y = margin.top + index * 38;
          const barWidth = (row[config.valueKey] / maxValue) * innerWidth;
          return `
            <text x="${margin.left - 12}" y="${y + 18}" text-anchor="end" class="tick-label">${row[config.labelKey]}</text>
            <rect x="${margin.left}" y="${y}" width="${innerWidth}" height="22" rx="11" fill="rgba(19, 33, 42, 0.06)" />
            <rect x="${margin.left}" y="${y}" width="${barWidth}" height="22" rx="11" fill="${config.barColor}" />
            <text x="${margin.left + barWidth + 8}" y="${y + 16}" class="value-label">${config.valueFormatter(
              row[config.valueKey]
            )}</text>
          `;
        })
        .join("")}
    </svg>
  `;
}

function renderSplitBarChart(container, rows, config) {
  if (!rows.length) {
    container.innerHTML = `<div class="empty-state">No split values match the current filters.</div>`;
    return;
  }

  const ordered = config.order
    .map((label) => rows.find((row) => row.splitValue === label))
    .filter(Boolean);

  const width = 520;
  const height = 320;
  const margin = { top: 26, right: 18, bottom: 48, left: 18 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const maxValue = 100;
  const barWidth = innerWidth / Math.max(ordered.length * 1.6, 1);

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" aria-label="split chart">
      ${[0, 25, 50, 75, 100]
        .map((tick) => {
          const y = margin.top + innerHeight - (tick / maxValue) * innerHeight;
          return `
            <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="${colors.grid}" />
            <text x="${width - margin.right}" y="${y - 6}" text-anchor="end" class="tick-label">${tick}%</text>
          `;
        })
        .join("")}

      ${ordered
        .map((row, index) => {
          const x = margin.left + 54 + index * (barWidth + 54);
          const barHeight = (row.pctValue / maxValue) * innerHeight;
          const y = margin.top + innerHeight - barHeight;
          return `
            <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="18" fill="${config.colors[row.splitValue] || colors.bar}" />
            <text x="${x + barWidth / 2}" y="${y - 8}" text-anchor="middle" class="value-label">${config.valueFormatter(
              row.pctValue
            )}</text>
            <text x="${x + barWidth / 2}" y="${height - 16}" text-anchor="middle" class="tick-label">${row.splitValue}</text>
          `;
        })
        .join("")}
    </svg>
  `;
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isValue(value) {
  return value !== null && value !== undefined && !Number.isNaN(value);
}

function formatCount(value) {
  if (!isValue(value)) return "N/A";
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);
}

function formatPct(value) {
  if (!isValue(value)) return "N/A";
  return `${value.toFixed(1)}%`;
}

function formatYears(value) {
  if (!isValue(value)) return "N/A";
  return `${value.toFixed(1)}y`;
}

function formatAxisValue(value, series) {
  const usesPct = series.some((item) => item.key.includes("Pct"));
  return usesPct ? `${value.toFixed(0)}%` : value.toFixed(1);
}
