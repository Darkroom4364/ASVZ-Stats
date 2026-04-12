// ASVZ-Stats data fetching module
(function () {
  const cache = {};

  async function fetchJSON(file) {
    if (cache[file]) return cache[file];
    try {
      const res = await fetch("data/summary/" + file);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      cache[file] = await res.json();
      return cache[file];
    } catch (err) {
      console.error(`[ASVZData] Failed to fetch ${file}:`, err);
      return null;
    }
  }

  window.ASVZData = {
    fetchSportDetails: () => fetchJSON("sport_details.json"),
    fetchLatest: () => fetchJSON("latest.json"),
    clearCache: () => Object.keys(cache).forEach((k) => delete cache[k]),
  };
})();
