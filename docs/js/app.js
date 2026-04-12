(function () {
  const sanitizeId = (name) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  function renderCards(data) {
    const grid = document.getElementById('cards-grid');
    grid.innerHTML = '';

    Object.keys(data)
      .sort((a, b) => a.localeCompare(b))
      .forEach((sport) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.sport = sport;

        let html = `<h3>${sport}</h3>`;
        const facilities = data[sport].facilities || {};

        Object.entries(facilities).forEach(([name, f]) => {
          const pct = Math.round(f.avg_occupancy_pct);
          html += `
            <div class="facility-row">
              <div class="facility-name">
                <span>${name}</span>
                <span>${pct}%</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill" style="width: ${pct}%"></div>
              </div>
              <div class="occ-text">${f.places_taken} / ${f.places_max} places</div>
            </div>`;
        });

        card.innerHTML = html;
        card.addEventListener('click', () => showDetail(sport, data[sport]));
        grid.appendChild(card);
      });
  }

  function showDetail(sport, sportData) {
    document.getElementById('view-cards').classList.add('hidden');
    document.getElementById('view-detail').classList.remove('hidden');
    document.getElementById('detail-sport-name').textContent = sport;

    const container = document.getElementById('detail-facilities');
    container.innerHTML = '';

    const facilities = sportData.facilities || {};
    const charts = [];

    Object.entries(facilities).forEach(([name, f]) => {
      const pct = Math.round(f.avg_occupancy_pct);
      const canvasId = 'chart-' + sanitizeId(name);
      charts.push({ canvasId, byHour: f.by_hour });

      const section = document.createElement('div');
      section.className = 'facility-section';
      section.innerHTML = `
        <h3>${name}</h3>
        <div class="occ-badge">${pct}% — ${f.places_taken} / ${f.places_max} places</div>
        <div class="chart-container">
          <canvas id="${canvasId}"></canvas>
        </div>`;
      container.appendChild(section);
    });

    charts.forEach(({ canvasId, byHour }) => {
      ASVZCharts.renderFacilityChart(canvasId, byHour);
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('back-btn').addEventListener('click', () => {
      document.getElementById('view-detail').classList.add('hidden');
      document.getElementById('view-cards').classList.remove('hidden');
      document.getElementById('detail-facilities').innerHTML = '';
    });

    const data = await ASVZData.fetchSportDetails();
    if (data) renderCards(data);

    const latest = await ASVZData.fetchLatest();
    const el = document.getElementById('last-updated');
    if (el && latest && latest.ts) {
      el.textContent = 'Last updated: ' + new Date(latest.ts).toLocaleString();
    }
  });
})();
