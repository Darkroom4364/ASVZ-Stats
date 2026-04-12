(function () {
  // ── Helpers ────────────────────────────────────────
  function esc(str) {
    var d = document.createElement("div");
    d.textContent = str || "";
    return d.innerHTML;
  }

  function sanitizeId(name) {
    return (name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  function occClass(pct) {
    if (pct < 50) return "green";
    if (pct < 80) return "yellow";
    return "red";
  }

  function fillClass(pct) {
    return "fill-" + occClass(pct);
  }

  function badgeClass(pct) {
    return "badge-" + occClass(pct);
  }

  function formatTime(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  // Lucide icon helper — renders a placeholder that lucide.createIcons() will replace
  function icon(name, cls) {
    return '<i data-lucide="' + name + '" class="lucide-icon' + (cls ? " " + cls : "") + '"></i>';
  }

  function refreshIcons() {
    if (window.lucide) lucide.createIcons();
  }

  function mergeByHour(facilities) {
    var merged = {};
    var counts = {};
    Object.values(facilities).forEach(function (f) {
      var bh = f.by_hour || {};
      Object.keys(bh).forEach(function (h) {
        merged[h] = (merged[h] || 0) + bh[h];
        counts[h] = (counts[h] || 0) + 1;
      });
    });
    var result = {};
    Object.keys(merged).forEach(function (h) {
      result[h] = Math.round(merged[h] / counts[h] * 10) / 10;
    });
    return result;
  }

  // ── State ──────────────────────────────────────────
  var sportData = null;
  var latestData = null;
  var busynessData = null;
  var currentTab = "all";
  var currentSort = "name";
  var searchQuery = "";

  // ── Theme ──────────────────────────────────────────
  function initTheme() {
    var saved = localStorage.getItem("asvz-theme");
    if (saved) {
      document.documentElement.setAttribute("data-theme", saved);
    } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute("data-theme");
    var next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("asvz-theme", next);
    refreshIcons();
  }

  // ── Stats Bar ──────────────────────────────────────
  function renderStatsBar() {
    var bar = document.getElementById("stats-bar");
    if (!sportData) { bar.innerHTML = ""; return; }

    var totalSports = Object.keys(sportData).length;
    var totalFacilities = 0;
    var totalTaken = 0;
    var totalMax = 0;
    var occValues = [];

    Object.values(sportData).forEach(function (s) {
      totalFacilities += s.facility_count || 0;
      Object.values(s.facilities || {}).forEach(function (f) {
        totalTaken += f.places_taken || 0;
        totalMax += f.places_max || 0;
        occValues.push(f.avg_occupancy_pct);
      });
    });

    var avgOcc = occValues.length
      ? Math.round(occValues.reduce(function (a, b) { return a + b; }, 0) / occValues.length)
      : 0;

    var liveNow = latestData ? ASVZData.getHappeningNow(latestData).length : 0;

    var stats = [
      { value: totalSports, label: "Sports", icon: "trophy" },
      { value: totalFacilities, label: "Facilities", icon: "map-pin" },
      { value: liveNow, label: "Live Now", icon: "radio" },
      { value: avgOcc + "%", label: "Avg Occupancy", icon: "gauge" },
      { value: totalTaken.toLocaleString(), label: "Spots Taken", icon: "users" },
      { value: totalMax.toLocaleString(), label: "Total Capacity", icon: "building-2" },
    ];

    bar.innerHTML = stats.map(function (s) {
      return '<div class="stat-card">' +
        '<div class="stat-icon">' + icon(s.icon) + '</div>' +
        '<div class="stat-value">' + esc(String(s.value)) + '</div>' +
        '<div class="stat-label">' + esc(s.label) + '</div>' +
      '</div>';
    }).join("");

    refreshIcons();
  }

  // ── Happening Now ──────────────────────────────────
  function renderNowSection() {
    var section = document.getElementById("now-section");
    var grid = document.getElementById("now-grid");

    if (currentTab !== "now") {
      section.classList.add("hidden");
      return;
    }

    var events = ASVZData.getHappeningNow(latestData);
    events.sort(function (a, b) {
      var aPct = (a.places_taken || 0) / a.places_max * 100;
      var bPct = (b.places_taken || 0) / b.places_max * 100;
      return bPct - aPct;
    });

    if (searchQuery) {
      var q = searchQuery.toLowerCase();
      events = events.filter(function (e) {
        return (e.sport_name || "").toLowerCase().includes(q) ||
               (e.title || "").toLowerCase().includes(q) ||
               (e.facility_name || "").toLowerCase().includes(q);
      });
    }

    if (events.length === 0) {
      section.classList.remove("hidden");
      grid.innerHTML = '<div class="no-results">' + icon("inbox") + '<p>No events happening right now</p></div>';
      updateResultsCount(0);
      refreshIcons();
      return;
    }

    section.classList.remove("hidden");
    updateResultsCount(events.length);

    grid.innerHTML = events.map(function (e) {
      var pct = Math.round((e.places_taken || 0) / e.places_max * 100);
      var cls = pct >= 95 ? "full" : pct >= 70 ? "busy" : "";
      var free = e.places_free || (e.places_max - (e.places_taken || 0));
      var barColor = ASVZCharts.occColor(pct);
      var levelCls = pct >= 80 ? "level-red" : pct >= 50 ? "level-yellow" : "level-green";

      return '<div class="now-card ' + cls + '">' +
        '<div class="now-card-header">' +
          '<span class="now-card-sport">' + esc(e.sport_name) + '</span>' +
          '<span class="now-card-badge ' + levelCls + '">' + pct + '%</span>' +
        '</div>' +
        '<div class="now-card-meta">' +
          '<span>' + icon("map-pin", "icon-xs") + ' ' + esc(e.facility_name || "\u2014") + '</span>' +
          '<span>' + icon("clock", "icon-xs") + ' ' + formatTime(e.from_date) + ' \u2013 ' + formatTime(e.to_date) + '</span>' +
          (e.niveau_name ? '<span class="niveau-badge">' + icon("signal", "icon-xs") + ' ' + esc(e.niveau_name) + '</span>' : '') +
        '</div>' +
        '<div class="now-card-bar"><div class="now-card-bar-fill" style="width:' + pct + '%;background:' + barColor + '"></div></div>' +
        '<div class="now-card-spots"><span>' + icon("users", "icon-xs") + ' ' + (e.places_taken || 0) + ' / ' + e.places_max + '</span><span>' + free + ' free</span></div>' +
      '</div>';
    }).join("");

    refreshIcons();
  }

  // ── Cards ──────────────────────────────────────────
  function getSortedSports() {
    if (!sportData) return [];
    var entries = Object.keys(sportData).map(function (name) {
      var s = sportData[name];
      var totalCap = 0;
      Object.values(s.facilities || {}).forEach(function (f) { totalCap += f.places_max || 0; });
      return { name: name, data: s, totalCap: totalCap };
    });

    // Filter by search
    if (searchQuery) {
      var q = searchQuery.toLowerCase();
      entries = entries.filter(function (e) {
        if (e.name.toLowerCase().includes(q)) return true;
        return Object.keys(e.data.facilities || {}).some(function (f) {
          return f.toLowerCase().includes(q);
        });
      });
    }

    // Filter by tab
    if (currentTab === "busiest") {
      entries.sort(function (a, b) { return b.data.avg_occupancy_pct - a.data.avg_occupancy_pct; });
      entries = entries.slice(0, 20);
    } else if (currentTab === "available") {
      entries = entries.filter(function (e) { return e.data.avg_occupancy_pct < 50; });
      entries.sort(function (a, b) { return a.data.avg_occupancy_pct - b.data.avg_occupancy_pct; });
    }

    // Sort
    switch (currentSort) {
      case "name":
        entries.sort(function (a, b) { return a.name.localeCompare(b.name); });
        break;
      case "name-desc":
        entries.sort(function (a, b) { return b.name.localeCompare(a.name); });
        break;
      case "occ-desc":
        entries.sort(function (a, b) { return b.data.avg_occupancy_pct - a.data.avg_occupancy_pct; });
        break;
      case "occ-asc":
        entries.sort(function (a, b) { return a.data.avg_occupancy_pct - b.data.avg_occupancy_pct; });
        break;
      case "capacity":
        entries.sort(function (a, b) { return b.totalCap - a.totalCap; });
        break;
    }

    return entries;
  }

  function updateResultsCount(count) {
    var el = document.getElementById("results-count");
    if (count === undefined) {
      el.textContent = "";
    } else {
      el.textContent = count + " result" + (count !== 1 ? "s" : "");
    }
  }

  function renderCards() {
    var grid = document.getElementById("cards-grid");

    if (currentTab === "now") {
      grid.innerHTML = "";
      grid.classList.add("hidden");
      document.getElementById("busyness-section").classList.add("hidden");
      renderNowSection();
      return;
    }

    if (currentTab === "facilities") {
      grid.innerHTML = "";
      grid.classList.add("hidden");
      document.getElementById("now-section").classList.add("hidden");
      renderBusynessSection();
      return;
    }

    grid.classList.remove("hidden");
    document.getElementById("now-section").classList.add("hidden");
    document.getElementById("busyness-section").classList.add("hidden");

    ASVZCharts.destroyAll();

    var entries = getSortedSports();
    updateResultsCount(entries.length);

    if (entries.length === 0) {
      grid.innerHTML = '<div class="no-results">' + icon("search-x") +
        '<p>No sports found' + (searchQuery ? ' for "' + esc(searchQuery) + '"' : '') + '</p></div>';
      refreshIcons();
      return;
    }

    grid.innerHTML = entries.map(function (entry, idx) {
      var sport = entry.name;
      var s = entry.data;
      var pct = Math.round(s.avg_occupancy_pct);
      var facilities = s.facilities || {};
      var facKeys = Object.keys(facilities).sort();
      var sparkId = "spark-" + sanitizeId(sport);

      var html = '<div class="card" data-sport="' + esc(sport) + '" style="--i:' + idx + '">' +
        '<div class="card-header">' +
          '<h3>' + esc(sport) + '</h3>' +
          '<span class="card-avg-badge ' + badgeClass(pct) + '">' + pct + '%</span>' +
        '</div>' +
        '<div class="card-sparkline"><canvas id="' + sparkId + '" data-spark-id="' + sparkId + '"></canvas></div>' +
        '<div class="card-facilities-count">' + icon("building-2", "icon-xs") + ' ' + s.facility_count + ' facilit' + (s.facility_count === 1 ? 'y' : 'ies') + '</div>';

      // Show top 3 facilities max on card
      var shown = facKeys.slice(0, 3);
      shown.forEach(function (name) {
        var f = facilities[name];
        var fpct = Math.round(f.avg_occupancy_pct);
        html += '<div class="facility-row">' +
          '<div class="facility-name"><span>' + esc(name) + '</span><span>' + fpct + '%</span></div>' +
          '<div class="progress-track"><div class="progress-fill ' + fillClass(fpct) + '" style="width:' + fpct + '%"></div></div>' +
          '<div class="occ-text">' + (f.places_taken || 0) + ' / ' + f.places_max + ' enrolled</div>' +
        '</div>';
      });

      if (facKeys.length > 3) {
        html += '<div class="occ-text">+ ' + (facKeys.length - 3) + ' more\u2026</div>';
      }

      html += '</div>';
      return html;
    }).join("");

    // Render sparklines
    entries.forEach(function (entry) {
      var sparkId = "spark-" + sanitizeId(entry.name);
      var canvas = document.getElementById(sparkId);
      if (canvas) {
        var merged = mergeByHour(entry.data.facilities || {});
        ASVZCharts.renderSparkline(canvas, merged);
      }
    });

    // Click handlers
    grid.querySelectorAll(".card").forEach(function (card) {
      card.addEventListener("click", function () {
        var sport = card.dataset.sport;
        if (sportData[sport]) showDetail(sport, sportData[sport]);
      });
    });

    refreshIcons();
  }

  // ── Facility Busyness ──────────────────────────────
  async function renderBusynessSection() {
    var section = document.getElementById("busyness-section");
    if (currentTab !== "facilities") {
      section.classList.add("hidden");
      return;
    }
    section.classList.remove("hidden");

    if (!busynessData) {
      busynessData = await ASVZData.fetchFacilityBusyness();
    }
    if (!busynessData || Object.keys(busynessData).length === 0) {
      section.innerHTML = '<div class="no-results">' + icon("inbox") + '<p>No busyness data yet</p></div>';
      refreshIcons();
      return;
    }

    var facilities = Object.keys(busynessData).sort();
    if (searchQuery) {
      var q = searchQuery.toLowerCase();
      facilities = facilities.filter(function (f) { return f.toLowerCase().includes(q); });
    }

    updateResultsCount(facilities.length);

    section.innerHTML = facilities.map(function (fac) {
      var canvasId = "busyness-" + sanitizeId(fac);
      return '<div class="facility-section">' +
        '<h3>' + icon("building-2", "icon-sm") + ' ' + esc(fac) + '</h3>' +
        '<p class="occ-badge">' + icon("clock", "icon-xs") + ' Estimated busyness by day & hour (inferred from lesson fill rates)</p>' +
        '<div style="overflow-x:auto"><canvas id="' + canvasId + '"></canvas></div>' +
      '</div>';
    }).join("");

    refreshIcons();

    requestAnimationFrame(function () {
      facilities.forEach(function (fac) {
        var canvasId = "busyness-" + sanitizeId(fac);
        ASVZCharts.renderBusynessHeatmap(canvasId, busynessData[fac]);
      });
    });
  }

  // ── Detail View ────────────────────────────────────
  function showDetail(sport, sData) {
    document.getElementById("view-cards").classList.add("hidden");
    var detail = document.getElementById("view-detail");
    detail.classList.remove("hidden");

    // Header
    var headerEl = document.getElementById("detail-header");
    var pct = Math.round(sData.avg_occupancy_pct);
    headerEl.innerHTML = '<h2>' + esc(sport) + '</h2>' +
      '<div class="detail-meta">' +
        '<span class="card-avg-badge ' + badgeClass(pct) + '">' + icon("gauge", "icon-xs") + ' ' + pct + '% avg occupancy</span>' +
        '<span>' + icon("building-2", "icon-xs") + ' ' + sData.facility_count + ' facilit' + (sData.facility_count === 1 ? 'y' : 'ies') + '</span>' +
      '</div>';

    // Live events for this sport
    renderDetailLiveEvents(sport);

    // Facility charts
    var container = document.getElementById("detail-facilities");
    container.innerHTML = "";
    var facilities = sData.facilities || {};
    var charts = [];

    Object.keys(facilities).sort().forEach(function (name) {
      var f = facilities[name];
      var fpct = Math.round(f.avg_occupancy_pct);
      var canvasId = "chart-" + sanitizeId(name);
      charts.push({ canvasId: canvasId, byHour: f.by_hour });

      var section = document.createElement("div");
      section.className = "facility-section";
      section.innerHTML =
        '<h3>' + icon("map-pin", "icon-sm") + ' ' + esc(name) + '</h3>' +
        '<div class="occ-badge">' +
          '<span class="card-avg-badge ' + badgeClass(fpct) + '" style="margin-right:8px">' + fpct + '%</span>' +
          icon("users", "icon-xs") + ' ' + (f.places_taken || 0) + ' / ' + f.places_max + ' places \u00b7 ' +
          icon("bar-chart-3", "icon-xs") + ' ' + f.data_points + ' data points' +
        '</div>' +
        '<div class="chart-container"><canvas id="' + canvasId + '"></canvas></div>';
      container.appendChild(section);
    });

    refreshIcons();

    // Render charts after DOM update
    requestAnimationFrame(function () {
      charts.forEach(function (c) {
        ASVZCharts.renderFacilityChart(c.canvasId, c.byHour);
      });
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderDetailLiveEvents(sport) {
    var container = document.getElementById("detail-live-events");
    if (!latestData) { container.innerHTML = ""; return; }

    var events = ASVZData.getEventsForSport(latestData, sport);
    if (events.length === 0) {
      container.innerHTML = "";
      return;
    }

    var now = new Date();

    // Sort: happening now first, then by start time
    events.sort(function (a, b) {
      var aFrom = new Date(a.from_date);
      var aTo = new Date(a.to_date || a.from_date);
      var bFrom = new Date(b.from_date);
      var bTo = new Date(b.to_date || b.from_date);
      var aLive = aFrom <= now && aTo >= now;
      var bLive = bFrom <= now && bTo >= now;
      if (aLive && !bLive) return -1;
      if (!aLive && bLive) return 1;
      return aFrom - bFrom;
    });

    var html = '<h3>' + icon("calendar-clock", "icon-sm") + ' Upcoming & Live Events (' + events.length + ')</h3>' +
      '<div class="live-events-grid">';

    events.forEach(function (e) {
      var pct = Math.round((e.places_taken || 0) / e.places_max * 100);
      var free = e.places_free || (e.places_max - (e.places_taken || 0));
      var from = new Date(e.from_date);
      var to = new Date(e.to_date || e.from_date);
      var isLive = from <= now && to >= now;
      var barColor = ASVZCharts.occColor(pct);

      html += '<div class="live-event-card">' +
        '<div class="event-title">' + esc(e.title) +
          (isLive ? ' <span class="live-dot">' + icon("radio", "icon-xs") + ' LIVE</span>' : '') +
        '</div>' +
        '<div class="event-meta">' +
          '<span>' + icon("clock", "icon-xs") + ' ' + formatTime(e.from_date) + ' \u2013 ' + formatTime(e.to_date) + '</span>' +
          '<span>' + icon("map-pin", "icon-xs") + ' ' + esc(e.facility_name || e.location || "\u2014") + '</span>' +
          (e.niveau_name ? '<span class="niveau-badge">' + icon("signal", "icon-xs") + ' ' + esc(e.niveau_name) + '</span>' : '') +
        '</div>' +
        '<div class="event-bar"><div class="event-bar-fill" style="width:' + pct + '%;background:' + barColor + '"></div></div>' +
        '<div class="event-spots"><span>' + icon("users", "icon-xs") + ' ' + (e.places_taken || 0) + ' / ' + e.places_max + '</span><span>' + free + ' free</span></div>' +
      '</div>';
    });

    html += '</div>';
    container.innerHTML = html;
    refreshIcons();
  }

  // ── Init ───────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", async function () {
    initTheme();
    refreshIcons();

    // Theme toggle
    document.getElementById("theme-toggle").addEventListener("click", toggleTheme);

    // Back button
    document.getElementById("back-btn").addEventListener("click", function () {
      document.getElementById("view-detail").classList.add("hidden");
      document.getElementById("view-cards").classList.remove("hidden");
      document.getElementById("detail-facilities").innerHTML = "";
      document.getElementById("detail-live-events").innerHTML = "";
      renderCards();
    });

    // Tabs
    document.querySelectorAll(".tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        document.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("active"); });
        tab.classList.add("active");
        currentTab = tab.dataset.tab;
        renderCards();
      });
    });

    // Search
    var searchInput = document.getElementById("search");
    var searchClear = document.getElementById("search-clear");
    var searchTimer;

    searchInput.addEventListener("input", function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        searchQuery = searchInput.value.trim();
        searchClear.classList.toggle("hidden", !searchQuery);
        renderCards();
      }, 200);
    });

    searchClear.addEventListener("click", function () {
      searchInput.value = "";
      searchQuery = "";
      searchClear.classList.add("hidden");
      renderCards();
    });

    // Sort
    document.getElementById("sort-select").addEventListener("change", function (e) {
      currentSort = e.target.value;
      renderCards();
    });

    // Fetch data
    try {
      var results = await Promise.all([
        ASVZData.fetchSportDetails(),
        ASVZData.fetchLatest(),
        ASVZData.fetchFacilityBusyness(),
      ]);

      sportData = results[0];
      latestData = results[1];
      busynessData = results[2];

      if (!sportData) {
        throw new Error("Failed to load sport data");
      }

      // Update timestamp
      var el = document.getElementById("last-updated");
      if (el && latestData && latestData.ts) {
        var d = new Date(latestData.ts);
        el.textContent = "Last updated: " + d.toLocaleString();
      }

      renderStatsBar();
      renderCards();

      // Show app, hide loading
      document.getElementById("loading-overlay").classList.add("hidden");
      document.getElementById("app").classList.remove("hidden");
    } catch (err) {
      console.error("Failed to load data:", err);
      var overlay = document.getElementById("loading-overlay");
      overlay.innerHTML =
        '<div class="no-results">' +
        icon("alert-triangle") +
        '<p style="font-size:1.5rem;margin-bottom:12px">Failed to load data</p>' +
        '<p>' + esc(err.message) + '</p>' +
        '<p style="margin-top:16px"><a href="." style="color:var(--accent)">Retry</a></p>' +
        '</div>';
      refreshIcons();
    }
  });
})();
