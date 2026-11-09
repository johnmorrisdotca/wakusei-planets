#!/usr/bin/env python3
"""Writes test/data/horizons-distance.json: the least and the greatest distance of three pairs of planets from 1900 to 2100 in JPL Horizons (https://ssd.jpl.nasa.gov/api/horizons.api), so that
test/nearest.test.ts can check distanceRange without the network. Geometric vectors (no light time) from the first body's centre to the second's, time in UT. A table at 10-day steps over the 200 years
finds the turning points within one per cent of the least (or greatest); each is then fetched again at 6-hour steps for ten days either side and the best of those is kept. Each entry keeps its Horizons queries.
Usage: python3 -I scripts/fetch-horizons-distance.py"""
import datetime, json, math, sys, time, urllib.parse, urllib.request

CODES = {"mercury": "199", "venus": "299", "earth": "399", "mars": "499", "jupiter": "599", "saturn": "699"}
PAIRS = [("earth", "mars"), ("venus", "earth"), ("jupiter", "saturn")]
EPOCH_JD = 2440587.5


def query(a, b, start, stop, step):
    return {"format": "json", "COMMAND": f"'{CODES[b]}'", "OBJ_DATA": "'NO'", "MAKE_EPHEM": "'YES'", "EPHEM_TYPE": "'VECTORS'", "CENTER": f"'500@{CODES[a]}'", "START_TIME": f"'{start}'",
            "STOP_TIME": f"'{stop}'", "STEP_SIZE": f"'{step}'", "REF_PLANE": "'ECLIPTIC'", "REF_SYSTEM": "'ICRF'", "OUT_UNITS": "'KM-S'", "VEC_TABLE": "'1'", "CSV_FORMAT": "'YES'", "TIME_TYPE": "'UT'"}


def fetch(a, b, start, stop, step):
    url = "https://ssd.jpl.nasa.gov/api/horizons.api?" + urllib.parse.urlencode(query(a, b, start, stop, step))
    for _ in range(4):
        text = json.load(urllib.request.urlopen(url, timeout=180)).get("result", "")
        if "$$SOE" in text:
            rows = [line.split(",") for line in text.split("$$SOE")[1].split("$$EOE")[0].strip().split("\n")]
            time.sleep(0.6)
            return [((float(r[0]) - EPOCH_JD) * 86400000, math.sqrt(sum(float(x) ** 2 for x in r[2:5]))) for r in rows]
        time.sleep(4)
    sys.exit(f"Horizons gave nothing for {a} {b}: {text[:300]}")


def stamp(ms, hours=0):
    return (datetime.datetime(1970, 1, 1) + datetime.timedelta(milliseconds=ms + hours * 3600000)).strftime("%Y-%m-%d %H:%M")


out = {"source": "JPL Horizons, https://ssd.jpl.nasa.gov/api/horizons.api", "fetched": datetime.date.today().isoformat(), "pairs": []}
for a, b in PAIRS:
    coarse = fetch(a, b, "1900-01-01", "2100-01-01", "10 d")
    entry = {"a": a, "b": b, "queries": {"coarse": query(a, b, "1900-01-01", "2100-01-01", "10 d")}}
    for name, pick, near in (("min", min, lambda value, best: value <= best * 1.01), ("max", max, lambda value, best: value >= best * 0.99)):
        best = pick(row[1] for row in coarse)
        turns = [coarse[i][0] for i in range(1, len(coarse) - 1) if near(coarse[i][1], best) and pick(coarse[i - 1][1], coarse[i][1], coarse[i + 1][1]) == coarse[i][1]]
        windows = []
        for ms in turns:
            start, stop = stamp(ms, -240), stamp(ms, 240)
            rows = fetch(a, b, start, stop, "6 h")
            windows.append((pick(row[1] for row in rows), {"query": query(a, b, start, stop, "6 h"), "ms": [row[0] for row in rows], "km": [row[1] for row in rows]}))
        entry[name] = pick(windows, key=lambda one: one[0])[1]
    out["pairs"].append(entry)
json.dump(out, open("test/data/horizons-distance.json", "w"), separators=(",", ":"))
print("wrote test/data/horizons-distance.json")
