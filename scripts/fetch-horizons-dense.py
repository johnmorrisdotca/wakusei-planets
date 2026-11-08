#!/usr/bin/env python3
"""Writes test/data/horizons-dense.json: where JPL Horizons puts the planets, the Moon and the moons on 60 dates spread over 1800 to 2200 (a step of 2437 days, so no date sits on a
planet's period), for test/accuracy-dense.test.ts and the tables in docs/guides/accuracy.md. Same frame and centres as scripts/fetch-horizons-reference.py: J2000 ecliptic, kilometres, UT.
Usage: python3 -I scripts/fetch-horizons-dense.py   (needs the network)"""
import datetime, json, importlib.util, sys, time, urllib.parse, urllib.request

spec = importlib.util.spec_from_file_location("ref", __file__.replace("fetch-horizons-dense.py", "fetch-horizons-reference.py"))
src = open(spec.origin).read().split("out = {")[0]
ns = {}
exec(compile(src, spec.origin, "exec"), ns)
PLANETS, MOONS, vectors = ns["PLANETS"], ns["MOONS"], ns["vectors"]

start = datetime.datetime(1800, 3, 1, 12, tzinfo=datetime.timezone.utc)
DATES = [(start + datetime.timedelta(days=2437 * k)).strftime("%Y-%m-%dT%H:%M:%SZ") for k in range(60)]
DATES = [d for d in DATES if d < "2200-01-01"]
only = sys.argv[1:]
out = {"source": "JPL Horizons, https://ssd.jpl.nasa.gov/api/horizons.api", "dates": DATES, "planets": {}, "moons": {}}
for name, code in PLANETS.items():
    if only and name not in only:
        continue
    out["planets"][name] = vectors(code, "10", DATES)
    time.sleep(0.6)
for name, (code, centre) in MOONS.items():
    if only and name not in only:
        continue
    try:
        out["moons"][name] = vectors(code, centre, DATES)
    except SystemExit as e:
        print("skipped", name, e)
    time.sleep(0.6)
json.dump(out, open("test/data/horizons-dense.json", "w"), separators=(",", ":"))
print("wrote test/data/horizons-dense.json", len(DATES), "dates")
