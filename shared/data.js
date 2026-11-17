const DATA_VERSION = "2026-q3";

export const DATA_FILES = {
  indexMetrics: `./data/index_quarterly_metrics.csv?v=${DATA_VERSION}`,
  indexSplits: `./data/index_quarterly_splits.csv?v=${DATA_VERSION}`,
  industryMetrics: `./data/industry_quarterly_metrics.csv?v=${DATA_VERSION}`,
  industrySplits: `./data/industry_quarterly_splits.csv?v=${DATA_VERSION}`,
  denominators: `./data/denominators_companies.csv?v=${DATA_VERSION}`,
};

export const quarterLabels = { 1: "Q1", 2: "Q2", 3: "Q3", 4: "Q4" };
export const scopeLabels = { index: "Index", industry: "Industry" };
export const viewMeta = {
  flagship: {
    kicker: "Flagship trend",
    title: "Quarterly turnover",
    caption:
      "Incoming and outgoing CEO turnover rates over time, filtered to the selected scope, segment, year, and quarter window.",
  },
  regional: {
    kicker: "Regional reference",
    title: "World market view",
    caption:
      "A geographic benchmark view of index-level outgoing turnover rates using the latest visible observation for each market.",
  },
  segment: {
    kicker: "Segment view",
    title: "Latest outgoing rate by segment",
    caption:
      "A ranked comparison of segment-level outgoing turnover rates under the current filter state.",
  },
  tenure: {
    kicker: "Tenure",
    title: "Outgoing CEO tenure",
    caption:
      "Average tenure of outgoing CEOs across the selected visible period, helping distinguish stable from more disruptive turnover conditions.",
  },
  gender: {
    kicker: "Gender",
    title: "Incoming and outgoing gender composition",
    caption:
      "Latest populated gender split rows for the current segment, with incoming and outgoing flows shown side by side.",
  },
  appointments: {
    kicker: "Internal versus external",
    title: "Appointment pathway",
    caption:
      "Latest populated internal and external appointment mix for the current segment and filter context.",
  },
};

const displayNames = {
  ASX200: "ASX 200",
  CAC40: "CAC 40",
  DAX40: "DAX 40",
  EuroNext100: "Euronext 100",
  FTSE100: "FTSE 100",
  FTSE250: "FTSE 250",
  HANGSENG: "Hang Seng",
  NSENifty50: "NSE Nifty 50",
  Nikkei225: "Nikkei 225",
  SMI: "SMI",
  SP500: "S&P 500",
  "SPTSX Composite": "S&P/TSX Composite",
  STI: "STI",
};

let datasetPromise;

export function createDefaultState() {
  return {
    scope: "index",
    segment: "Global",
    benchmarks: [],
    year: "All",
    quarter: "All",
    view: "flagship",
  };
}

