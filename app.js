import {
  buildViewContext,
  createDefaultState,
  describePeriodFilter,
  displayLabel,
  formatCount,
  formatPct,
  getSegmentOptions,
  getYearOptions,
  loadDashboardData,
  segmentOptionLabel,
} from "./shared/data.js";
import { getTrendData, initTooltip, renderHomeView, renderKpis, updateHomeMeta } from "./shared/charts.js";

const state = createDefaultState();
const els = {
  scopeToggle: document.getElementById("scope-toggle"),
  segmentSelect: document.getElementById("segment-select"),
  yearSelect: document.getElementById("year-select"),
  quarterSelect: document.getElementById("quarter-select"),
  benchmarkSelect: document.getElementById("benchmark-select"),
  benchmarkSummary: document.getElementById("benchmark-summary"),
  benchmarkList: document.getElementById("benchmark-list"),
  coverageNote: document.getElementById("coverage-note"),
  kpiStrip: document.getElementById("kpi-strip"),
  viewNav: document.getElementById("view-nav"),
  chartTitle: document.getElementById("chart-title"),
  chartContext: document.getElementById("chart-context"),
  quarterHeadline: document.getElementById("quarter-headline"),
  mainChart: document.getElementById("main-chart"),
  changeOutput: document.getElementById("change-output"),
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

let dataset;
let worldCountriesPromise = null;
let cleanupMapInteractions = null;
let regionalLeafletMap = null;
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

const aboutDialog = document.getElementById("about-dialog");
document.querySelectorAll("[data-about]").forEach((button) => button.addEventListener("click", () => aboutDialog.showModal()));

// Shared chart styling, matching the governance hub (RubiCo Desk palette).
const THEME = {
  ink: "#e9e2d0",
  ink2: "#c5bfae",
  muted: "#958f80",
  grid: "rgba(46, 59, 79, 0.55)",
  surface: "#111a26",
  gold: "#b39a62",
  goldSoft: "rgba(179, 154, 98, 0.55)",
  blue: "#7f9fbd",
  blueSoft: "rgba(127, 159, 189, 0.5)",
  slate: "#4a5f75",
  font: "'Inter', system-ui, sans-serif",
};

if (hasChartJs()) {
  window.Chart.defaults.font.family = THEME.font;
  window.Chart.defaults.font.size = 11;
  window.Chart.defaults.color = THEME.muted;
  window.Chart.defaults.borderColor = THEME.grid;
  Object.assign(window.Chart.defaults.plugins.tooltip, {
    backgroundColor: "#162130",
    borderColor: "#2e3b4f",
    borderWidth: 1,
    titleColor: THEME.muted,
    bodyColor: THEME.ink,
    titleFont: { family: THEME.font, size: 11, weight: "500" },
    bodyFont: { family: THEME.font, size: 12 },
    padding: 9,
    cornerRadius: 4,
    boxPadding: 4,
    displayColors: true,
  });
}

initialize();

async function initialize() {
  try {
    dataset = await loadDashboardData();
    initTooltip(els.tooltip);
    bindEvents();
    populateControls();
    await render();
  } catch (error) {
    console.error(error);
    els.quarterHeadline.textContent = "CEO turnover data is unavailable.";
    els.changeOutput.textContent = "Reload the page to try again.";
  }
}

function bindEvents() {
  els.scopeToggle.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-scope]");
    if (!button || button.dataset.scope === state.scope) return;
    state.scope = button.dataset.scope;
    state.benchmarks = [];
    updatePressedButtons(els.scopeToggle, button);
    refreshSegmentOptions();
    render();
  });

  els.viewNav.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-view]");
    if (!button || button.dataset.view === state.view) return;
    state.view = button.dataset.view;
    els.benchmarkSelect.open = false;
    updatePressedButtons(els.viewNav, button);
    render();
  });

  for (const key of ["segment", "year", "quarter"]) {
    els[`${key}Select`].addEventListener("change", (event) => {
      state[key] = event.target.value;
      if (key === "segment") {
        state.benchmarks = state.benchmarks.filter((segment) => segment !== state.segment);
        refreshBenchmarkOptions();
      }
      render();
    });
  }

  els.benchmarkList.addEventListener("change", () => {
    state.benchmarks = Array.from(els.benchmarkList.querySelectorAll("input:checked"), (input) => input.value);
    render();
  });

  els.benchmarkSelect.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && els.benchmarkSelect.open) {
      els.benchmarkSelect.open = false;
      els.benchmarkSummary.focus();
    }
  });

  document.addEventListener("click", (event) => {
    if (!els.benchmarkSelect.contains(event.target)) els.benchmarkSelect.open = false;
  });
}

