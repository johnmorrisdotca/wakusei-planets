#!/usr/bin/env python3
"""Writes scripts/moon-catalogue-magnitudes.json: V(1,0) for irregular moons that have no other size, from the U.S. Naval Observatory's satellite table for The Astronomical Almanac.

Why this page (MODULES-1762): English Wikipedia's moon tables are CC BY-SA 4.0, which this package does not use. JPL Horizons prints no V(1,0) for these moons. The Minor Planet Center's Natural Satellites Ephemeris Service is the table Wikipedia named, and its robots.txt disallows /cgi-bin/ (read 2026-11-23), so that service is not read. The Almanac file is a work of the United States government. Only the V(1,0) column is kept, and only where that column prints a number. A blank cell is left blank.

Usage: python3 -I scripts/make-moon-magnitudes.py --cache DIR
DIR is outside the repository. One request, kept there, never repeated while the file is there.
"""
import json, os, re, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = "https://aa.usno.navy.mil/downloads/publications/Satellite_data_web_b_2024_2.txt"
READ = "2026-11-23"
UA = "wakusei-moon-magnitudes/1.0 (one request for the USNO satellite table)"
PLANETS = {"Jupiter": "jupiter", "Saturn": "saturn", "Uranus": "uranus", "Neptune": "neptune"}


def table(cache):
    path = os.path.join(cache, "Satellite_data_web_b_2024_2.txt")
    if not os.path.exists(path):
        os.makedirs(cache, exist_ok=True)
        text = urllib.request.urlopen(urllib.request.Request(URL, headers={"User-Agent": UA}), timeout=120).read().decode("utf-8", "replace")
        open(path, "w").write(text)
    return open(path).read()


def magnitudes(text):
    """Name (letters only, lower case) to V(1,0), for a giant planet, where column 6 prints a number."""
    out = {}
    planet = None
    for line in text.splitlines():
        head = line.strip()
        for name in PLANETS:
            if head.startswith(name + " "):
                planet = name
        if planet is None or "*" not in line:
            continue
        parts = [part.strip() for part in line.split("*")]
        if len(parts) < 6:
            continue
        name = re.sub(r"^[IVXLC]+\s+", "", parts[0]).split("(")[0]
        name = re.sub(r"[^a-z]", "", name.lower())
        number = re.search(r"([0-9]+\.?[0-9]*)", parts[5])
        if name and number:
            out[(PLANETS[planet], name)] = float(number.group(1))
    return out


def catalogue():
    moons = []
    for line in open(os.path.join(ROOT, "src", "data", "moon-catalogue.ts")):
        line = line.strip().rstrip(",")
        if line.startswith("["):
            row = json.loads(line)
            moons.append({"id": row[0], "host": row[4], "radius": row[10], "group": row[18], "magnitudeFrom": row[-1]})
    return moons


def main():
    args = sys.argv[1:]
    if "--cache" not in args:
        raise SystemExit("usage: make-moon-magnitudes.py --cache DIR")
    found = magnitudes(table(args[args.index("--cache") + 1]))
    moons = {}
    for moon in catalogue():
        # A Horizons sheet magnitude (0) stays. This file is only the fallback, and only for an irregular moon with no radius.
        if moon["radius"] is not None or moon["magnitudeFrom"] == 0 or moon["group"] in ("regular", "inner", "none", "major"):
            continue
        key = (moon["host"], re.sub(r"[^a-z]", "", moon["id"]))
        if key in found:
            moons[moon["id"]] = {"h": found[key], "page": URL}
    doc = {
        "read": READ,
        "licence": "US government work",
        "page": URL,
        "note": "V(1,0) from the U.S. Naval Observatory satellite table for The Astronomical Almanac, the V(1,0) column only, where that column prints a number.",
        "moons": moons,
    }
    open(os.path.join(ROOT, "scripts", "moon-catalogue-magnitudes.json"), "w").write(json.dumps(doc, ensure_ascii=False, indent=1) + "\n")
    print(f"{len(moons)} magnitudes written")


if __name__ == "__main__":
    main()
