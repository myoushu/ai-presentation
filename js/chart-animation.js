// Chart animation for the Annual Trend slide
// Draws scatter points left-to-right smoothly, then reveals regression trend lines on fragment click

(function () {
  'use strict';

  const BASE_LAYOUT = {
    paper_bgcolor: '#1a1a2e',
    plot_bgcolor: '#16213e',
    font: { color: '#e0e0e0', size: 13 },
    margin: { t: 10, b: 50, l: 60, r: 20 },
    hovermode: 'closest',
    legend: {
      bgcolor: 'rgba(22,33,62,0.8)',
      font: { size: 11 },
      x: 0.02,
      y: 0.98
    }
  };

  function computeAnnualStats(data, startYear, endYear) {
    const years = [], avgHigh = [], avgLow = [];
    for (let y = startYear; y <= endYear; y++) {
      const d = data[y];
      if (!d) continue;
      const validHighs = d.highs.filter(v => v != null);
      const validLows = d.lows.filter(v => v != null);
      if (validHighs.length === 0 || validLows.length === 0) continue;
      years.push(y);
      avgHigh.push(validHighs.reduce((a, b) => a + b, 0) / validHighs.length);
      avgLow.push(validLows.reduce((a, b) => a + b, 0) / validLows.length);
    }
    return { years, avgHigh, avgLow };
  }

  function linearRegression(xs, ys) {
    const n = xs.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += xs[i]; sumY += ys[i];
      sumXY += xs[i] * ys[i]; sumXX += xs[i] * xs[i];
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    const line = xs.map(x => intercept + slope * x);
    return { slope, intercept, line };
  }

  // Smooth left-to-right drawing using requestAnimationFrame
  function animateDrawing(chartDiv, stats, durationMs) {
    const total = stats.years.length;
    let startTime = null;

    function frame(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / durationMs, 1);

      // Ease-out: fast start, gentle deceleration
      const eased = 1 - Math.pow(1 - progress, 2);
      const count = Math.max(1, Math.round(eased * total));

      Plotly.restyle(chartDiv, {
        x: [stats.years.slice(0, count), stats.years.slice(0, count)],
        y: [stats.avgHigh.slice(0, count), stats.avgLow.slice(0, count)]
      }, [0, 1]);

      if (progress < 1) {
        requestAnimationFrame(frame);
      }
    }

    requestAnimationFrame(frame);
  }

  // Initialize the chart with empty data then animate
  function initChart(chartDiv, data) {
    const startYear = Math.min(...Object.keys(data).map(Number));
    const endYear = Math.max(...Object.keys(data).map(Number));
    const stats = computeAnnualStats(data, startYear, endYear);

    // Store stats for the fragment handler
    chartDiv._stats = stats;

    // Pre-compute y-axis range
    const allTemps = stats.avgHigh.concat(stats.avgLow);
    const yMin = Math.floor(Math.min(...allTemps)) - 2;
    const yMax = Math.ceil(Math.max(...allTemps)) + 2;

    const traces = [
      {
        x: [], y: [], type: 'scatter', mode: 'lines+markers',
        name: 'Avg Annual High', line: { color: '#e57373', width: 2 },
        marker: { size: 5, color: '#e57373' },
        hovertemplate: '%{x}<br>Avg High: %{y:.1f}\u00b0F<extra></extra>'
      },
      {
        x: [], y: [], type: 'scatter', mode: 'lines+markers',
        name: 'Avg Annual Low', line: { color: '#4fc3f7', width: 2 },
        marker: { size: 5, color: '#4fc3f7' },
        hovertemplate: '%{x}<br>Avg Low: %{y:.1f}\u00b0F<extra></extra>'
      }
    ];

    const layout = {
      ...BASE_LAYOUT,
      xaxis: {
        title: 'Year',
        gridcolor: '#2a2a4a',
        dtick: 10,
        range: [startYear - 1, endYear + 1]
      },
      yaxis: {
        title: 'Temperature (\u00b0F)',
        gridcolor: '#2a2a4a',
        range: [yMin, yMax]
      }
    };

    Plotly.newPlot(chartDiv, traces, layout, { responsive: false, displayModeBar: false });

    // Animate over 4 seconds with smooth easing
    animateDrawing(chartDiv, stats, 4000);
  }

  // Add regression trend lines (called on fragment click)
  function addTrendLines(chartDiv) {
    const stats = chartDiv._stats;
    if (!stats) return;

    const regHigh = linearRegression(stats.years, stats.avgHigh);
    const regLow = linearRegression(stats.years, stats.avgLow);

    const trendTraces = [
      {
        x: stats.years, y: regHigh.line, type: 'scatter', mode: 'lines',
        name: `High trend (${regHigh.slope >= 0 ? '+' : ''}${regHigh.slope.toFixed(3)}\u00b0F/yr)`,
        line: { color: '#e57373', width: 3, dash: 'dash' },
        hoverinfo: 'skip'
      },
      {
        x: stats.years, y: regLow.line, type: 'scatter', mode: 'lines',
        name: `Low trend (${regLow.slope >= 0 ? '+' : ''}${regLow.slope.toFixed(3)}\u00b0F/yr)`,
        line: { color: '#4fc3f7', width: 3, dash: 'dash' },
        hoverinfo: 'skip'
      }
    ];

    Plotly.addTraces(chartDiv, trendTraces);
  }

  // --- Reveal.js Integration ---

  let initialized = false;
  let chartSlide = null;
  let chartDiv = null;

  function tryInit() {
    if (initialized) return;
    if (!chartSlide || !chartDiv) return;
    if (typeof WEATHER_DATA === 'undefined') return;

    // Check that this slide is currently active
    const currentSlide = Reveal.getCurrentSlide();
    if (currentSlide !== chartSlide) return;

    initialized = true;
    // Delay ensures the slide is visible and has layout dimensions
    setTimeout(function () {
      initChart(chartDiv, WEATHER_DATA);
    }, 250);
  }

  function setup() {
    if (typeof Reveal === 'undefined' || typeof WEATHER_DATA === 'undefined') return;

    chartSlide = document.querySelector('[data-chart-type="annual-trend"]');
    if (!chartSlide) return;

    chartDiv = chartSlide.querySelector('.chart-container');
    if (!chartDiv) return;

    // On slide navigation
    Reveal.on('slidechanged', function (event) {
      if (event.currentSlide === chartSlide) {
        tryInit();
      }
    });

    // On fragment click for trend lines
    Reveal.on('fragmentshown', function (event) {
      if (event.fragment.dataset.chartAction === 'show-trend-lines') {
        addTrendLines(chartDiv);
      }
    });

    // Check if we're already on the chart slide (direct URL navigation)
    tryInit();
  }

  // Ensure setup runs after both Reveal.js is ready AND the page is loaded
  function waitForReveal() {
    if (typeof Reveal === 'undefined') {
      // Reveal not loaded yet, wait
      window.addEventListener('load', waitForReveal);
      return;
    }
    if (Reveal.isReady && Reveal.isReady()) {
      setup();
    } else {
      Reveal.on('ready', setup);
    }
  }

  if (document.readyState === 'complete') {
    waitForReveal();
  } else {
    window.addEventListener('load', waitForReveal);
  }

})();