function updatePressedButtons(group, activeButton) {
  group.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button === activeButton);
    button.setAttribute("aria-pressed", String(button === activeButton));
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
  if (!segments.includes(state.segment)) state.segment = segments[0];
  els.segmentSelect.replaceChildren(...segments.map((segment) =>
    new Option(segmentOptionLabel(dataset, state.scope, segment), segment)
  ));
  els.segmentSelect.value = state.segment;
  refreshBenchmarkOptions();
}

function refreshBenchmarkOptions() {
  const options = getSegmentOptions(dataset, state.scope)
    .filter((segment) => segment !== state.segment)
    .map((segment) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = segment;
      input.checked = state.benchmarks.includes(segment);
      label.append(input, displayLabel(segment));
      return label;
    });
  els.benchmarkList.replaceChildren(...options);
}

function render() {
  const cycle = ++renderCycle;
  const context = buildViewContext(dataset, state);
  els.benchmarkSelect.hidden = state.view !== "flagship";
  els.benchmarkSummary.textContent = state.benchmarks.length
    ? `Compare benchmarks (${state.benchmarks.length})`
    : "Compare benchmarks";
  renderKpis(els.kpiStrip, context);
  updateHomeMeta(context, els, state.view);
  renderQuarterHeadline(context);
  renderChanges(context);
  return renderMainView(context, cycle);
}

function renderQuarterHeadline(context) {
  const { latestPoint, yearEarlier, state } = context;
  const segment = displayLabel(state.segment);
  if (!latestPoint) {
    els.quarterHeadline.textContent = `No data for ${segment} in ${describePeriodFilter(state)}.`;
    return;
  }

  const period = `Q${latestPoint.quarter} ${latestPoint.year}`;
  if (!Number.isFinite(latestPoint.outgoingPct)) {
    els.quarterHeadline.textContent = `${segment} CEO departure rate is unavailable for ${period}.`;
    return;
  }

  const rate = formatPct(latestPoint.outgoingPct);
  const previous = yearEarlier?.outgoingPct;
  if (!Number.isFinite(previous)) {
    els.quarterHeadline.textContent = `${segment} CEO departure rate was ${rate} in ${period}.`;
    return;
  }

  const rateChange = latestPoint.outgoingPct - previous;
  const verb = rateChange < 0 ? "fell to" : "rose to";
  els.quarterHeadline.textContent = rateChange === 0
    ? `${segment} CEO departure rate was unchanged at ${rate} in ${period} year over year.`
    : `${segment} CEO departure rate ${verb} ${rate} in ${period}, from ${formatPct(previous)} a year earlier.`;
}

function renderChanges(context) {
  const { latestPoint, priorQuarter, yearEarlier } = context;
  if (!latestPoint) {
    els.changeOutput.textContent = "No data for the selected period.";
    return;
  }

  const earlierYear = latestPoint.year - 1;
  const previousPeriod = latestPoint.quarter === 1
    ? `${earlierYear} Q4`
    : `${latestPoint.year} Q${latestPoint.quarter - 1}`;
  const rows = [
    ["Selected quarter", latestPoint.periodLabel, latestPoint],
    ["Prior quarter", previousPeriod, priorQuarter],
    ["Same quarter last year", `${earlierYear} Q${latestPoint.quarter}`, yearEarlier],
  ];
  els.changeOutput.innerHTML = `
    <table class="change-table" aria-label="${latestPoint.displaySegment} turnover comparison">
      <thead><tr><th scope="col">Period</th><th scope="col">Departures</th><th scope="col">Appointments</th></tr></thead>
      <tbody>
        ${rows.map(([label, period, row]) => `
          <tr>
            <th scope="row"><strong>${period}</strong><span>${label}</span></th>
            ${row ? `
              <td><strong>${formatPct(row.outgoingPct)}</strong><span>${formatCount(row.outgoingCount)} CEOs</span></td>
              <td><strong>${formatPct(row.incomingPct)}</strong><span>${formatCount(row.incomingCount)} CEOs</span></td>
            ` : '<td colspan="2">Data unavailable</td>'}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
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
    if (!success && cycle === renderCycle) renderHomeView(els.mainChart, "regional", context);
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
  if (regionalLeafletMap) {
    regionalLeafletMap.remove();
    regionalLeafletMap = null;
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
  const { periods, lines } = getTrendData(context);
  if (!periods.length) return false;

  els.mainChart.innerHTML = '<canvas id="flagship-chart-canvas" role="img"></canvas>';
  const canvas = document.getElementById("flagship-chart-canvas");
  canvas.setAttribute("aria-label", els.chartTitle.textContent);
  const chart = new window.Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels: periods.map((row) => row.periodLabel),
      datasets: lines.map((line) => ({
        label: line.label,
        data: line.points.map((point) => point?.rate ?? null),
        borderColor: line.color,
        backgroundColor: line.color,
        borderDash: line.dash,
        pointRadius: 0,
        pointHoverRadius: 3.5,
        borderWidth: 1.75,
        tension: 0,
      })),
    },
    options: {
      responsive: true,
      animation: false,
      maintainAspectRatio: false,
      layout: {
        padding: {
          bottom: 8,
        },
      },
      interaction: { intersect: false, mode: "index" },
      scales: {
        x: {
          grid: { display: false },
          border: { color: THEME.grid },
          ticks: {
            display: true,
            color: THEME.muted,
            font: { size: 11 },
            padding: 8,
            autoSkip: true,
            maxTicksLimit: window.matchMedia("(max-width: 560px)").matches ? 5 : 10,
            maxRotation: 0,
            minRotation: 0,
            callback: (value) => periods[value]?.periodLabel ?? "",
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: THEME.grid },
          border: { display: false },
          ticks: {
            color: THEME.muted,
            font: { size: 11 },
            maxTicksLimit: 6,
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
            color: THEME.ink2,
            font: { family: THEME.font, size: 11 },
            boxWidth: 16,
            boxHeight: 2,
            padding: 14,
            usePointStyle: true,
            pointStyle: "line",
            pointStyleWidth: 28,
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const point = lines[ctx.datasetIndex].points[ctx.dataIndex];
              return `${ctx.dataset.label}: ${formatPct(point.rate)} (${formatCount(point.count)} CEOs)`;
            },
          },
        },
      },
    },
  });

  charts.primary = chart;
  return true;
}

