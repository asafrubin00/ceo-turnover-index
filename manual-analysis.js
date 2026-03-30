import {
  buildViewContext,
  createDefaultState,
  getSegmentOptions,
  getYearOptions,
  loadDashboardData,
  segmentOptionLabel,
} from "./shared/data.js";
import { initTooltip, renderKpis, renderManualCharts } from "./shared/charts.js";

const state = createDefaultState();
const els = {
  scopeToggle: document.getElementById("scope-toggle"),
  segmentSelect: document.getElementById("segment-select"),
  yearSelect: document.getElementById("year-select"),
  quarterSelect: document.getElementById("quarter-select"),
  coverageNote: document.getElementById("coverage-note"),
  latestQuarterPill: document.getElementById("latest-quarter-pill"),
  kpiStrip: document.getElementById("kpi-strip"),
  tooltip: document.getElementById("tooltip"),
  charts: {
    flagship: document.getElementById("flagship-chart"),
    regional: document.getElementById("regional-chart"),
    segment: document.getElementById("segment-chart"),
    tenure: document.getElementById("tenure-chart"),
    gender: document.getElementById("gender-chart"),
    appointment: document.getElementById("appointment-chart"),
  },
};

let dataset;

initialize();

async function initialize() {
  dataset = await loadDashboardData();
  initTooltip(els.tooltip);
  bindEvents();
  populateControls();
  render();
}

function bindEvents() {
  els.scopeToggle.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-scope]");
    if (!button) return;
    state.scope = button.dataset.scope;
    [...els.scopeToggle.querySelectorAll("button")].forEach((node) =>
      node.classList.toggle("active", node === button)
    );
    refreshSegmentOptions();
    render();
  });

  ["segmentSelect", "yearSelect", "quarterSelect"].forEach((key) => {
    els[key].addEventListener("change", () => {
      const stateKey = key.replace("Select", "");
      state[stateKey] = els[key].value;
      if (stateKey === "segment") {
        state.selectedSegments = [els[key].value];
      }
      render();
    });
  });
}

function populateControls() {
  const years = getYearOptions(dataset);
  els.yearSelect.innerHTML = ['<option value="All">All years</option>']
    .concat(years.map((year) => `<option value="${year}">${year}</option>`))
    .join("");
  refreshSegmentOptions();
}

function refreshSegmentOptions() {
  const segments = getSegmentOptions(dataset, state.scope);
  if (!segments.includes(state.segment)) {
    state.segment = segments.includes("Global") ? "Global" : segments[0];
  }
  state.selectedSegments = [state.segment];
  els.segmentSelect.innerHTML = segments
    .map((segment) => `<option value="${segment}">${segmentOptionLabel(dataset, state.scope, segment)}</option>`)
    .join("");
  els.segmentSelect.value = state.segment;
}

function render() {
  const context = buildViewContext(dataset, state);
  renderKpis(els.kpiStrip, context);
  els.coverageNote.textContent = context.selectedCoverage
    ? `${context.selectedCoverage.displaySegment}: ${context.selectedCoverage.metricRows}/${context.selectedCoverage.quarterRows} populated metric quarters.`
    : "Coverage unavailable.";
  els.latestQuarterPill.textContent = context.latestGlobal
    ? `${context.latestGlobal.periodLabel}`
    : "Latest quarter unavailable";
  renderManualCharts(els.charts, context);
}
