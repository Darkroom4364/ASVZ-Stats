(function () {
  const instances = {};

  function renderFacilityChart(canvasId, byHourData) {
    if (instances[canvasId]) {
      instances[canvasId].destroy();
      delete instances[canvasId];
    }

    const labels = Array.from({ length: 24 }, (_, h) =>
      String(h).padStart(2, "0") + ":00"
    );
    const data = Array.from({ length: 24 }, (_, h) =>
      byHourData[String(h)] || 0
    );

    const ctx = document.getElementById(canvasId).getContext("2d");
    instances[canvasId] = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          data,
          borderColor: "#007aff",
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          backgroundColor: "rgba(0, 122, 255, 0.08)",
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: "#007aff",
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ctx.label + " \u2014 " + ctx.parsed.y.toFixed(1) + "%",
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: "#86868b",
              callback: function (_, i) { return i % 3 === 0 ? labels[i] : ""; },
              maxRotation: 0,
            },
            grid: { color: "#e5e5ea", drawBorder: false },
          },
          y: {
            min: 0,
            max: 100,
            title: { display: true, text: "Occupancy %" },
            ticks: { color: "#86868b" },
            grid: { color: "#e5e5ea", drawBorder: false },
          },
        },
      },
    });
  }

  window.ASVZCharts = { renderFacilityChart };
})();
