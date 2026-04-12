// ASVZ-Stats chart rendering module
(function () {
  var instances = {};

  function occColor(pct) {
    if (pct < 50) return "#30a46c";
    if (pct < 80) return "#e5a000";
    return "#e5484d";
  }

  function occColorAlpha(pct, a) {
    if (pct < 50) return "rgba(48, 164, 108, " + a + ")";
    if (pct < 80) return "rgba(229, 160, 0, " + a + ")";
    return "rgba(229, 72, 77, " + a + ")";
  }

  var isDark = function () {
    return document.documentElement.getAttribute("data-theme") === "dark";
  };

  function gridColor() {
    return isDark() ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
  }

  function tickColor() {
    return isDark() ? "#5a5a5e" : "#aeaeb2";
  }

  function renderFacilityChart(canvasId, byHourData) {
    if (instances[canvasId]) {
      instances[canvasId].destroy();
      delete instances[canvasId];
    }

    var labels = [];
    var data = [];
    for (var h = 0; h < 24; h++) {
      labels.push(String(h).padStart(2, "0") + ":00");
      data.push(byHourData[String(h)] || 0);
    }

    var avgOcc = data.reduce(function (a, b) { return a + b; }, 0) / (data.filter(function (v) { return v > 0; }).length || 1);
    var color = occColor(avgOcc);
    var nowHour = new Date().getHours();

    var ctx = document.getElementById(canvasId);
    if (!ctx) return;
    ctx = ctx.getContext("2d");

    instances[canvasId] = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          data: data,
          borderColor: color,
          borderWidth: 1.5,
          tension: 0.35,
          fill: false,
          pointRadius: data.map(function (_, i) { return i === nowHour ? 4 : 0; }),
          pointHoverRadius: 4,
          pointBackgroundColor: color,
          pointBorderColor: isDark() ? "#1e1e1e" : "#fff",
          pointBorderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: isDark() ? "#252525" : "#111",
            titleColor: "#fff",
            bodyColor: "rgba(255,255,255,0.7)",
            titleFont: { size: 12, weight: "500" },
            bodyFont: { size: 11 },
            cornerRadius: 6,
            padding: { top: 8, bottom: 8, left: 10, right: 10 },
            displayColors: false,
            callbacks: {
              title: function (items) { return items[0].label; },
              label: function (ctx) {
                var v = ctx.parsed.y.toFixed(1);
                var suffix = ctx.dataIndex === nowHour ? "  (now)" : "";
                return v + "%" + suffix;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: tickColor(),
              callback: function (_, i) { return i % 4 === 0 ? labels[i] : ""; },
              maxRotation: 0,
              font: { size: 10 },
            },
            grid: { color: gridColor(), drawBorder: false },
            border: { display: false },
          },
          y: {
            min: 0,
            max: 100,
            ticks: {
              color: tickColor(),
              font: { size: 10 },
              stepSize: 25,
              callback: function (v) { return v + "%"; },
            },
            grid: { color: gridColor(), drawBorder: false },
            border: { display: false },
          },
        },
      },
    });
  }

  function renderSparkline(canvas, byHourData) {
    if (!canvas) return;
    var data = [];
    for (var h = 0; h < 24; h++) {
      data.push(byHourData[String(h)] || 0);
    }
    var avgOcc = data.reduce(function (a, b) { return a + b; }, 0) / (data.filter(function (v) { return v > 0; }).length || 1);
    var color = occColor(avgOcc);

    var key = canvas.id || canvas.dataset.sparkId;
    if (key && instances[key]) {
      instances[key].destroy();
      delete instances[key];
    }

    var ctx = canvas.getContext("2d");
    var chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: data.map(function (_, i) { return i; }),
        datasets: [{
          data: data,
          borderColor: color,
          borderWidth: 1,
          tension: 0.4,
          fill: false,
          pointRadius: 0,
          pointHoverRadius: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: { display: false, min: 0, max: 100 },
        },
      },
    });

    if (key) instances[key] = chart;
  }

  function destroyAll() {
    Object.keys(instances).forEach(function (k) {
      instances[k].destroy();
      delete instances[k];
    });
  }

  window.ASVZCharts = {
    renderFacilityChart: renderFacilityChart,
    renderSparkline: renderSparkline,
    destroyAll: destroyAll,
    occColor: occColor,
    occColorAlpha: occColorAlpha,
  };
})();
