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

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function renderBusynessHeatmap(canvasId, dayHourData) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var ctx = canvas.getContext("2d");

    var days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    var cellW = 52, cellH = 22, labelLeft = 50, labelTop = 24;
    var gap = 2, radius = 3;
    var dark = isDark();

    canvas.width = labelLeft + days.length * cellW;
    canvas.height = labelTop + 24 * cellH;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    var labelColor = dark ? "#8e8e93" : "#6e6e73";
    var fontStack = "10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

    // Day labels
    ctx.font = fontStack;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = labelColor;
    for (var d = 0; d < 7; d++) {
      ctx.fillText(days[d], labelLeft + d * cellW + cellW / 2, labelTop / 2);
    }

    // Hour labels (every 2 hours)
    ctx.textAlign = "right";
    for (var h = 0; h < 24; h++) {
      if (h % 2 === 0) {
        ctx.fillStyle = labelColor;
        ctx.fillText(String(h).padStart(2, "0") + ":00", labelLeft - 6, labelTop + h * cellH + cellH / 2);
      }
    }

    // Cells
    for (var d = 0; d < 7; d++) {
      for (var h = 0; h < 24; h++) {
        var val = (dayHourData[String(d)] && dayHourData[String(d)][String(h)]) || 0;
        var x = labelLeft + d * cellW + gap / 2;
        var y = labelTop + h * cellH + gap / 2;
        var w = cellW - gap;
        var hh = cellH - gap;

        // Color: faint bg at 0%, then occColor-based interpolation
        if (val <= 0) {
          ctx.fillStyle = dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)";
        } else {
          var alpha = 0.15 + 0.85 * Math.min(val / 100, 1);
          ctx.fillStyle = occColorAlpha(val, alpha);
        }

        roundRect(ctx, x, y, w, hh, radius);
        ctx.fill();

        if (val > 0) {
          ctx.font = fontStack;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = val > 60 ? "#fff" : (dark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.7)");
          ctx.fillText(val.toFixed(0) + "%", x + w / 2, y + hh / 2);
        }
      }
    }
  }

  window.ASVZCharts = {
    renderBusynessHeatmap: renderBusynessHeatmap,
    renderFacilityChart: renderFacilityChart,
    renderSparkline: renderSparkline,
    destroyAll: destroyAll,
    occColor: occColor,
    occColorAlpha: occColorAlpha,
  };
})();
