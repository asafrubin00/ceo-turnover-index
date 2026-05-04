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
import { initTooltip, renderHomeView, renderKpis, updateHomeMeta } from "./shared/charts.js";

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
  summaryTitleInline: document.getElementById("summary-title-inline"),
  headlineValue: document.getElementById("headline-value"),
  headlineChange: document.getElementById("headline-change"),
  headlineIndex: document.getElementById("headline-index"),
  latestQuarterPill: document.getElementById("latest-quarter-pill"),
  mainChart: document.getElementById("main-chart"),
  analysisOutput: document.getElementById("analysis-output"),
  tooltip: document.getElementById("tooltip"),
};

const charts = {
  primary: null,
  secondary: [],
};

const indexCoordinates = {
  "S&P 500": { lat: 37.0, lon: -95.7 },
  "S&P/TSX Composite": { lat: 56.1, lon: -106.3 },
  "FTSE 100": { lat: 51.5, lon: -0.1 },
  "FTSE 250": { lat: 51.5, lon: -0.1 },
  "CAC 40": { lat: 46.2, lon: 2.2 },
  "DAX 40": { lat: 51.2, lon: 10.5 },
  "Euronext 100": { lat: 50.8, lon: 4.3 },
  SMI: { lat: 46.8, lon: 8.2 },
  "Nikkei 225": { lat: 35.7, lon: 139.7 },
  "Hang Seng": { lat: 22.3, lon: 114.2 },
  "ASX 200": { lat: -25.3, lon: 133.8 },
  "NSE Nifty 50": { lat: 20.6, lon: 78.9 },
  STI: { lat: 1.3, lon: 103.8 },
};

const indexRegionMap = {
  "S&P 500": "US",
  "S&P/TSX Composite": "Canada",
  "FTSE 100": "UK",
  "FTSE 250": "UK",
  "CAC 40": "France",
  "DAX 40": "Germany",
  "Euronext 100": "Euro Area",
  SMI: "Switzerland",
  "Nikkei 225": "Japan",
  "Hang Seng": "Hong Kong",
  "ASX 200": "Australia",
  "NSE Nifty 50": "India",
  STI: "Singapore",
};

const periodDriverMap = {
  2020: ["pandemic-era disruption", "emergency cost restructuring", "board-level crisis succession planning"],
  2021: ["reopening execution risk", "supply-chain normalization pressure", "portfolio and capital reallocation"],
  2022: ["inflation and rate-shock pressure", "margin compression", "rapid repricing of growth expectations"],
  2023: ["banking and funding volatility", "geopolitical fragmentation", "AI and digital strategy resets"],
  2024: ["higher-for-longer rates", "election-cycle policy uncertainty", "renewed focus on cash generation"],
  2025: ["late-cycle growth uncertainty", "board pressure for execution certainty", "faster performance accountability"],
};

const regionDriverMap = {
  UK: ["weak-growth policy tradeoffs in the UK", "sterling and financing-condition swings", "board preference for turnaround leadership"],
  US: ["activist scrutiny and capital-discipline demands", "faster performance accountability cycles", "strategic repositioning after valuation resets"],
  "Euro Area": ["energy and demand uncertainty", "fragmented policy environment", "cross-border competitiveness pressure"],
  Germany: ["industrial transition pressure", "export-demand cyclicality", "manufacturing margin risk"],
  France: ["policy and labor cost uncertainty", "portfolio simplification pressure", "leadership refresh in large caps"],
  Japan: ["governance reform momentum", "capital-efficiency focus", "board refresh tied to strategic modernization"],
  "Hong Kong": ["China demand sensitivity", "capital market volatility", "leadership pivots toward resilience"],
  India: ["high-growth execution pressure", "scale-up governance demands", "succession pipeline stress in expansion phases"],
};

const analysisCopy = {
  flagship: ({ context, filterLabel }) => buildFlagshipInsight(context, filterLabel),
  regional: ({ context, filterLabel }) => buildRegionalInsight(context, filterLabel),
  segment: ({ context, filterLabel }) => buildSegmentInsight(context, filterLabel),
  tenure: ({ context, filterLabel }) => buildTenureInsight(context, filterLabel),
  gender: ({ context, filterLabel }) => buildGenderInsight(context, filterLabel),
  appointments: ({ context, filterLabel }) => buildAppointmentsInsight(context, filterLabel),
};

let dataset;
let analysisTimer = null;
let analysisCache = new Map();
let worldCountriesPromise = null;
let cleanupMapInteractions = null;
let renderCycle = 0;

function hasChartJs() {
  return typeof window.Chart === "function";
}

