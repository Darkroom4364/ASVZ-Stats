// ASVZ-Stats data fetching module
(function () {
  const cache = {};

  function getBasePath() {
    return "data/summary/";
  }

  async function fetchJSON(file) {
    if (cache[file]) return cache[file];
    try {
      const res = await fetch(getBasePath() + file);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      cache[file] = data;
      return data;
    } catch (err) {
      console.error(`[ASVZData] Failed to fetch ${file}:`, err);
      return null;
    }
  }

  window.ASVZData = {
    fetchLatest: () => fetchJSON("latest.json"),
    fetchBySport: () => fetchJSON("by_sport.json"),
    fetchByFacility: () => fetchJSON("by_facility.json"),
    fetchHeatmap: () => fetchJSON("heatmap.json"),
    clearCache: () => Object.keys(cache).forEach((k) => delete cache[k]),
    getBasePath,
  };
})();
