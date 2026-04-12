// ASVZ-Stats chart rendering module
(function () {
  const chartInstances = {};

  // --- Helpers ---

  function occupancyColor(pct) {
    // Green (120) -> Yellow (60) -> Red (0) via HSL
    let hue;
    if (pct <= 50) {
      hue = 120 - (pct / 50) * 60; // 120 -> 60
    } else {
      hue = 60 - ((pct - 50) / 50) * 60; // 60 -> 0
    }
    hue = Math.max(0, Math.min(120, hue));
    return `hsl(${hue}, 80%, 45%)`;
  }

  function destroyChart(canvasId) {
    if (chartInstances[canvasId]) {
      chartInstances[canvasId].destroy();
      delete chartInstances[canvasId];
    }
  }

  // --- Chart functions ---

  async function renderOverview(canvasId) {
    const data = await window.ASVZData.fetchLatest();
    if (!data || !data.events) return;

    // Group by facility, calc avg occupancy
    const facilityMap = {};
    for (const ev of data.events) {
      const name = ev.facility_name || "Unknown";
      if (!facilityMap[name]) facilityMap[name] = { total: 0, count: 0 };
      const pct =
        ev.places_max > 0
          ? ((ev.places_taken || 0) / ev.places_max) * 100
          : 0;
      facilityMap[name].total += pct;
      facilityMap[name].count += 1;
    }

    const entries = Object.entries(facilityMap)
      .map(([name, v]) => ({ name, pct: v.total / v.count }))
      .sort((a, b) => b.pct - a.pct);

    const labels = entries.map((e) => e.name);
    const values = entries.map((e) => Math.round(e.pct * 10) / 10);
    const colors = values.map((v) => occupancyColor(v));

    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId).getContext("2d");
    chartInstances[canvasId] = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Occupancy %",
            data: values,
            backgroundColor: colors,
            borderWidth: 0,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.parsed.x.toFixed(1)}%`,
            },
          },
        },
        scales: {
          x: { beginAtZero: true, max: 100, title: { display: true, text: "Occupancy %" } },
          y: { ticks: { font: { size: 11 } } },
        },
      },
    });
  }

  async function renderSportTrends(canvasId, selectId) {
    const data = await window.ASVZData.fetchBySport();
    if (!data) return;

    const sports = Object.entries(data.sports || {})
      .map(([name, v]) => ({ name, pct: v.avg_occupancy_pct || 0 }))
      .sort((a, b) => b.pct - a.pct);

    // Populate select
    const select = document.getElementById(selectId);
    if (select) {
      select.innerHTML = "";
      const allOpt = document.createElement("option");
      allOpt.value = "__all__";
      allOpt.textContent = "All Sports";
      select.appendChild(allOpt);
      for (const s of sports) {
        const opt = document.createElement("option");
        opt.value = s.name;
        opt.textContent = s.name;
        select.appendChild(opt);
      }
    }

    const labels = sports.map((s) => s.name);
    const values = sports.map((s) => Math.round(s.pct * 10) / 10);
    const colors = values.map((v) => occupancyColor(v));

    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId).getContext("2d");
    chartInstances[canvasId] = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Avg Occupancy %",
            data: values,
            backgroundColor: colors,
            borderWidth: 0,
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
              label: (ctx) => `${ctx.parsed.y.toFixed(1)}%`,
            },
          },
        },
        scales: {
          x: { ticks: { maxRotation: 45, font: { size: 10 } } },
          y: { beginAtZero: true, max: 100, title: { display: true, text: "Avg Occupancy %" } },
        },
      },
    });
  }

  async function renderFacilityComparison(canvasId) {
    const data = await window.ASVZData.fetchByFacility();
    if (!data) return;

    const facilities = Object.entries(data.facilities || {})
      .map(([name, v]) => ({ name, pct: v.avg_occupancy_pct || 0 }))
      .sort((a, b) => b.pct - a.pct);

    const labels = facilities.map((f) => f.name);
    const values = facilities.map((f) => Math.round(f.pct * 10) / 10);
    const colors = values.map((v) => occupancyColor(v));

    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId).getContext("2d");
    chartInstances[canvasId] = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Avg Occupancy %",
            data: values,
            backgroundColor: colors,
            borderWidth: 0,
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
              label: (ctx) => `${ctx.parsed.y.toFixed(1)}%`,
            },
          },
        },
        scales: {
          x: { ticks: { maxRotation: 45, font: { size: 10 } } },
          y: { beginAtZero: true, max: 100, title: { display: true, text: "Avg Occupancy %" } },
        },
      },
    });
  }

  async function renderHeatmap(canvasId) {
    const data = await window.ASVZData.fetchHeatmap();
    if (!data) return;

    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext("2d");

    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const cellW = 50;
    const cellH = 25;
    const labelLeft = 45;
    const labelTop = 25;
    const cols = 7;
    const rows = 24;

    canvas.width = labelLeft + cols * cellW;
    canvas.height = labelTop + rows * cellH;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Day labels on top
    ctx.fillStyle = "#333";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    for (let d = 0; d < cols; d++) {
      ctx.fillText(days[d], labelLeft + d * cellW + cellW / 2, 16);
    }

    // Hour labels on left
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    for (let h = 0; h < rows; h++) {
      const label = String(h).padStart(2, "0") + ":00";
      ctx.fillText(label, labelLeft - 4, labelTop + h * cellH + cellH / 2 + 4);
    }

    // Draw cells
    const global = data.global || {};
    for (let d = 0; d < cols; d++) {
      for (let h = 0; h < rows; h++) {
        const ratio = (global[String(d)] && global[String(d)][String(h)]) || 0;
        const pct = ratio * 100;

        // White (0%) -> Yellow (50%) -> Red (100%)
        let r, g, b;
        if (pct <= 50) {
          const t = pct / 50;
          r = Math.round(255);
          g = Math.round(255);
          b = Math.round(255 * (1 - t));
        } else {
          const t = (pct - 50) / 50;
          r = Math.round(255);
          g = Math.round(255 * (1 - t));
          b = 0;
        }

        const x = labelLeft + d * cellW;
        const y = labelTop + h * cellH;

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, cellW, cellH);

        // Border
        ctx.strokeStyle = "#ddd";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, cellW, cellH);

        // Value text
        if (pct > 0) {
          ctx.fillStyle = pct > 70 ? "#fff" : "#333";
          ctx.font = "10px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(
            Math.round(pct) + "%",
            x + cellW / 2,
            y + cellH / 2 + 4
          );
        }
      }
    }
  }

  async function renderTrends(canvasId) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext("2d");

    // Destroy any existing chart on this canvas
    destroyChart(canvasId);

    const w = canvas.width || canvas.clientWidth || 400;
    const h = canvas.height || canvas.clientHeight || 200;
    canvas.width = w;
    canvas.height = h;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#888";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      "Trends will appear after more data is collected.",
      w / 2,
      h / 2
    );
  }

  // --- Public API ---

  window.ASVZCharts = {
    renderOverview,
    renderSportTrends,
    renderFacilityComparison,
    renderHeatmap,
    renderTrends,
    occupancyColor,
    destroyChart,
  };
})();