async function fetchWithTimeout(url, timeoutMs = 4500) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "force-cache" });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

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
    els.analysisOutput.innerHTML =
      "<p>Data could not be loaded. Run the project from a local web server.</p>";
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
      if (stateKey === "segment") state.selectedSegments = [els[key].value];
      state.hasInteracted = true;
      render();
    });
  });

  els.selectorRow.addEventListener("click", (event) => {
    const item = event.target.closest("[data-segment]");
    if (!item) return;
    const { segment } = item.dataset;
    const selected = new Set(
      state.selectedSegments?.length ? state.selectedSegments : [state.segment]
    );
    if (selected.has(segment) && selected.size > 1) selected.delete(segment);
    else selected.add(segment);

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
  const validSelected = (state.selectedSegments || []).filter((segment) =>
    segments.includes(segment)
  );
  if (!validSelected.length) validSelected.push(segments.includes("Global") ? "Global" : segments[0]);
  state.selectedSegments = validSelected;
  state.segment = state.selectedSegments[0];
  els.segmentSelect.innerHTML = segments
    .map(
      (segment) =>
        `<option value="${segment}">${segmentOptionLabel(dataset, state.scope, segment)}</option>`
    )
    .join("");
  els.segmentSelect.value = state.segment;
}

async function render() {
  const cycle = ++renderCycle;
  const context = buildViewContext(dataset, state);
  renderKpis(els.kpiStrip, context);
  updateHomeMeta(context, els, state.view);
  renderSelectorRow();
  renderHeadline(context);
  await renderMainView(context, cycle);
  if (cycle !== renderCycle) return;
  updateAnalysisPanel(state.view, context);
}

function renderSelectorRow() {
  const segments = getSegmentOptions(dataset, state.scope);
  const selected = new Set(
    state.selectedSegments?.length ? state.selectedSegments : [state.segment]
  );
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
    els.headlineChange.textContent = "--";
    els.headlineIndex.textContent = "--";
    els.latestQuarterPill.textContent = "--";
    els.headlineChange.classList.remove("up", "down");
    if (els.summaryTitleInline) els.summaryTitleInline.textContent = els.chartTitle?.textContent || "--";
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
  const latestQuarterLabel =
    context.latestPoint?.periodLabel?.replace(" Q", ", Q") || "--";

  els.headlineValue.textContent = formatPct(latest);
  els.headlineChange.textContent = deltaLabel(latest, previous);
  els.headlineIndex.textContent = segmentLabel;
  els.latestQuarterPill.textContent = latestQuarterLabel;
  if (els.summaryTitleInline) els.summaryTitleInline.textContent = els.chartTitle?.textContent || "Quarterly turnover trajectory";
  els.headlineChange.classList.toggle("up", Number.isFinite(delta) && delta >= 0);
  els.headlineChange.classList.toggle("down", Number.isFinite(delta) && delta < 0);
}

async function renderMainView(context, cycle) {
  destroyAllCharts();

  if (state.view === "flagship") {
    const success = renderFlagshipChart(context);
    if (!success) renderHomeView(els.mainChart, "flagship", context);
    return;
  }

  if (state.view === "regional") {
    const success = await renderRegionalMapChart(context, cycle);
    if (!success) renderHomeView(els.mainChart, "regional", context);
    return;
  }

  if (state.view === "segment") {
    const success = renderSegmentChartCompact(context);
    if (!success) renderHomeView(els.mainChart, "segment", context);
    return;
  }

  if (state.view === "gender") {
    const success = renderGenderChart(context);
    if (!success) renderHomeView(els.mainChart, "gender", context);
    return;
  }

  if (state.view === "appointments") {
    const success = renderInternalExternalDonuts(context);
    if (!success) renderHomeView(els.mainChart, "appointments", context);
    return;
  }

  renderHomeView(els.mainChart, state.view, context);
}

function destroyAllCharts() {
  if (typeof cleanupMapInteractions === "function") {
    cleanupMapInteractions();
    cleanupMapInteractions = null;
  }
  if (charts.primary) {
    charts.primary.destroy();
    charts.primary = null;
  }
  if (charts.secondary.length) {
    charts.secondary.forEach((instance) => instance.destroy());
    charts.secondary = [];
  }
}

function renderFlagshipChart(context) {
  if (!hasChartJs()) return false;
  if (!context.visibleSeries.length) {
    renderHomeView(els.mainChart, "flagship", context);
    return true;
  }

  els.mainChart.innerHTML = '<canvas id="flagship-chart-canvas"></canvas>';
  const canvas = document.getElementById("flagship-chart-canvas");
  const chart = new window.Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels: context.visibleSeries.map((row) => row.periodLabel),
      datasets: [
        {
          label: "Outgoing",
          data: context.visibleSeries.map((row) => row.outgoingPct),
          borderColor: "rgba(212, 168, 67, 0.95)",
          backgroundColor: "rgba(212, 168, 67, 0.08)",
          pointRadius: 2.2,
          pointHoverRadius: 4,
          borderWidth: 1.7,
          tension: 0.35,
          fill: false,
        },
        {
          label: "Incoming",
          data: context.visibleSeries.map((row) => row.incomingPct),
          borderColor: "rgba(74, 158, 218, 0.95)",
          backgroundColor: "rgba(74, 158, 218, 0.08)",
          pointRadius: 2.2,
          pointHoverRadius: 4,
          borderWidth: 1.7,
          tension: 0.35,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: {
            color: "rgba(232,234,240,0.78)",
            font: { size: 11 },
            padding: 8,
            autoSkip: true,
            maxTicksLimit: 10,
            maxRotation: 0,
            minRotation: 0,
            callback: (_, index) => context.visibleSeries[index]?.periodLabel ?? "",
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: {
            color: "rgba(232,234,240,0.55)",
            font: { size: 11 },
            callback: (v) => `${Number(v).toFixed(1)}%`,
          },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: "top",
          align: "end",
          labels: {
            color: "rgba(232, 234, 240, 0.92)",
            font: { family: "'IBM Plex Sans', sans-serif", size: 13, weight: "500" },
            boxWidth: 22,
            boxHeight: 3,
            padding: 12,
            usePointStyle: true,
            pointStyle: "line",
            pointStyleWidth: 28,
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(1)}%`,
          },
        },
      },
    },
  });

  charts.primary = chart;
  return true;
}

async function renderRegionalMapChart(context, cycle) {
  try {
    if (!window.Chart) return false;
    const hasGeoBubbleController =
      !!window.Chart.registry?.controllers?.get?.("bubbleMap") ||
      !!window.Chart.registry?.controllers?.get?.("choropleth");
    if (!window.topojson || !hasGeoBubbleController) {
      return renderRegionalScatterFallback(context);
    }

    const countries = await loadWorldCountries();
    if (cycle !== renderCycle) return false;
    if (!countries?.features?.length) return renderRegionalScatterFallback(context);

    const nodes = context.mapRows.length ? context.mapRows : context.comparisonRows;
    const scoped = nodes.filter((row) => indexCoordinates[row.displaySegment]);
    if (!scoped.length) return false;

    const maxValue = Math.max(...scoped.map((row) => row.outgoingPct || 0), 1);
    const bubblesArray = scoped.map((row) => {
      const coords = indexCoordinates[row.displaySegment];
      const rate = row.outgoingPct || 0;
      return {
        latitude: coords.lat,
        longitude: coords.lon,
        value: rate,
        r: 4 + (rate / maxValue) * 14,
        label: row.displaySegment,
        outgoing: rate,
        period: row.periodLabel,
      };
    });

    els.mainChart.innerHTML = `
      <div class="map-viewport" id="map-viewport">
        <canvas id="regional-map-canvas" style="width:100%; height:100%"></canvas>
      </div>
      <div class="map-controls" id="map-controls">
        <button class="map-ctrl-btn" id="map-zoom-in" aria-label="Zoom in">+</button>
        <button class="map-ctrl-btn" id="map-zoom-out" aria-label="Zoom out">−</button>
        <button class="map-ctrl-btn map-ctrl-reset" id="map-zoom-reset" aria-label="Reset view" title="Reset">⟳</button>
      </div>
    `;
    const canvas = document.getElementById("regional-map-canvas");
    const regionalChart = new window.Chart(canvas.getContext("2d"), {
      type: "bubbleMap",
      data: {
        datasets: [
          {
            label: "CEO Turnover",
            outline: countries,
            showOutline: true,
            outlineBackgroundColor: "rgba(26, 32, 48, 0.9)",
            outlineBorderColor: "rgba(255,255,255,0.10)",
            data: bubblesArray,
            backgroundColor: "rgba(77, 158, 218, 0.75)",
            borderColor: "rgba(77, 158, 218, 1)",
            borderWidth: 1,
            radius: (ctx) => ctx.raw?.r ?? 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        showOutline: true,
        showGraticule: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const d = ctx.raw || {};
                return `${d.label || ""}: ${
                  d.value != null ? `${Number(d.value).toFixed(1)}%` : ""
                }`;
              },
            },
          },
        },
        scales: {
          projection: {
            axis: "x",
            projection: "equalEarth",
          },
        },
      },
    });
    charts.primary = regionalChart;
    requestAnimationFrame(() => {
      if (charts.primary === regionalChart && cycle === renderCycle) regionalChart.update();
    });
    cleanupMapInteractions = initMapInteractions();

    return true;
  } catch (error) {
    console.warn("Regional map fallback to scatter:", error);
    return renderRegionalScatterFallback(context);
  }
}

async function loadWorldCountries() {
  if (!worldCountriesPromise) {
    worldCountriesPromise = fetchWithTimeout(
      "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json",
      4500
    )
      .then((response) => {
        if (!response.ok) throw new Error("world map fetch failed");
        return response.json();
      })
      .then((world) => window.topojson.feature(world, world.objects.countries))
      .catch((error) => {
        console.warn("Unable to load world map data", error);
        return null;
      });
  }
  return worldCountriesPromise;
}

function renderRegionalScatterFallback(context) {
  if (!hasChartJs()) return false;
  const nodes = context.mapRows.length ? context.mapRows : context.comparisonRows;
  const scoped = nodes.filter((row) => indexCoordinates[row.displaySegment]);
  if (!scoped.length) return false;

  const maxValue = Math.max(...scoped.map((row) => row.outgoingPct || 0), 1);
  const bubbleData = scoped.map((row) => {
    const coords = indexCoordinates[row.displaySegment];
    const rate = row.outgoingPct || 0;
    return {
      x: coords.lon,
      y: coords.lat,
      r: 4 + (rate / maxValue) * 14,
      value: rate,
      label: row.displaySegment,
      period: row.periodLabel,
    };
  });

  els.mainChart.innerHTML = `
    <div class="map-viewport" id="map-viewport">
      <canvas id="regional-map-canvas" style="width:100%; height:100%"></canvas>
    </div>
    <div class="map-controls" id="map-controls">
      <button class="map-ctrl-btn" id="map-zoom-in" aria-label="Zoom in">+</button>
      <button class="map-ctrl-btn" id="map-zoom-out" aria-label="Zoom out">−</button>
      <button class="map-ctrl-btn map-ctrl-reset" id="map-zoom-reset" aria-label="Reset view" title="Reset">⟳</button>
    </div>
  `;
  const canvas = document.getElementById("regional-map-canvas");
  charts.primary = new window.Chart(canvas.getContext("2d"), {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "CEO Turnover",
          data: bubbleData,
          backgroundColor: "rgba(77, 158, 218, 0.75)",
          borderColor: "rgba(77, 158, 218, 1)",
          borderWidth: 1,
          pointRadius: (ctx) => ctx.raw?.r ?? 6,
          pointHoverRadius: (ctx) => (ctx.raw?.r ?? 6) + 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const d = ctx.raw || {};
              return `${d.label || ""}: ${
                d.value != null ? `${Number(d.value).toFixed(1)}%` : ""
              }`;
            },
          },
        },
      },
      scales: {
        x: {
          min: -180,
          max: 180,
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: { color: "rgba(232,234,240,0.45)", font: { size: 10 } },
        },
        y: {
          min: -60,
          max: 85,
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: { color: "rgba(232,234,240,0.45)", font: { size: 10 } },
        },
      },
    },
  });
  cleanupMapInteractions = initMapInteractions();
  return true;
}

function initMapInteractions() {
  const viewport = document.getElementById("map-viewport");
  const canvas = viewport ? viewport.querySelector("canvas") : null;
  const zoomIn = document.getElementById("map-zoom-in");
  const zoomOut = document.getElementById("map-zoom-out");
  const reset = document.getElementById("map-zoom-reset");
  if (!viewport || !canvas) return null;

  let scale = 1;
  let tx = 0;
  let ty = 0;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startTx = 0;
  let startTy = 0;
  let lastTouchDist = null;

  const MIN_SCALE = 0.8;
  const MAX_SCALE = 6;

  function applyTransform() {
    canvas.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  function clampTranslation() {
    const w = viewport.offsetWidth;
    const h = viewport.offsetHeight;
    const maxTx = w * (scale - 1) * 0.6;
    const maxTy = h * (scale - 1) * 0.6;
    tx = Math.max(-maxTx, Math.min(maxTx, tx));
    ty = Math.max(-maxTy, Math.min(maxTy, ty));
  }

  const onZoomIn = () => {
    scale = Math.min(MAX_SCALE, +(scale * 1.35).toFixed(2));
    clampTranslation();
    applyTransform();
  };
  const onZoomOut = () => {
    scale = Math.max(MIN_SCALE, +(scale / 1.35).toFixed(2));
    clampTranslation();
    applyTransform();
  };
  const onReset = () => {
    scale = 1;
    tx = 0;
    ty = 0;
    applyTransform();
  };
  const onWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.12;
    scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, +(scale * delta).toFixed(3)));
    clampTranslation();
    applyTransform();
  };
  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startTx = tx;
    startTy = ty;
    viewport.style.cursor = "grabbing";
  };
  const onMouseMove = (e) => {
    if (!dragging) return;
    tx = startTx + (e.clientX - startX);
    ty = startTy + (e.clientY - startY);
    clampTranslation();
    applyTransform();
  };
  const onMouseUp = () => {
    if (!dragging) return;
    dragging = false;
    viewport.style.cursor = "grab";
  };
  const onTouchStart = (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      dragging = true;
      startX = touch.clientX;
      startY = touch.clientY;
      startTx = tx;
      startTy = ty;
      lastTouchDist = null;
    } else if (e.touches.length === 2) {
      dragging = false;
      const [t0, t1] = e.touches;
      lastTouchDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
    }
  };
  const onTouchMove = (e) => {
    if (e.touches.length === 1 && dragging) {
      const touch = e.touches[0];
      tx = startTx + (touch.clientX - startX);
      ty = startTy + (touch.clientY - startY);
      clampTranslation();
      applyTransform();
    } else if (e.touches.length === 2) {
      const [t0, t1] = e.touches;
      const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
      if (lastTouchDist) {
        scale = Math.max(
          MIN_SCALE,
          Math.min(MAX_SCALE, +(scale * (dist / lastTouchDist)).toFixed(3))
        );
        clampTranslation();
        applyTransform();
      }
      lastTouchDist = dist;
    }
  };
  const onTouchEnd = () => {
    dragging = false;
    lastTouchDist = null;
  };

  zoomIn?.addEventListener("click", onZoomIn);
  zoomOut?.addEventListener("click", onZoomOut);
  reset?.addEventListener("click", onReset);
  viewport.addEventListener("wheel", onWheel, { passive: false });
  viewport.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  viewport.addEventListener("touchstart", onTouchStart, { passive: true });
  viewport.addEventListener("touchmove", onTouchMove, { passive: true });
  viewport.addEventListener("touchend", onTouchEnd, { passive: true });

  return () => {
    zoomIn?.removeEventListener("click", onZoomIn);
    zoomOut?.removeEventListener("click", onZoomOut);
    reset?.removeEventListener("click", onReset);
    viewport.removeEventListener("wheel", onWheel);
    viewport.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    viewport.removeEventListener("touchstart", onTouchStart);
    viewport.removeEventListener("touchmove", onTouchMove);
    viewport.removeEventListener("touchend", onTouchEnd);
  };
}

function renderSegmentChartCompact(context) {
  if (!hasChartJs()) return false;
  const rows = context.comparisonRows || [];
  if (!rows.length) return false;

  els.mainChart.innerHTML = '<canvas id="segment-chart-canvas" style="width:100%; height:100%"></canvas>';
  const canvas = document.getElementById("segment-chart-canvas");

  charts.primary = new window.Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: rows.map((row) => row.displaySegment),
      datasets: [
        {
          data: rows.map((row) => Number(row.outgoingPct || 0)),
          backgroundColor: rows.map((row) =>
            row.segment === context.state.segment
              ? "rgba(212, 168, 67, 0.82)"
              : "rgba(74, 158, 218, 0.62)"
          ),
          borderColor: rows.map((row) =>
            row.segment === context.state.segment
              ? "rgba(212, 168, 67, 1)"
              : "rgba(74, 158, 218, 0.88)"
          ),
          borderWidth: 1,
          borderRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      scales: {
        y: {
          ticks: {
            font: { size: 11 },
            color: "rgba(232,234,240,0.55)",
            autoSkip: false,
            maxRotation: 0,
          },
          grid: { display: false },
        },
        x: {
          ticks: {
            font: { size: 10 },
            color: "rgba(232,234,240,0.40)",
            callback: (v) => `${v}%`,
          },
          grid: { color: "rgba(255,255,255,0.05)" },
          beginAtZero: true,
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => items?.[0]?.label || "",
            label: (ctx) => `Outgoing: ${Number(ctx.parsed.x).toFixed(1)}%`,
          },
        },
      },
      barPercentage: 0.65,
      categoryPercentage: 0.88,
      layout: { padding: { bottom: 8 } },
    },
  });

  return true;
}

function renderGenderChart(context) {
  if (!hasChartJs()) return false;
  const rows = buildGenderTimelineRows(context);
  if (!rows.length) return false;

  els.mainChart.innerHTML = '<canvas id="gender-chart-canvas"></canvas>';
  const canvas = document.getElementById("gender-chart-canvas");

  charts.primary = new window.Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: rows.map((row) => row.periodLabel),
      datasets: [
        {
          label: "Incoming Female",
          data: rows.map((row) => row.incomingFemale),
          backgroundColor: "rgba(212, 168, 67, 0.85)",
        },
        {
          label: "Incoming Male",
          data: rows.map((row) => row.incomingMale),
          backgroundColor: "rgba(74, 158, 218, 0.75)",
        },
        {
          label: "Outgoing Female",
          data: rows.map((row) => row.outgoingFemale),
          backgroundColor: "rgba(212, 168, 67, 0.58)",
        },
        {
          label: "Outgoing Male",
          data: rows.map((row) => row.outgoingMale),
          backgroundColor: "rgba(74, 158, 218, 0.48)",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: { color: "rgba(232,234,240,0.55)", font: { size: 11 } },
        },
        y: {
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: {
            color: "rgba(232,234,240,0.55)",
            font: { size: 11 },
            callback: (v) => `${v}%`,
          },
          beginAtZero: true,
        },
      },
      plugins: {
        legend: {
          display: true,
          position: "bottom",
          labels: {
            color: "rgba(232,234,240,0.70)",
            font: { family: "'IBM Plex Sans', sans-serif", size: 11 },
            boxWidth: 10,
            boxHeight: 10,
            padding: 14,
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`,
          },
        },
      },
      barPercentage: 0.65,
      categoryPercentage: 0.75,
    },
  });

  return true;
}

