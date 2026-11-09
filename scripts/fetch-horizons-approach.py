#!/usr/bin/env python3
"""Writes test/data/horizons-approach.json: where JPL Horizons (https://ssd.jpl.nasa.gov/api/horizons.api) puts pairs of bodies on the sky around three known close approaches, so that
test/nearest.test.ts can measure the package's closest-approach search against it without the network. Astrometric right ascension and declination (ICRF, light time allowed for, no aberration)
seen from the Earth's centre (CENTER 500@399), time in UT (UTC since 1962), 9 decimals of a degree. Each entry keeps its Horizons query. The Moon's month is found from an hourly table of the Moon and
each planet (not kept) and then each Moon-planet minimum is fetched again at one-minute steps for two hours either side. One more table is topocentric, for a place in Vancouver (SITE_COORD).
Usage: python3 -I scripts/fetch-horizons-approach.py"""
import datetime, json, math, sys, time, urllib.parse, urllib.request

CODES = {"moon": "301", "mercury": "199", "venus": "299", "mars": "499", "jupiter": "599", "saturn": "699", "uranus": "799", "neptune": "899"}
MONTH = ("2026-12-01 00:00", "2027-01-01 00:00")
FORMAT = "%Y-%b-%d %H:%M:%S"


def query(body, start, stop, step, site=None):
    params = {
        "format": "json", "COMMAND": f"'{CODES[body]}'", "OBJ_DATA": "'NO'", "MAKE_EPHEM": "'YES'", "EPHEM_TYPE": "'OBSERVER'", "CENTER": "'500@399'" if site is None else "'coord@399'",
        "START_TIME": f"'{start}'", "STOP_TIME": f"'{stop}'", "STEP_SIZE": f"'{step}'", "QUANTITIES": "'1'", "ANG_FORMAT": "'DEG'", "EXTRA_PREC": "'YES'",
        "CSV_FORMAT": "'YES'", "TIME_DIGITS": "'SECONDS'"}
    if site is not None:
        params.update({"COORD_TYPE": "'GEODETIC'", "SITE_COORD": f"'{site}'"})
    return params


def fetch(body, start, stop, step, site=None):
    params = query(body, start, stop, step, site)
    url = "https://ssd.jpl.nasa.gov/api/horizons.api?" + urllib.parse.urlencode(params)
    for _ in range(4):
        text = json.load(urllib.request.urlopen(url, timeout=120)).get("result", "")
        if "$$SOE" in text:
            rows = [line.split(",") for line in text.split("$$SOE")[1].split("$$EOE")[0].strip().split("\n")]
            time.sleep(0.6)
            return [(datetime.datetime.strptime(r[0].strip(), FORMAT).replace(tzinfo=datetime.timezone.utc), float(r[3]), float(r[4])) for r in rows]
        time.sleep(4)
    sys.exit(f"Horizons gave nothing for {body} {start}: {text[:300]}")


def separation(a, b):
    (r1, d1), (r2, d2) = (math.radians(a[1]), math.radians(a[2])), (math.radians(b[1]), math.radians(b[2]))
    return math.degrees(math.acos(max(-1, min(1, math.sin(d1) * math.sin(d2) + math.cos(d1) * math.cos(d2) * math.cos(r1 - r2)))))


def entry(label, a, b, start, stop, step, site=None):
    ra, rb = fetch(a, start, stop, step, site), fetch(b, start, stop, step, site)
    assert [r[0] for r in ra] == [r[0] for r in rb]
    return {
        "label": label, "a": a, "b": b, "queries": {a: query(a, start, stop, step, site), b: query(b, start, stop, step, site)},
        "start": ra[0][0].strftime("%Y-%m-%dT%H:%M:%SZ"), "stepSeconds": (ra[1][0] - ra[0][0]).total_seconds(),
        "a_ra_dec": [[x[1], x[2]] for x in ra], "b_ra_dec": [[x[1], x[2]] for x in rb]}


out = {"source": "JPL Horizons, https://ssd.jpl.nasa.gov/api/horizons.api", "fetched": datetime.date.today().isoformat(), "events": []}
out["events"].append(entry("the Jupiter-Saturn great conjunction of 2020-12-21", "jupiter", "saturn", "2020-12-21 16:00", "2020-12-21 20:40", "1 m"))
out["events"].append(entry("Venus and Jupiter on 2023-03-01 and 2023-03-02", "venus", "jupiter", "2023-03-01 12:00", "2023-03-02 12:00", "5 m"))

moon = fetch("moon", *MONTH, "1 h")
for planet in ("mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune"):
    other = fetch(planet, *MONTH, "1 h")
    d = [separation(m, p) for m, p in zip(moon, other)]
    for i in range(1, len(d) - 1):
        if d[i] <= d[i - 1] and d[i] < d[i + 1] and d[i] < 12:
            start = (moon[i][0] - datetime.timedelta(hours=2)).strftime("%Y-%m-%d %H:%M")
            stop = (moon[i][0] + datetime.timedelta(hours=2)).strftime("%Y-%m-%d %H:%M")
            out["events"].append(entry(f"the Moon and {planet}, December 2026", "moon", planet, start, stop, "1 m"))
# a place on the Earth (Vancouver, east longitude, latitude, height in km): the Moon's parallax is up to a degree
out["topocentric"] = {"observer": {"latitude": 49.28, "longitude": -123.12, "heightM": 70}, **entry("the Moon and Venus from Vancouver, 2026-12-05", "moon", "venus", "2026-12-05 00:00", "2026-12-05 12:00", "30 m", "-123.12,49.28,0.07")}
json.dump(out, open("test/data/horizons-approach.json", "w"), separators=(",", ":"))
print("wrote test/data/horizons-approach.json,", len(out["events"]), "events")
