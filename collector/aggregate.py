#!/usr/bin/env python3
"""Aggregate raw ASVZ snapshots into summary files for the dashboard."""

import gzip
import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path


def parse_iso(s):
    """Parse ISO8601 string, handling trailing Z for older Python."""
    if s and s.endswith("Z"):
        s = s[:-1] + "+00:00"
    return datetime.fromisoformat(s)

REPO_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = REPO_ROOT / "data" / "raw"
OUT_DIR = REPO_ROOT / "docs" / "data" / "summary"


def load_all_snapshots():
    """Yield every snapshot from legacy JSON or compressed JSON files."""
    if not RAW_DIR.exists():
        return
    files = sorted((*RAW_DIR.glob("*.json"), *RAW_DIR.glob("*.json.gz")))
    for f in files:
        try:
            open_file = gzip.open if f.suffix == ".gz" else open
            with open_file(f, "rt", encoding="utf-8") as raw:
                for snap in json.load(raw):
                    yield snap
        except (OSError, EOFError, UnicodeDecodeError, json.JSONDecodeError, TypeError):
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




def build_sport_details(all_events):
    """Build per-sport, per-facility occupancy details with hourly breakdown."""
    # sport -> facility -> list of (taken, pmax, hour_or_none)
    sf = defaultdict(lambda: defaultdict(list))

    for e in all_events:
        sport = e.get("sport_name") or "Unknown"
        facility = e.get("facility_name") or "Unknown"
        pmax = e["places_max"]
        taken = e.get("places_taken") or 0
        hour = None
        fd = e.get("from_date")
        if fd:
            try:
                hour = parse_iso(fd).hour
            except (ValueError, TypeError):
                pass
        sf[sport][facility].append((taken, pmax, hour))

    result = {}
    for sport in sorted(sf):
        facilities = {}
        sport_occ = []
        for fac in sorted(sf[sport]):
            entries = sf[sport][fac]
            occs = [t / m * 100 for t, m, _ in entries]
            sport_occ.extend(occs)
            last_taken, last_max, _ = entries[-1]
            # by_hour
            hour_buckets = defaultdict(list)
            for t, m, h in entries:
                if h is not None:
                    hour_buckets[h].append(t / m * 100)
            by_hour = {str(h): round(sum(v) / len(v), 1) for h, v in sorted(hour_buckets.items())}

            facilities[fac] = {
                "avg_occupancy_pct": round(sum(occs) / len(occs), 1),
                "places_taken": last_taken,
                "places_max": last_max,
                "data_points": len(entries),
                "by_hour": by_hour,
            }

        result[sport] = {
            "avg_occupancy_pct": round(sum(sport_occ) / len(sport_occ), 1) if sport_occ else 0,
            "facility_count": len(facilities),
            "facilities": facilities,
        }
    return result


def build_facility_busyness(all_events):
    """Infer facility busyness per hour from aggregate lesson fill rates."""
    # facility -> day_of_week -> hour -> list of fill ratios
    fb = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))

    for e in all_events:
        facility = e.get("facility_name") or "Unknown"
        fd = e.get("from_date")
        if not fd:
            continue
        try:
            dt = parse_iso(fd)
        except (ValueError, TypeError):
            continue
        pmax = e["places_max"]
        taken = e.get("places_taken") or 0
        fb[facility][dt.weekday()][dt.hour].append(taken / pmax)

    result = {}
    for fac in sorted(fb):
        days = {}
        for day in range(7):
            hours = {}
            for hour in range(24):
                ratios = fb[fac][day].get(hour, [])
                if ratios:
                    hours[str(hour)] = round(sum(ratios) / len(ratios) * 100, 1)
            if hours:
                days[str(day)] = hours
        if days:
            result[fac] = days
    return result


def write_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False))


def main():
    latest = None
    best = {}
    snapshot_count = 0
    for snapshot in load_all_snapshots():
        snapshot_count += 1
        latest = snapshot
        for e in valid_events(snapshot):
            nid = e.get("nid")
            if nid is None:
                continue
            prev = best.get(nid)
            if prev is None or (e.get("places_taken") or 0) > (prev.get("places_taken") or 0):
                best[nid] = e

    # latest.json
    write_json(OUT_DIR / "latest.json", latest or {})

    # Collect all valid events, keeping only the peak observation per event
    # (highest places_taken) to reflect actual fill, not early registration
    all_events = list(best.values())

    # sport_details.json
    write_json(OUT_DIR / "sport_details.json", build_sport_details(all_events))

    # facility_busyness.json
    write_json(OUT_DIR / "facility_busyness.json", build_facility_busyness(all_events))

    # Clean up old output files
    for old in ("by_sport.json", "by_facility.json", "heatmap.json"):
        p = OUT_DIR / old
        if p.exists():
            p.unlink()

    print(f"Aggregated {snapshot_count} snapshots, {len(all_events)} events → {OUT_DIR}")


if __name__ == "__main__":
    main()
