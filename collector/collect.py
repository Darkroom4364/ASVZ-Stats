#!/usr/bin/env python3
"""Collect ASVZ event occupancy snapshots."""

import gzip
import json
from datetime import datetime, timezone
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).resolve().parent.parent
API_URL = "https://asvz.ch/asvz_api/event_search?_format=json&limit=800&offset={}"


def fetch_all_events():
    events = []
    offset = 0
    while True:
        resp = requests.get(API_URL.format(offset))
        resp.raise_for_status()
        data = resp.json()
        total = data["count"]["total"]
        for e in data.get("results", []):
            places_max = e.get("places_max")
            if not places_max:
                continue
            events.append({
                "nid": e.get("nid"),
                "sport_name": e.get("sport_name"),
                "title": e.get("title"),
                "facility_name": (e.get("facility_name") or [None])[0],
                "location": e.get("location"),
                "places_free": e.get("places_free"),
                "places_max": places_max,
                "places_taken": e.get("places_taken"),
                "from_date": e.get("from_date"),
                "to_date": e.get("to_date"),
                "niveau_name": e.get("niveau_name"),
                "cancelled": e.get("cancelled"),
            })
        offset += 800
        if offset >= total:
            break
    return events


def main():
    events = fetch_all_events()
    now = datetime.now(timezone.utc)
    snapshot = {
        "ts": now.isoformat(),
        "events": events,
    }

    out_dir = REPO_ROOT / "data" / "raw"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / f"{now:%Y-%m-%dT%H-%M-%S.%fZ}.json.gz"
    with gzip.open(out_file, "wt", encoding="utf-8") as f:
        json.dump([snapshot], f, ensure_ascii=False, separators=(",", ":"))
    print(f"Collected {len(events)} events → {out_file}")


if __name__ == "__main__":
    main()