function buildGenderTimelineRows(context) {
  const active = new Set(
    context.state.selectedSegments?.length
      ? context.state.selectedSegments
      : [context.state.segment]
  );

  const rows = dataset.splits[context.state.scope]
    .filter((row) => row.splitType === "gender")
    .filter((row) => active.has(row.segment))
    .filter((row) => context.state.year === "All" || row.year === Number(context.state.year))
    .filter(
      (row) =>
        context.state.quarter === "All" || row.quarter === Number(context.state.quarter)
    );

  const byPeriod = new Map();
  rows.forEach((row) => {
    const key = row.sortValue;
    if (!byPeriod.has(key)) {
      byPeriod.set(key, {
        periodLabel: row.periodLabel,
        sortValue: row.sortValue,
        incomingFemaleCount: 0,
        incomingMaleCount: 0,
        outgoingFemaleCount: 0,
        outgoingMaleCount: 0,
        incomingFemalePcts: [],
        incomingMalePcts: [],
        outgoingFemalePcts: [],
        outgoingMalePcts: [],
      });
    }
    const slot = byPeriod.get(key);
    if (row.flow === "incoming" && row.splitValue === "Women") {
      if (Number.isFinite(row.countValue)) slot.incomingFemaleCount += row.countValue;
      if (Number.isFinite(row.pctValue)) slot.incomingFemalePcts.push(row.pctValue);
    }
    if (row.flow === "incoming" && row.splitValue === "Men") {
      if (Number.isFinite(row.countValue)) slot.incomingMaleCount += row.countValue;
      if (Number.isFinite(row.pctValue)) slot.incomingMalePcts.push(row.pctValue);
    }
    if (row.flow === "outgoing" && row.splitValue === "Women") {
      if (Number.isFinite(row.countValue)) slot.outgoingFemaleCount += row.countValue;
      if (Number.isFinite(row.pctValue)) slot.outgoingFemalePcts.push(row.pctValue);
    }
    if (row.flow === "outgoing" && row.splitValue === "Men") {
      if (Number.isFinite(row.countValue)) slot.outgoingMaleCount += row.countValue;
      if (Number.isFinite(row.pctValue)) slot.outgoingMalePcts.push(row.pctValue);
    }
  });

  function pctFromCounts(numerator, denominator, fallbackPcts) {
    const total = numerator + denominator;
    if (total > 0) return (numerator / total) * 100;
    const clean = fallbackPcts.filter(Number.isFinite);
    return clean.length ? clean.reduce((s, v) => s + v, 0) / clean.length : null;
  }

  return [...byPeriod.values()]
    .sort((a, b) => a.sortValue - b.sortValue)
    .map((row) => ({
      periodLabel: row.periodLabel,
      incomingFemale: pctFromCounts(row.incomingFemaleCount, row.incomingMaleCount, row.incomingFemalePcts),
      incomingMale: pctFromCounts(row.incomingMaleCount, row.incomingFemaleCount, row.incomingMalePcts),
      outgoingFemale: pctFromCounts(row.outgoingFemaleCount, row.outgoingMaleCount, row.outgoingFemalePcts),
      outgoingMale: pctFromCounts(row.outgoingMaleCount, row.outgoingFemaleCount, row.outgoingMalePcts),
    }));
}