async function renderRegionalMapChart(context, cycle) {
  if (!context.mapRows.length) return false;
  const countries = await loadWorldCountries();
  if (cycle !== renderCycle) return true;
  const leafletRendered = renderRegionalLeafletMap(context, countries);
  if (leafletRendered) return true;

  try {
    if (!window.Chart) return false;
    const hasGeoBubbleController =
      !!window.Chart.registry?.controllers?.get?.("bubbleMap") ||
      !!window.Chart.registry?.controllers?.get?.("choropleth");
    if (!window.topojson || !hasGeoBubbleController) {
      return renderRegionalScatterFallback(context);
    }

    if (cycle !== renderCycle) return true;
    if (!countries?.features?.length) return renderRegionalScatterFallback(context);

    const nodes = context.mapRows;
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
            outlineBackgroundColor: "#162130",
            outlineBorderColor: "#2e3b4f",
            data: bubblesArray,
            backgroundColor: THEME.goldSoft,
            borderColor: THEME.gold,
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

function renderRegionalLeafletMap(context, countries) {
  if (!window.L || !countries) return false;
  const nodes = context.mapRows;
  const scoped = nodes.filter((row) => indexCoordinates[row.displaySegment]);
  if (!scoped.length) return false;

  const maxValue = Math.max(...scoped.map((row) => row.outgoingPct || 0), 1);
  const minValue = Math.min(...scoped.map((row) => row.outgoingPct || 0), 0);
  const duplicateTracker = {};
  const jitter = [0, 0.18, -0.18, 0.32, -0.32];

  els.mainChart.innerHTML = `<div id="regional-leaflet-map" class="regional-leaflet-map" aria-label="Regional turnover map"></div>`;
  const mapEl = document.getElementById("regional-leaflet-map");
  if (!mapEl) return false;

  const map = window.L.map(mapEl, {
    zoomControl: true,
    scrollWheelZoom: true,
    dragging: true,
    minZoom: 1,
    maxZoom: 6,
  }).setView([24, 8], 2);

  window.L.geoJSON(countries, {
    interactive: false,
    style: { color: "#2e3b4f", weight: 0.6, fillColor: "#162130", fillOpacity: 1 },
    attribution: '<a href="https://www.naturalearthdata.com/">Natural Earth</a>',
  }).addTo(map);

  const layer = window.L.featureGroup().addTo(map);

  scoped.forEach((row) => {
    const coords = indexCoordinates[row.displaySegment];
    const key = `${coords.lat.toFixed(2)}_${coords.lon.toFixed(2)}`;
    const count = duplicateTracker[key] || 0;
    duplicateTracker[key] = count + 1;

    const lat = coords.lat + (count ? jitter[count % jitter.length] * 0.65 : 0);
    const lon = coords.lon + (count ? jitter[count % jitter.length] : 0);
    const outgoing = row.outgoingPct || 0;
    const incoming = row.incomingPct || 0;
    const radius = 6 + ((outgoing - minValue) / (maxValue - minValue || 1)) * 10;

    const marker = window.L.circleMarker([lat, lon], {
      radius,
      color: THEME.gold,
      weight: 1,
      fillColor: THEME.gold,
      fillOpacity: 0.5,
    });

    marker.bindTooltip(
      `<strong>${row.displaySegment}</strong><br/>${row.periodLabel}<br/>Outgoing: ${outgoing.toFixed(
        1
      )}%<br/>Incoming: ${incoming.toFixed(1)}%`,
      {
        direction: "top",
        offset: [0, -4],
        className: "regional-map-tooltip",
      }
    );
    marker.bindPopup(
      `<div class="regional-map-popup"><strong>${row.displaySegment}</strong><div>${row.periodLabel}</div><div>Outgoing: ${outgoing.toFixed(
        1
      )}%</div><div>Incoming: ${incoming.toFixed(1)}%</div></div>`
    );
    marker.addTo(layer);
  });

  const bounds = layer.getBounds();
  if (bounds.isValid()) {
    map.fitBounds(bounds.pad(0.45), { animate: false });
  }
  regionalLeafletMap = map;
  setTimeout(() => map.invalidateSize(), 0);
  return true;
}

async function loadWorldCountries() {
  if (!worldCountriesPromise) {
    worldCountriesPromise = fetchWithTimeout(
      "./assets/world-countries.json",
      4500
    )
      .then((response) => {
        if (!response.ok) throw new Error("world map fetch failed");
        return response.json();
      })
      .catch((error) => {
        console.warn("Unable to load world map data", error);
        return null;
      });
  }
  return worldCountriesPromise;
}

function renderRegionalScatterFallback(context) {
  if (!hasChartJs()) return false;
  const nodes = context.mapRows;
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
          backgroundColor: THEME.goldSoft,
          borderColor: THEME.gold,
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
          grid: { color: THEME.grid },
          ticks: { color: THEME.muted, font: { size: 10 } },
        },
        y: {
          min: -60,
          max: 85,
          grid: { color: THEME.grid },
          ticks: { color: THEME.muted, font: { size: 10 } },
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
              ? THEME.gold
              : THEME.slate
          ),
          borderWidth: 0,
          borderRadius: 2,
          maxBarThickness: 14,
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
            color: THEME.ink2,
            autoSkip: false,
            maxRotation: 0,
          },
          grid: { display: false },
        },
        x: {
          ticks: {
            font: { size: 10 },
            color: THEME.muted,
            callback: (v) => `${v}%`,
          },
          grid: { color: THEME.grid },
          border: { display: false },
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
      animation: false,
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
          backgroundColor: THEME.gold,
          borderRadius: 1,
        },
        {
          label: "Incoming Male",
          data: rows.map((row) => row.incomingMale),
          backgroundColor: THEME.blue,
          borderRadius: 1,
        },
        {
          label: "Outgoing Female",
          data: rows.map((row) => row.outgoingFemale),
          backgroundColor: THEME.goldSoft,
          borderRadius: 1,
        },
        {
          label: "Outgoing Male",
          data: rows.map((row) => row.outgoingMale),
          backgroundColor: THEME.blueSoft,
          borderRadius: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          border: { color: THEME.grid },
          ticks: { color: THEME.muted, font: { size: 11 }, maxRotation: 0, autoSkipPadding: 12 },
        },
        y: {
          grid: { color: THEME.grid },
          border: { display: false },
          ticks: {
            color: THEME.muted,
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
            color: THEME.ink2,
            font: { family: THEME.font, size: 11 },
            boxWidth: 9,
            boxHeight: 9,
            padding: 14,
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`,
          },
        },
      },
      animation: false,
      barPercentage: 0.7,
      categoryPercentage: 0.72,
    },
  });

  return true;
}

function buildGenderTimelineRows(context) {
  const rows = context.genderTimeline;
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
      ctx.fillStyle = THEME.ink;
      ctx.font = "500 20px 'Cormorant Garamond', Georgia, serif";
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
          backgroundColor: [THEME.blue, THEME.gold],
          borderColor: THEME.surface,
          borderWidth: 2,
          hoverOffset: 3,
        },
      ],
    },
    options: {
      cutout: "74%",
      animation: false,
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          position: "bottom",
          labels: {
            color: THEME.ink2,
            font: { size: 11 },
            boxWidth: 9,
            boxHeight: 9,
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