export async function loadDashboardData() {
  if (!datasetPromise) {
    datasetPromise = Promise.all(Object.values(DATA_FILES).map(fetchCsv)).then(
      ([indexMetrics, indexSplits, industryMetrics, industrySplits, denominators]) =>
        buildDataset({
          indexMetrics,
          indexSplits,
          industryMetrics,
          industrySplits,
          denominators,
        })
    );
  }
  return datasetPromise;
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

function buildDataset(raw) {
  const metrics = {
    index: normalizeMetrics(raw.indexMetrics, "index"),
    industry: normalizeMetrics(raw.industryMetrics, "industry"),
  };
  const splits = {
    index: normalizeSplits(raw.indexSplits, "index"),
    industry: normalizeSplits(raw.industrySplits, "industry"),
  };
  const denominators = normalizeDenominators(raw.denominators);
  const coverage = buildCoverage(metrics, splits, denominators);
  return { metrics, splits, denominators, coverage };
}

function normalizeMetrics(rows, scope) {
  return rows.map((row) => ({
    scope,
    year: Number(row.year),
    quarter: Number(row.quarter),
    segment: row.segment,
    displaySegment: displayLabel(row.segment),
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

function normalizeSplits(rows, scope) {
  return rows.map((row) => ({
    scope,
    year: Number(row.year),
    quarter: Number(row.quarter),
    segment: row.segment,
    displaySegment: displayLabel(row.segment),
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
    displaySegment: displayLabel(row.segment),
    companyCount: toNumber(row.company_count),
    sortValue: Number(row.year) * 10 + Number(row.quarter),
  }));
}

function buildCoverage(metrics, splits, denominators) {
  const coverage = { index: {}, industry: {} };
  ["index", "industry"].forEach((scope) => {
    getAllSegmentsForScope(scope, denominators).forEach((segment) => {
      const denominatorRows = denominators.filter((row) => row.scope === scope && row.segment === segment);
      const metricRows = metrics[scope].filter((row) => row.segment === segment);
      const splitRows = splits[scope].filter((row) => row.segment === segment);
      coverage[scope][segment] = {
        segment,
        displaySegment: displayLabel(segment),
        quarterRows: denominatorRows.length,
        metricRows: metricRows.filter(hasMetricData).length,
        splitRows: splitRows.filter(hasSplitData).length,
      };
    });
  });
  return coverage;
}

export function getYearOptions(dataset) {
  return [...new Set(dataset.metrics.index.map((row) => row.year))].sort((a, b) => a - b);
}

export function getSegmentOptions(dataset, scope) {
  return getAllSegmentsForScope(scope, dataset.denominators).sort((a, b) => {
    if (a === "Global") return -1;
    if (b === "Global") return 1;
    return displayLabel(a).localeCompare(displayLabel(b));
  });
}

export function segmentOptionLabel(dataset, scope, segment) {
  const coverage = dataset.coverage[scope][segment];
  if (!coverage) return displayLabel(segment);
  if (coverage.metricRows === coverage.quarterRows) return displayLabel(segment);
  if (coverage.metricRows <= 1) return `${displayLabel(segment)} · latest only`;
  return `${displayLabel(segment)} · ${coverage.metricRows}/${coverage.quarterRows} qtrs`;
}

function getAllSegmentsForScope(scope, denominators) {
  return [...new Set(denominators.filter((row) => row.scope === scope).map((row) => row.segment))];
}

export function buildViewContext(dataset, state) {
  const scopeMetrics = dataset.metrics[state.scope].filter(hasMetricData);
  const fullSeries = scopeMetrics.filter((row) => row.segment === state.segment).sort(sortByTime);
  const filteredMetrics = applyTimeFilter(scopeMetrics, state);
  const visibleSeries = applyTimeFilter(fullSeries, state);
  const latestPoint = visibleSeries.at(-1) ?? null;
  const previousPoint = visibleSeries.at(-2) ?? null;
  const priorQuarterKey = latestPoint && (
    latestPoint.quarter === 1 ? (latestPoint.year - 1) * 10 + 4 : latestPoint.sortValue - 1
  );
  const priorQuarter = fullSeries.find((row) => row.sortValue === priorQuarterKey);
  const yearEarlier = latestPoint && fullSeries.find((row) => row.sortValue === latestPoint.sortValue - 10);
  const comparisonRows = getComparisonRows(filteredMetrics);
  const splits = applyTimeFilter(dataset.splits[state.scope], state)
    .filter((row) => row.segment === state.segment && hasSplitData(row));
  const selectedCoverage = dataset.coverage[state.scope][state.segment];
  const mapRows = state.scope === "index"
    ? comparisonRows
    : getComparisonRows(applyTimeFilter(dataset.metrics.index, state));
  const benchmarkSeries = state.benchmarks.map((segment) => ({
    segment,
    rows: filteredMetrics.filter((row) => row.segment === segment).sort(sortByTime),
  }));

  return {
    state,
    visibleSeries,
    latestPoint,
    previousPoint,
    priorQuarter,
    yearEarlier,
    benchmarkSeries,
    comparisonRows,
    genderTimeline: splits.filter((row) => row.splitType === "gender"),
    genderRows: latestComposition(splits, "gender"),
    appointmentRows: latestComposition(splits, "appointment"),
    selectedCoverage,
    mapRows,
  };
}

function getComparisonRows(rows) {
  const latestBySegment = new Map();
  rows.filter((row) => row.segment !== "Global" && isValue(row.outgoingPct)).forEach((row) => {
    const current = latestBySegment.get(row.segment);
    if (!current || row.sortValue > current.sortValue) latestBySegment.set(row.segment, row);
  });
  return [...latestBySegment.values()].sort((a, b) => b.outgoingPct - a.outgoingPct);
}

function latestComposition(rows, splitType) {
  const typeRows = rows.filter((row) => row.splitType === splitType);
  const latest = typeRows.reduce((period, row) => Math.max(period, row.sortValue), 0);
  return typeRows.filter((row) => row.sortValue === latest);
}

export function describePeriodFilter(state) {
  if (state.year === "All") {
    return state.quarter === "All" ? "the selected period" : `any reported ${quarterLabels[state.quarter]}`;
  }
  return state.quarter === "All" ? state.year : `${state.year} ${quarterLabels[state.quarter]}`;
}

function applyTimeFilter(rows, state) {
  return rows.filter((row) => {
    const yearMatch = state.year === "All" || row.year === Number(state.year);
    const quarterMatch = state.quarter === "All" || row.quarter === Number(state.quarter);
    return yearMatch && quarterMatch;
  });
}

function sortByTime(a, b) {
  return a.sortValue - b.sortValue;
}

export function buildCoverageNote(coverage) {
  if (!coverage) return "Coverage unavailable.";
  const metricLabel =
    coverage.metricRows === coverage.quarterRows
      ? "full metric history"
      : coverage.metricRows <= 1
        ? "latest metric only"
        : `${coverage.metricRows}/${coverage.quarterRows} populated metric quarters`;
  const splitLabel =
    coverage.splitRows === 0
      ? "no populated split rows"
      : `${coverage.splitRows / 12} split quarters`;
  return `${coverage.displaySegment}: ${metricLabel}, ${splitLabel}.`;
}

export function describeVisibleRange(rows) {
  if (!rows.length) return "No visible range";
  if (rows.length === 1) return rows[0].periodLabel;
  return `${rows[0].periodLabel} to ${rows.at(-1).periodLabel}`;
}

export function deltaLabel(current, previous) {
  if (!isValue(current) || !isValue(previous)) return "No prior point";
  const delta = current - previous;
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} pts`;
}

export function buildInsight(context) {
  const { latestPoint, previousPoint, state } = context;
  if (!latestPoint) return "No visible metric point for the current filter.";
  if (!previousPoint) return `Latest visible quarter: ${latestPoint.periodLabel}.`;
  return `${displayLabel(state.segment)} outgoing rate: ${deltaLabel(latestPoint.outgoingPct, previousPoint.outgoingPct)} from ${previousPoint.periodLabel} to ${latestPoint.periodLabel}.`;
}

export function displayLabel(segment) {
  return displayNames[segment] || segment;
}

export function formatCount(value) {
  if (!isValue(value)) return "N/A";
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);
}

export function formatPct(value) {
  if (!isValue(value)) return "N/A";
  return `${value.toFixed(1)}%`;
}

export function formatYears(value) {
  if (!isValue(value)) return "N/A";
  return `${value.toFixed(1)} years`;
}

export function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function isValue(value) {
  return value !== null && value !== undefined && !Number.isNaN(value);
}

function hasMetricData(row) {
  return (
    isValue(row.incomingPct) ||
    isValue(row.outgoingPct) ||
    isValue(row.incomingCount) ||
    isValue(row.outgoingCount) ||
    isValue(row.avgOutgoingTenureYears)
  );
}

function hasSplitData(row) {
  return isValue(row.pctValue) || isValue(row.countValue);
}

function toNumber(value) {
  if (value === "") return null;
  const number = Number(value);
  return Number.isNaN(number) ? null : number;
}
