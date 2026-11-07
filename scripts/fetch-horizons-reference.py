#!/usr/bin/env python3
"""Writes test/data/horizons.json: where JPL Horizons (https://ssd.jpl.nasa.gov/api/horizons.api) puts the planets, the dwarf planets, the Moon and the moons on a few dates, so that
test/accuracy.test.ts can measure the package against it without the network. J2000 ecliptic, kilometres, UT. Planets from the Sun's centre (the outer planets as
their system's barycentre, which is what JPL's elements describe), the Moon and the moons from their planet's centre (Nix and Hydra from the Pluto system's barycentre).
Usage: python3 -I scripts/fetch-horizons-reference.py"""
import json, sys, time, urllib.parse, urllib.request

PLANET_DATES = ["1800-01-03T12:00:00Z", "1900-01-03T12:00:00Z", "2000-01-01T12:00:00Z", "2026-11-07T12:00:00Z", "2050-01-01T12:00:00Z"]
MOON_DATES = ["1900-01-03T12:00:00Z", "1950-06-01T12:00:00Z", "2000-01-01T12:00:00Z", "2013-03-17T06:00:00Z", "2026-11-07T12:00:00Z", "2049-07-01T12:00:00Z", "2100-01-01T12:00:00Z"]
DWARF_DATES = ["1900-01-03T12:00:00Z", "1950-06-01T12:00:00Z", "2000-01-01T12:00:00Z", "2026-11-07T12:00:00Z", "2050-01-01T12:00:00Z", "2099-06-01T12:00:00Z"]
DWARFS = {"ceres": "1;", "orcus": "90482;", "haumea": "136108;", "quaoar": "50000;", "makemake": "136472;", "gonggong": "225088;", "eris": "136199;", "sedna": "90377;"}
PLANETS = {"mercury": "199", "venus": "299", "earth": "399", "mars": "499", "jupiter": "5", "saturn": "6", "uranus": "7", "neptune": "8", "pluto": "9"}
MOONS = {
    "moon": ("301", "399"), "phobos": ("401", "499"), "deimos": ("402", "499"), "io": ("501", "599"), "europa": ("502", "599"), "ganymede": ("503", "599"), "callisto": ("504", "599"),
    "mimas": ("601", "699"), "enceladus": ("602", "699"), "tethys": ("603", "699"), "dione": ("604", "699"), "rhea": ("605", "699"), "titan": ("606", "699"), "iapetus": ("608", "699"),
    "miranda": ("705", "799"), "ariel": ("701", "799"), "umbriel": ("702", "799"), "titania": ("703", "799"), "oberon": ("704", "799"),
    "triton": ("801", "899"), "nereid": ("802", "899"), "proteus": ("808", "899"), "charon": ("901", "999"), "nix": ("902", "9"), "hydra": ("903", "9"),
}


def julian(iso):
    import datetime
    t = datetime.datetime.strptime(iso, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=datetime.timezone.utc)
    return t.timestamp() / 86400 + 2440587.5


def vectors(code, centre, dates):
    query = urllib.parse.urlencode({
        "format": "json", "COMMAND": f"'{code}'", "OBJ_DATA": "'NO'", "MAKE_EPHEM": "'YES'", "EPHEM_TYPE": "'VECTORS'", "CENTER": f"'500@{centre}'",
        "REF_PLANE": "'ECLIPTIC'", "REF_SYSTEM": "'ICRF'", "OUT_UNITS": "'KM-S'", "VEC_TABLE": "'1'", "CSV_FORMAT": "'YES'", "TIME_TYPE": "'UT'",
        "TLIST": "'" + " ".join(f"{julian(d):.6f}" for d in dates) + "'"})
    for _ in range(4):
        text = json.load(urllib.request.urlopen(f"https://ssd.jpl.nasa.gov/api/horizons.api?{query}", timeout=120)).get("result", "")
        if "$$SOE" in text:
            return [[round(float(x), 1) for x in line.split(",")[2:5]] for line in text.split("$$SOE")[1].split("$$EOE")[0].strip().split("\n")]
        time.sleep(4)
    sys.exit(f"Horizons gave nothing for {code}@{centre}: {text[:200]}")


out = {"source": "JPL Horizons, https://ssd.jpl.nasa.gov/api/horizons.api", "planetDates": PLANET_DATES, "moonDates": MOON_DATES, "dwarfDates": DWARF_DATES, "planets": {}, "moons": {}, "dwarfs": {}}
for name, code in PLANETS.items():
    out["planets"][name] = vectors(code, "10", PLANET_DATES)
    time.sleep(0.6)
for name, code in DWARFS.items():
    out["dwarfs"][name] = vectors(code, "10", DWARF_DATES)
    time.sleep(0.6)
for name, (code, centre) in MOONS.items():
    out["moons"][name] = vectors(code, centre, MOON_DATES)
    time.sleep(0.6)
json.dump(out, open("test/data/horizons.json", "w"), separators=(",", ":"))
print("wrote test/data/horizons.json")
