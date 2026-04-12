# ASVZ Stats

Tracks and visualizes occupancy rates across [ASVZ](https://asvz.ch) sports facilities — by sport, facility, and time of day.

**Zero infrastructure.** Data collected via GitHub Actions, stored as JSON in the repo, served as a static dashboard on GitHub Pages.

## How it works

1. **Collector** — Python script polls the ASVZ public API every 30 minutes via GitHub Actions cron
2. **Aggregator** — builds summary files (by sport, facility, weekly heatmap) from raw snapshots
3. **Dashboard** — static HTML/JS site on GitHub Pages visualizes the data with Chart.js

## Dashboard

Live at: `https://darkroom4364.github.io/ASVZ-Stats/`

- **Overview** — current occupancy across all facilities
- **By Sport** — average occupancy per sport type
- **By Facility** — facility comparison
- **Heatmap** — day-of-week × hour-of-day occupancy grid
- **Trends** — occupancy trends over time (requires multi-day data)

## Data

- Raw snapshots: `data/raw/YYYY-MM-DD.json` (retained 90 days)
- Pre-computed summaries: `data/summary/*.json`

## Local development

```bash
pip install requests
python collector/collect.py
python collector/aggregate.py
# open docs/index.html in a browser
```

## License

MIT
