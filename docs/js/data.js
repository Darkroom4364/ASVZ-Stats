// ASVZ-Stats data fetching module
(function () {
  const cache = {};

  async function fetchJSON(file) {
    if (cache[file]) return cache[file];
    try {
      const res = await fetch("data/summary/" + file);
      if (!res.ok) throw new Error(res.status + " " + res.statusText);
      cache[file] = await res.json();
      return cache[file];
    } catch (err) {
      console.error("[ASVZData] Failed to fetch " + file + ":", err);
      return null;
    }
  }

  function getHappeningNow(latest) {
    if (!latest || !latest.events) return [];
    const now = new Date();
    return latest.events.filter(function (e) {
      if (e.cancelled) return false;
      if (!e.from_date || !e.to_date || !e.places_max) return false;
      var from = new Date(e.from_date);
      var to = new Date(e.to_date);
      return from <= now && to >= now;
    });
  }

  function getUpcoming(latest, hoursAhead) {
    if (!latest || !latest.events) return [];
    var now = new Date();
    var cutoff = new Date(now.getTime() + (hoursAhead || 3) * 3600000);
    return latest.events.filter(function (e) {
      if (e.cancelled) return false;
      if (!e.from_date || !e.places_max) return false;
      var from = new Date(e.from_date);
      return from > now && from <= cutoff;
    });
  }

  function getEventsForSport(latest, sportName) {
    if (!latest || !latest.events) return [];
    var now = new Date();
    return latest.events.filter(function (e) {
      if (e.cancelled) return false;
      if (e.sport_name !== sportName) return false;
      if (!e.places_max) return false;
      // show events from 2h ago to 24h ahead
      var from = new Date(e.from_date);
      var to = new Date(e.to_date || e.from_date);
      return to >= new Date(now.getTime() - 7200000) && from <= new Date(now.getTime() + 86400000);
    });
  }

  window.ASVZData = {
    fetchSportDetails: function () { return fetchJSON("sport_details.json"); },
    fetchLatest: function () { return fetchJSON("latest.json"); },
    fetchFacilityBusyness: function () { return fetchJSON("facility_busyness.json"); },
    getHappeningNow: getHappeningNow,
    getUpcoming: getUpcoming,
    getEventsForSport: getEventsForSport,
    clearCache: function () { Object.keys(cache).forEach(function (k) { delete cache[k]; }); },
  };
})();