function renderInternalExternalDonuts(context) {
  if (!hasChartJs()) return false;
  const latest = context.appointmentRows;
  if (!latest.length) return false;

  const incoming = splitFlow(latest, "incoming");
  const outgoing = splitFlow(latest, "outgoing");

  els.mainChart.innerHTML = `
    <div class="donut-pair">
      <div class="donut-item">
        <canvas id="chart-internal-incoming"></canvas>
        <div class="donut-label">Incoming</div>
      </div>
      <div class="donut-item">
        <canvas id="chart-internal-outgoing"></canvas>
        <div class="donut-label">Outgoing</div>
      </div>
    </div>
  `;

  const incomingChart = buildDonutChart(
    document.getElementById("chart-internal-incoming"),
    incoming
  );
  const outgoingChart = buildDonutChart(
    document.getElementById("chart-internal-outgoing"),
    outgoing
  );
  charts.secondary = [incomingChart, outgoingChart];
  return true;
}

function splitFlow(rows, flow) {
  const filtered = rows.filter((row) => row.flow === flow);
  const internal = filtered.find((row) => row.splitValue === "Internal")?.pctValue ?? 0;
  const external = filtered.find((row) => row.splitValue === "External")?.pctValue ?? 0;
  return { internal, external };
}

function buildDonutChart(canvas, values) {
  const centerTextPlugin = {
    id: "centerText",
    afterDraw(chart) {
      const { ctx } = chart;
      const total = chart.data.datasets[0].data.reduce((sum, value) => sum + value, 0);
      const text = `${total.toFixed(1)}%`;
      const meta = chart.getDatasetMeta(0).data[0];
      if (!meta) return;
      ctx.save();
      ctx.fillStyle = "rgba(232,234,240,0.85)";
      ctx.font = "500 13px 'IBM Plex Mono'";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, meta.x, meta.y);
      ctx.restore();
    },
  };

  return new window.Chart(canvas.getContext("2d"), {
    type: "doughnut",
    plugins: [centerTextPlugin],
    data: {
      labels: ["Internal", "External"],
      datasets: [
        {
          data: [values.internal, values.external],
          backgroundColor: ["rgba(74,158,218,0.85)", "rgba(212,168,67,0.80)"],
          borderColor: ["rgba(74,158,218,1)", "rgba(212,168,67,1)"],
          borderWidth: 1.5,
          hoverOffset: 4,
        },
      ],
    },
    options: {
      cutout: "68%",
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          position: "bottom",
          labels: {
            color: "rgba(232,234,240,0.70)",
            font: { size: 11 },
            boxWidth: 10,
            padding: 12,
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${ctx.parsed.toFixed(1)}%`,
          },
        },
      },
    },
  });
}

function round1(value) {
  return Number.isFinite(value) ? Number(value).toFixed(1) : "n/a";
}

function stdDev(values) {
  const clean = values.filter(Number.isFinite);
  if (clean.length < 2) return 0;
  const mean = average(clean);
  const variance = clean.reduce((acc, value) => acc + (value - mean) ** 2, 0) / clean.length;
  return Math.sqrt(variance);
}

function trendLabel(delta) {
  if (!Number.isFinite(delta)) return "stable";
  if (delta >= 0.6) return "clear acceleration";
  if (delta >= 0.2) return "moderate acceleration";
  if (delta <= -0.6) return "clear cooling";
  if (delta <= -0.2) return "moderate cooling";
  return "range-bound behavior";
}

function volatilityLabel(vol) {
  if (!Number.isFinite(vol)) return "normal";
  if (vol >= 1.2) return "high";
  if (vol >= 0.8) return "elevated";
  return "contained";
}

function getSeriesStats(context) {
  const series = (context.visibleSeries || []).filter(
    (row) => Number.isFinite(row.outgoingPct) && Number.isFinite(row.incomingPct)
  );
  if (!series.length) return null;
  const outgoing = series.map((row) => row.outgoingPct);
  const incoming = series.map((row) => row.incomingPct);
  const latest = series.at(-1);
  const first = series[0];
  const peak = series.reduce((best, row) => (row.outgoingPct > best.outgoingPct ? row : best), series[0]);
  const trough = series.reduce((best, row) => (row.outgoingPct < best.outgoingPct ? row : best), series[0]);
  const latestSpread = latest.outgoingPct - latest.incomingPct;
  const avgSpread = average(outgoing.map((v, i) => v - incoming[i]));
  return {
    series,
    latest,
    first,
    peak,
    trough,
    avgOutgoing: average(outgoing),
    avgIncoming: average(incoming),
    trendDelta: latest.outgoingPct - first.outgoingPct,
    latestSpread,
    avgSpread,
    outgoingVol: stdDev(outgoing),
  };
}

function getSelectedSegmentLabel() {
  const selectedCount = state.selectedSegments?.length || 1;
  return selectedCount > 1
    ? `${selectedCount} selected segments`
    : displayLabel(state.selectedSegments?.[0] || state.segment);
}

function getLikelyDriverHints(context) {
  const latestYear = context.latestPoint?.year;
  const latestQuarter = context.latestPoint?.quarter;
  const segment = displayLabel(state.selectedSegments?.[0] || state.segment);
  const hints = [];
  if (Number.isFinite(latestYear) && periodDriverMap[latestYear]) {
    hints.push(...periodDriverMap[latestYear].slice(0, 2));
  }
  if (latestQuarter === 4) {
    hints.push("year-end board succession decisions and compensation-cycle resets");
  }
  if (state.scope === "index") {
    const region = indexRegionMap[segment];
    if (region && regionDriverMap[region]) hints.push(...regionDriverMap[region].slice(0, 2));
  } else {
    if (/tech|software|digital|media/i.test(segment)) {
      hints.push("AI-driven strategy pivots and product-cycle pressure");
    } else if (/financial|bank|insurance/i.test(segment)) {
      hints.push("rate-cycle effects and regulatory capital pressure");
    } else if (/industrial|natural resources|energy|materials/i.test(segment)) {
      hints.push("commodity-price cyclicality and energy-transition capex pressure");
    } else if (/health|pharma|biotech/i.test(segment)) {
      hints.push("pipeline execution risk and patent-cycle pressure");
    } else {
      hints.push("board pressure for execution certainty and margin discipline");
    }
  }
  return [...new Set(hints)].slice(0, 3);
}

function formatDriverSentence(hints) {
  if (!hints?.length) return "Likely contributors include cyclical macro pressure and board-level performance accountability.";
  if (hints.length === 1) return `Likely contributors include ${hints[0]}.`;
  if (hints.length === 2) return `Likely contributors include ${hints[0]} and ${hints[1]}.`;
  return `Likely contributors include ${hints[0]}, ${hints[1]}, and ${hints[2]}.`;
}

function peerRankSummary(context) {
  const rows = (context.comparisonRows || []).filter((row) => Number.isFinite(row.outgoingPct));
  if (!rows.length) return "Peer ranking is unavailable for the current filter.";
  const selected = state.selectedSegments?.length ? state.selectedSegments : [state.segment];
  const chosen = rows.filter((row) => selected.includes(row.segment));
  if (!chosen.length) return "Peer ranking is unavailable for the selected segment.";
  const ranked = [...rows].sort((a, b) => b.outgoingPct - a.outgoingPct);
  const target = chosen[0];
  const rank = Math.max(1, ranked.findIndex((row) => row.segment === target.segment) + 1);
  const total = ranked.length;
  return `${displayLabel(target.segment)} ranks ${rank}/${total} on latest outgoing turnover (${round1(
    target.outgoingPct
  )}%).`;
}

function buildFlagshipInsight(context, filterLabel) {
  const stats = getSeriesStats(context);
  if (!stats) return `<p><strong>No valid series is visible for ${filterLabel}.</strong> Adjust segment, year, or quarter filters to generate interpretation.</p>`;
  const latest = stats.latest;
  const prev = context.previousPoint;
  const qoq = deltaLabel(latest.outgoingPct, prev?.outgoingPct);
  const driverSentence = formatDriverSentence(getLikelyDriverHints(context));
  return `
    <p><strong>Outgoing turnover is ${formatPct(latest.outgoingPct)} in ${latest.periodLabel}, with ${qoq} quarter-on-quarter and ${trendLabel(
      stats.trendDelta
    )} versus the start of the visible window.</strong> The visible peak is ${round1(
      stats.peak.outgoingPct
    )}% (${stats.peak.periodLabel}) and the trough is ${round1(stats.trough.outgoingPct)}% (${stats.trough.periodLabel}), indicating ${volatilityLabel(
      stats.outgoingVol
    )} turnover volatility.</p>
    <p>Latest outgoing-incoming spread is ${round1(stats.latestSpread)} pts versus a visible-window average of ${round1(
      stats.avgSpread
    )} pts. ${driverSentence} This interpretation is generated from the selected lens (${filterLabel}) plus period/region heuristics.</p>
  `;
}

function buildRegionalInsight(context, filterLabel) {
  const ranked = (context.mapRows || [])
    .filter((row) => Number.isFinite(row.outgoingPct))
    .sort((a, b) => b.outgoingPct - a.outgoingPct);
  if (!ranked.length) return `<p><strong>No regional rows are available for ${filterLabel}.</strong></p>`;
  const top = ranked.slice(0, 3).map((row) => `${row.displaySegment} (${round1(row.outgoingPct)}%)`).join(", ");
  const bottom = ranked.at(-1);
  return `
    <p><strong>Regional pressure is concentrated in ${top} under ${filterLabel}.</strong> The spread between the highest and lowest mapped rows is ${round1(
      ranked[0].outgoingPct - bottom.outgoingPct
    )} pts, which suggests materially different succession regimes across markets.</p>
    <p>In practice, that dispersion usually aligns with differences in rate sensitivity, sector composition, and policy uncertainty by region rather than a single global driver.</p>
  `;
}

function buildSegmentInsight(context, filterLabel) {
  const ranked = (context.comparisonRows || [])
    .filter((row) => Number.isFinite(row.outgoingPct))
    .sort((a, b) => b.outgoingPct - a.outgoingPct);
  if (!ranked.length) return `<p><strong>No segment comparison rows are available for ${filterLabel}.</strong></p>`;
  const top = ranked[0];
  const second = ranked[1];
  const bottom = ranked.at(-1);
  const gapTop = second ? top.outgoingPct - second.outgoingPct : 0;
  return `
    <p><strong>${displayLabel(top.segment)} currently leads outgoing turnover at ${round1(top.outgoingPct)}%.</strong> ${
      second
        ? `Its lead over the next segment is ${round1(gapTop)} pts, suggesting ${gapTop >= 0.6 ? "clear concentration" : "a relatively tight peer cluster"}.`
        : "No second-ranked comparator is available in the current slice."
    }</p>
    <p>Top-to-bottom spread is ${round1(top.outgoingPct - bottom.outgoingPct)} pts. Persistent wide spreads typically indicate that succession pressure is being driven by sector-specific profitability, regulation, or strategic reset cycles.</p>
  `;
}

function buildTenureInsight(context, filterLabel) {
  const series = (context.visibleSeries || []).filter((row) => Number.isFinite(row.avgOutgoingTenureYears));
  if (!series.length) return `<p><strong>No tenure history is available for ${filterLabel}.</strong></p>`;
  const latest = series.at(-1);
  const avgTenure = average(series.map((row) => row.avgOutgoingTenureYears));
  const first = series[0];
  const delta = latest.avgOutgoingTenureYears - first.avgOutgoingTenureYears;
  return `
    <p><strong>Latest outgoing tenure is ${round1(latest.avgOutgoingTenureYears)} years (${latest.periodLabel}), versus a visible-window average of ${round1(
      avgTenure
    )} years.</strong> Compared with the first visible period, tenure is ${delta >= 0 ? "up" : "down"} ${round1(Math.abs(delta))} years.</p>
    <p>${delta < 0 ? "Falling tenure with stable/high turnover is usually consistent with faster board intervention and tighter performance accountability." : "Longer tenure with contained turnover usually signals strategic continuity and a lower urgency to refresh leadership."} Lens: ${filterLabel}.</p>
  `;
}

function buildGenderInsight(context, filterLabel) {
  const rows = buildGenderTimelineRows(context).filter(
    (row) => Number.isFinite(row.incomingFemale) && Number.isFinite(row.outgoingFemale)
  );
  if (!rows.length) return `<p><strong>No gender composition history is available for ${filterLabel}.</strong></p>`;
  const latest = rows.at(-1);
  const first = rows[0];
  const inDelta = latest.incomingFemale - first.incomingFemale;
  const outDelta = latest.outgoingFemale - first.outgoingFemale;
  return `
    <p><strong>Latest female share is ${round1(latest.incomingFemale)}% on incoming and ${round1(latest.outgoingFemale)}% on outgoing flows.</strong> Versus the start of the visible window, incoming female share is ${inDelta >= 0 ? "up" : "down"} ${round1(
      Math.abs(inDelta)
    )} pts and outgoing is ${outDelta >= 0 ? "up" : "down"} ${round1(Math.abs(outDelta))} pts.</p>
    <p>${inDelta > outDelta ? "Incoming representation improving faster than outgoing typically signals gradual pipeline deepening." : "When incoming does not outpace outgoing, progress is usually more cyclical than structural."} Lens: ${filterLabel}.</p>
  `;
}

function buildAppointmentsInsight(context, filterLabel) {
  const rows = context.appointmentRows || [];
  if (!rows.length) return `<p><strong>No internal/external split is available for ${filterLabel}.</strong></p>`;
  const incomingInternal = rows.find((r) => r.flow === "incoming" && r.splitValue === "Internal")?.pctValue ?? null;
  const incomingExternal = rows.find((r) => r.flow === "incoming" && r.splitValue === "External")?.pctValue ?? null;
  const outgoingInternal = rows.find((r) => r.flow === "outgoing" && r.splitValue === "Internal")?.pctValue ?? null;
  const outgoingExternal = rows.find((r) => r.flow === "outgoing" && r.splitValue === "External")?.pctValue ?? null;
  const incomingGap = Number.isFinite(incomingExternal) && Number.isFinite(incomingInternal) ? incomingExternal - incomingInternal : null;
  const outgoingGap = Number.isFinite(outgoingExternal) && Number.isFinite(outgoingInternal) ? outgoingExternal - outgoingInternal : null;
  return `
    <p><strong>Incoming pathway mix is ${round1(incomingInternal)}% internal vs ${round1(
      incomingExternal
    )}% external; outgoing mix is ${round1(outgoingInternal)}% internal vs ${round1(outgoingExternal)}% external.</strong></p>
    <p>${Number.isFinite(incomingGap) && incomingGap > 0 ? "External hires currently exceed internal promotions on incoming transitions, which often points to transformation mandates or capability gaps." : "Internal pathways are at least as strong as external hiring on incoming transitions, typically consistent with deeper succession bench strength."} ${Number.isFinite(outgoingGap) ? `Outgoing external-vs-internal gap is ${round1(
      outgoingGap
    )} pts.` : ""} Lens: ${filterLabel}.</p>
  `;
}

function updateAnalysisPanel(viewKey, context) {
  if (!els.analysisOutput) return;
  if (analysisTimer) clearTimeout(analysisTimer);
  const selectedCount = state.selectedSegments?.length || 1;
  const segmentLabel =
    selectedCount > 1
      ? `${selectedCount} selected segments`
      : displayLabel(state.selectedSegments?.[0] || state.segment);
  const filterLabel = `${scopeLabels[state.scope]} · ${segmentLabel} · ${
    state.year === "All" ? "All years" : state.year
  } · ${state.quarter === "All" ? "All quarters" : `Q${state.quarter}`}`;

  const builder = analysisCopy[viewKey] || analysisCopy.flagship;
  const cacheKey = [
    viewKey,
    state.scope,
    state.year,
    state.quarter,
    ...(state.selectedSegments || []),
    context.latestPoint?.periodLabel || "",
    round1(context.latestPoint?.outgoingPct),
  ].join("|");
  const html =
    analysisCache.get(cacheKey) ||
    (() => {
      const output = builder({ context, filterLabel });
      analysisCache.set(cacheKey, output);
      return output;
    })();
  els.analysisOutput.classList.add("updating");
  analysisTimer = window.setTimeout(() => {
    els.analysisOutput.innerHTML = html;
    els.analysisOutput.classList.remove("updating");
  }, 180);
}

function average(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

// ── INTRO MODAL ──
(function () {
  const overlay = document.getElementById("intro-overlay");
  const closeBtn = document.getElementById("intro-close-btn");
  const enterBtn = document.getElementById("intro-enter-btn");
  const aboutBtn = document.getElementById("about-btn");

  function dismissModal() {
    if (!overlay) return;
    overlay.classList.add("hidden");
  }

  function openModal() {
    if (!overlay) return;
    overlay.classList.remove("hidden");
  }

  if (closeBtn) closeBtn.addEventListener("click", dismissModal);
  if (enterBtn) enterBtn.addEventListener("click", dismissModal);
  if (aboutBtn) aboutBtn.addEventListener("click", openModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") dismissModal();
  });

  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) dismissModal();
    });
  }
})();

// ── HERO BANNER SCROLL FADE ──
(function () {
  const header = document.querySelector(".brand-header");
  const content = document.querySelector(".brand-header-content");
  const bridge = document.querySelector(".hero-bridge");
  if (!header || !content) return;

  const shell = document.querySelector(".yahoo-shell") || document.documentElement;

  function onScroll() {
    const scrollY = shell.scrollTop || window.scrollY;
    const bannerHeight = header.offsetHeight;
    const bridgeHeight = bridge ? bridge.offsetHeight : 0;
    const heroZone = bannerHeight + bridgeHeight;
    const fadeEnd = bannerHeight * 0.55;
    const opacity = Math.max(0, 1 - scrollY / fadeEnd);
    content.style.opacity = opacity;
    const heroOpacity = Math.max(0.82, 1 - scrollY / (heroZone * 1.3));
    header.style.setProperty("--hero-opacity", heroOpacity.toFixed(3));
    if (bridge) {
      const bridgeOpacity = Math.max(0.4, 1 - scrollY / (heroZone * 1.15));
      bridge.style.opacity = bridgeOpacity.toFixed(3);
    }

    const revealStart = heroZone * 0.1;
    const revealRange = heroZone * 0.2;
    const revealProgress = Math.min(1, Math.max(0, (scrollY - revealStart) / revealRange));
    const blurPx = (1 - revealProgress) * 2.2;
    const belowOpacity = 0.96 + revealProgress * 0.04;
    shell.style.setProperty("--below-blur", `${blurPx.toFixed(2)}px`);
    shell.style.setProperty("--below-opacity", belowOpacity.toFixed(3));
  }

  const scrollTarget = shell.scrollTop !== undefined ? shell : window;
  scrollTarget.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();
