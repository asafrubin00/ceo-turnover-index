import {
  buildCoverageNote,
  buildInsight,
  describeVisibleRange,
  displayLabel,
  formatCount,
  formatPct,
  formatYears,
  scopeLabels,
  viewMeta,
} from "./data.js";

const cache = new Map();

export async function getAnalysis({ context, view, allowDefault }) {
  if (!allowDefault) {
    return {
      status: "Default guidance",
      html: buildDefaultCopy(),
    };
  }

  const payload = buildPayload(context, view);
  const key = JSON.stringify(payload);
  if (cache.has(key)) return cache.get(key);

  const result = await fetchRemoteAnalysis(payload).catch(() => null);
  const finalResult =
    result || {
      status: "Local synthesis",
      html: buildLocalAnalysis(payload),
    };

  cache.set(key, finalResult);
  return finalResult;
}

function buildPayload(context, view) {
  return {
    view,
    viewTitle: viewMeta[view].title,
    scope: scopeLabels[context.state.scope],
    segment: displayLabel(context.state.segment),
    year: context.state.year,
    quarter: context.state.quarter,
    visibleRange: describeVisibleRange(context.visibleSeries),
    coverage: buildCoverageNote(context.selectedCoverage),
    insight: buildInsight(context),
    latestPoint: context.latestPoint
      ? {
          incomingRate: formatPct(context.latestPoint.incomingPct),
          outgoingRate: formatPct(context.latestPoint.outgoingPct),
          incomingCount: formatCount(context.latestPoint.incomingCount),
          outgoingCount: formatCount(context.latestPoint.outgoingCount),
          tenure: formatYears(context.latestPoint.avgOutgoingTenureYears),
          companyCount: formatCount(context.latestPoint.companyCount),
          period: context.latestPoint.periodLabel,
        }
      : null,
    comparisonLeader: context.comparisonRows[0]
      ? `${context.comparisonRows[0].displaySegment} at ${formatPct(context.comparisonRows[0].outgoingPct)}`
      : "No leader available",
    splitSnapshot: {
      gender: context.genderRows.map((row) => `${row.flow} ${row.splitValue} ${formatPct(row.pctValue)}`),
      appointments: context.appointmentRows.map((row) => `${row.flow} ${row.splitValue} ${formatPct(row.pctValue)}`),
    },
  };
}

async function fetchRemoteAnalysis(payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2400);

  try {
    const response = await fetch("./api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const data = await response.json();
    if (!data?.analysis) return null;
    return { status: data.mode || "OpenAI", html: paragraphsToHtml(data.analysis) };
  } finally {
    clearTimeout(timeout);
  }
}

function buildDefaultCopy() {
  return `
    <p>CEO turnover patterns influence corporate stability, succession quality, and market confidence across major listed companies.</p>
    <p>Use the controls to focus the chart and this panel will summarize the signal.</p>
  `;
}

function buildLocalAnalysis(payload) {
  const paragraphs = [];
  paragraphs.push(
    `${payload.viewTitle} is focused on ${payload.segment} in the ${payload.scope.toLowerCase()} view. Visible range: ${payload.visibleRange}. Coverage: ${payload.coverage}`
  );

  if (payload.latestPoint) {
    paragraphs.push(
      `${payload.latestPoint.period}: incoming ${payload.latestPoint.incomingRate} (${payload.latestPoint.incomingCount}), outgoing ${payload.latestPoint.outgoingRate} (${payload.latestPoint.outgoingCount}), outgoing tenure ${payload.latestPoint.tenure}. ${payload.insight}`
    );
  }

  if (payload.view === "segment" || payload.view === "regional") {
    paragraphs.push(
      `Within the current comparison set, the highest outgoing rate is ${payload.comparisonLeader}. In practice, elevated outgoing rates often point to sharper strategic resets, investor pressure, succession timing, or sector-specific volatility rather than a single universal cause.`
    );
  }

  if (payload.view === "gender" && payload.splitSnapshot.gender.length) {
    paragraphs.push(
      `The latest populated gender composition snapshot reads: ${payload.splitSnapshot.gender.join(
        "; "
      )}. The main interpretation here is whether representation is broadening at the point of appointment and whether exits remain more concentrated.`
    );
  }

  if (payload.view === "appointments" && payload.splitSnapshot.appointments.length) {
    paragraphs.push(
      `The latest appointment pathway snapshot reads: ${payload.splitSnapshot.appointments.join(
        "; "
      )}. A higher internal share generally signals stronger succession depth, while a higher external share can indicate deliberate strategic reset or capability import.`
    );
  }

  return paragraphsToHtml(paragraphs.slice(0, 2).join("\n\n"));
}

function paragraphsToHtml(text) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join("");
}
