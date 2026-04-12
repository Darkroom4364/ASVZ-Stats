#!/usr/bin/env python3
"""Aggregate raw ASVZ snapshots into summary files for the dashboard."""

import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = REPO_ROOT / "data" / "raw"
OUT_DIR = REPO_ROOT / "docs" / "data" / "summary"


def load_all_snapshots():
    """Yield every snapshot dict from all raw JSON files."""
    if not RAW_DIR.exists():
        return
    for f in sorted(RAW_DIR.glob("*.json")):
        try:
            for snap in json.loads(f.read_text()):
                yield snap
        except (json.JSONDecodeError, TypeError):
            continue


def valid_events(snapshot):
    """Yield non-cancelled events with usable occupancy data."""
    for e in snapshot.get("events", []):
        if e.get("cancelled"):
            continue
        pmax = e.get("places_max")
        if not pmax:
            continue
        yield e


def build_latest(snapshots):
    """Return the last snapshot from the last raw file, or None."""
    latest = None
    for snap in snapshots:
        latest = snap
    return latest


def build_grouped(all_events, key):
    """Group events by key and compute per-group stats."""
    groups = defaultdict(lambda: {"occ_sum": 0.0, "count": 0, "nids": set(), "pmax_sum": 0})
    for e in all_events:
        name = e.get(key) or "Unknown"
        pmax = e["places_max"]
        taken = e.get("places_taken") or 0
        g = groups[name]
        g["occ_sum"] += taken / pmax * 100
        g["count"] += 1
        g["pmax_sum"] += pmax
        if e.get("nid"):
            g["nids"].add(e["nid"])

    result = {}
    for name, g in sorted(groups.items()):
        n = g["count"]
        result[name] = {
            "avg_occupancy_pct": round(g["occ_sum"] / n, 1) if n else 0,
            "total_lessons": len(g["nids"]),
            "avg_places_max": round(g["pmax_sum"] / n, 1) if n else 0,
            "data_points": n,
        }
    return result


def build_heatmap(all_events):
    """Build (day, hour) → avg occupancy ratio, globally and per sport."""
    global_cells = defaultdict(list)
    sport_cells = defaultdict(lambda: defaultdict(list))

    for e in all_events:
        fd = e.get("from_date")
        if not fd:
            continue
        try:
            dt = datetime.fromisoformat(fd)
        except (ValueError, TypeError):
            continue
        pmax = e["places_max"]
        taken = e.get("places_taken") or 0
        ratio = taken / pmax
        day = str(dt.weekday())
        hour = str(dt.hour)
        global_cells[(day, hour)].append(ratio)
        sport = e.get("sport_name") or "Unknown"
        sport_cells[sport][(day, hour)].append(ratio)

    def cells_to_dict(cells):
        out = defaultdict(dict)
        for (d, h), vals in cells.items():
            out[d][h] = round(sum(vals) / len(vals), 4)
        return dict(out)

    return {
        "global": cells_to_dict(global_cells),
        "by_sport": {s: cells_to_dict(c) for s, c in sorted(sport_cells.items())},
    }


def write_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False))


def main():
    snapshots = list(load_all_snapshots())

    # latest.json
    latest = build_latest(iter(snapshots)) if snapshots else None
    write_json(OUT_DIR / "latest.json", latest or {})

    # Collect all valid events across every snapshot
    all_events = [e for snap in snapshots for e in valid_events(snap)]

    # by_sport.json
    write_json(OUT_DIR / "by_sport.json", {"sports": build_grouped(all_events, "sport_name")})

    # by_facility.json
    write_json(OUT_DIR / "by_facility.json", {"facilities": build_grouped(all_events, "facility_name")})

    # heatmap.json
    write_json(OUT_DIR / "heatmap.json", build_heatmap(all_events))

    print(f"Aggregated {len(snapshots)} snapshots, {len(all_events)} events → {OUT_DIR}")


if __name__ == "__main__":
    main()
