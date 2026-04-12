(function () {
  const TABS = {
    overview:   () => ASVZCharts.renderOverview('chart-overview'),
    sports:     () => ASVZCharts.renderSportTrends('chart-sports', 'sport-select'),
    facilities: () => ASVZCharts.renderFacilityComparison('chart-facilities'),
    heatmap:    () => ASVZCharts.renderHeatmap('canvas-heatmap'),
    trends:     () => ASVZCharts.renderTrends('chart-trends'),
  };

  const rendered = {};

  async function showTab(name) {
    document.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === name);
    });
    document.querySelectorAll('.tab-content').forEach((sec) => {
      sec.classList.toggle('active', sec.id === 'tab-' + name);
    });

    if (!rendered[name] && TABS[name]) {
      const section = document.getElementById('tab-' + name);
      const loader = section && section.querySelector('.loading');
      await TABS[name]();
      rendered[name] = true;
      if (loader) loader.classList.add('hidden');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => showTab(btn.dataset.tab));
    });

    showTab('overview');

    ASVZData.fetchLatest().then((d) => {
      const el = document.getElementById('last-updated');
      if (el && d && d.ts) {
        el.textContent = 'Last updated: ' + new Date(d.ts).toLocaleString();
      }
    });
  });
})();
