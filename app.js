import {
  buildViewContext,
  createDefaultState,
  deltaLabel,
  displayLabel,
  formatPct,
  getSegmentOptions,
  getYearOptions,
  loadDashboardData,
  scopeLabels,
  segmentOptionLabel,
} from "./shared/data.js";
import {
  buildDefaultAnalysisMarkup,
  initTooltip,
  renderHomeView,
  renderKpis,
  updateHomeMeta,
} from "./shared/charts.js";
import { getAnalysis } from "./shared/analysis.js";

const state = createDefaultState();
const els = {
  scopeToggle: document.getElementById("scope-toggle"),
  segmentSelect: document.getElementById("segment-select"),
  yearSelect: document.getElementById("year-select"),
  quarterSelect: document.getElementById("quarter-select"),
  selectorRow: document.getElementById("selector-row"),
  coverageNote: document.getElementById("coverage-note"),
  kpiStrip: document.getElementById("kpi-strip"),
  viewNav: document.getElementById("view-nav"),
  chartKicker: document.getElementById("chart-kicker"),
  chartTitle: document.getElementById("chart-title"),
  headlineValue: document.getElementById("headline-value"),
  headlineChange: document.getElementById("headline-change"),
  latestQuarterPill: document.getElementById("latest-quarter-pill"),
  mainChart: document.getElementById("main-chart"),
  trendingList: document.getElementById("trending-list"),
  analysisBody: document.getElementById("analysis-body"),
  tooltip: document.getElementById("tooltip"),
};

let dataset;

initialize();

async function initialize() {
  try {
    dataset = await loadDashboardData();
    initTooltip(els.tooltip);
    bindEvents();
    populateControls();
    render();
  } catch (error) {
    console.error(error);
    els.analysisBody.innerHTML = "<p>Data could not be loaded. Run the project from a local web server.</p>";
  }
}

function bindEvents() {
  els.scopeToggle.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-scope]");
    if (!button) return;
    state.scope = button.dataset.scope;
    state.hasInteracted = true;
    [...els.scopeToggle.querySelectorAll("button")].forEach((node) =>
      node.classList.toggle("active", node === button)
    );
    refreshSegmentOptions();
    render();
  });

  els.viewNav.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-view]");
    if (!button) return;
    state.view = button.dataset.view;
    state.hasInteracted = true;
    [...els.viewNav.querySelectorAll("button[data-view]")].forEach((node) =>
      node.classList.toggle("active", node === button)
    );
    render();
  });

  ["segmentSelect", "yearSelect", "quarterSelect"].forEach((key) => {
    els[key].addEventListener("change", () => {
      const stateKey = key.replace("Select", "");
      state[stateKey] = els[key].value;
      if (stateKey === "segment") {
        state.selectedSegments = [els[key].value];
      }
      state.hasInteracted = true;
      render();
    });
  });

  els.selectorRow.addEventListener("click", (event) => {
    const item = event.target.closest("[data-segment]");
    if (!item) return;
    const { segment } = item.dataset;
    const selected = new Set(state.selectedSegments?.length ? state.selectedSegments : [state.segment]);
    if (selected.has(segment) && selected.size > 1) {
      selected.delete(segment);
    } else {
      selected.add(segment);
    }
    state.selectedSegments = [...selected];
    state.segment = state.selectedSegments[0];
    els.segmentSelect.value = state.segment;
    state.hasInteracted = true;
    render();
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
  const validSelected = (state.selectedSegments || []).filter((segment) => segments.includes(segment));
  if (!validSelected.length) {
    validSelected.push(segments.includes("Global") ? "Global" : segments[0]);
  }
  state.selectedSegments = validSelected;
  state.segment = state.selectedSegments[0];
  els.segmentSelect.innerHTML = segments
    .map((segment) => `<option value="${segment}">${segmentOptionLabel(dataset, state.scope, segment)}</option>`)
    .join("");
  els.segmentSelect.value = state.segment;
}

async function render() {
  const context = buildViewContext(dataset, state);
  renderKpis(els.kpiStrip, context);
  updateHomeMeta(context, els, state.view);
  renderSelectorRow();
  renderHeadline(context);
  renderTrending(context);
  renderHomeView(els.mainChart, state.view, context);
  await renderAnalysis(context);
}

function renderSelectorRow() {
  const segments = getSegmentOptions(dataset, state.scope);
  const selected = new Set(state.selectedSegments?.length ? state.selectedSegments : [state.segment]);
  els.selectorRow.innerHTML = segments
    .map((segment) => {
      const active = selected.has(segment) ? "active" : "";
      const label = segmentOptionLabel(dataset, state.scope, segment).split(" · ")[0];
      return `<button class="selector-item ${active}" data-segment="${segment}" type="button">${label}</button>`;
    })
    .join("");
}

function renderHeadline(context) {
  if (!context.latestPoint) {
    els.headlineValue.textContent = "--";
    els.headlineChange.textContent = "No visible data";
    els.headlineChange.classList.remove("up", "down");
    return;
  }

  const latest = context.latestPoint.outgoingPct;
  const previous = context.previousPoint?.outgoingPct;
  const delta = Number.isFinite(latest) && Number.isFinite(previous) ? latest - previous : null;
  const selectedCount = state.selectedSegments?.length || 1;
  const segmentLabel =
    selectedCount > 1
      ? `${selectedCount} segments`
      : displayLabel(state.selectedSegments?.[0] || state.segment);
  els.headlineValue.textContent = formatPct(latest);
  els.headlineChange.textContent = `${deltaLabel(latest, previous)} | ${scopeLabels[state.scope]} · ${segmentLabel}`;
  els.headlineChange.classList.toggle("up", Number.isFinite(delta) && delta >= 0);
  els.headlineChange.classList.toggle("down", Number.isFinite(delta) && delta < 0);
}

function renderTrending(context) {
  if (!context.comparisonRows.length) {
    els.trendingList.innerHTML = '<p class="trend-empty">No segment trend rows available.</p>';
    return;
  }

  els.trendingList.innerHTML = context.comparisonRows
    .slice(0, 6)
    .map(
      (row) => `
        <div class="trend-item">
          <span class="trend-name">${row.displaySegment}</span>
          <span class="trend-rate">${formatPct(row.outgoingPct)}</span>
        </div>
      `
    )
    .join("");
}

async function renderAnalysis(context) {
  if (!state.hasInteracted) {
    els.analysisBody.innerHTML = buildDefaultAnalysisMarkup();
    return;
  }

  els.analysisBody.innerHTML = '<p class="analysis-loading">Generating analysis...</p>';
  const result = await getAnalysis({ context, view: state.view, allowDefault: true });
  els.analysisBody.innerHTML = result.html;
}
