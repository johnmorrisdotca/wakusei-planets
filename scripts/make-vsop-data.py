#!/usr/bin/env python3
"""Writes src/data/vsop.ts: the planets' heliocentric longitude, latitude and radius from the VSOP87B series, truncated.
VSOP87B (Bretagnon and Francou 1988, Astron. Astrophys. 202, 309; IMCCE, Observatoire de Paris, https://ftp.imcce.fr/pub/ephem/planets/vsop87/) gives each planet as
sums of A cos(B + C T) in spherical variables, equinox and ecliptic J2000, T in thousands of Julian years from J2000 in dynamical time. A term is kept when
A x TMAX^power reaches THRESHOLD (au or radians): TMAX of 0.25 is the years 1750 to 2250.
Usage: python3 -I scripts/make-vsop-data.py [threshold]   (needs the network; the default is the one the accuracy test is written for)
       python3 -I scripts/make-vsop-data.py fine [threshold]   writes src/tables/vsop.ts instead: the finer series (default 3e-7) that `tables/vsop` registers over the small ones"""
import json, math, re, sys, urllib.parse, urllib.request

FINE = len(sys.argv) > 1 and sys.argv[1] == "fine"
args = sys.argv[2:] if FINE else sys.argv[1:]
THRESHOLD = float(args[0]) if args else 3e-7 if FINE else 3e-6
TMAX = 0.25
BASE = "https://ftp.imcce.fr/pub/ephem/planets/vsop87/VSOP87B."
# VSOP87 was fitted to JPL's DE200; against today's Horizons the mean longitudes of these two planets have drifted, as a straight line in time over 1800 to 2200. The line is fitted
# here to Horizons (terrestrial time) on 80 dates that are not the accuracy test's, and taken out of the longitude as two terms [c, 0, 0] (A cos(0 + 0 T) = A) of power 0 and 1.
CORRECTED = ("jupiter", "neptune")
PLANETS = {"mercury": "mer", "venus": "ven", "earth": "ear", "mars": "mar", "jupiter": "jup", "saturn": "sat", "uranus": "ura", "neptune": "nep"}


CODES = {"jupiter": "5", "neptune": "8"}


def series(text):
    """[variable][power] -> list of (A, B, C), variable 0 longitude, 1 latitude, 2 radius."""
    out = [[[] for _ in range(6)] for _ in range(3)]
    variable = power = None
    for line in text.split("\n"):
        if "VERSION" in line:
            variable = int(re.search(r"VARIABLE\s+(\d)", line).group(1)) - 1
            power = int(re.search(r"\*T\*\*(\d)", line).group(1))
            continue
        p = line.split()
        if len(p) >= 8 and variable is not None:
            out[variable][power].append((float(p[-3]), float(p[-2]), float(p[-1])))
    return out


def longitude(data, t):
    """The cut series' heliocentric longitude (radians) at t thousands of Julian years from J2000."""
    return sum(t ** a * sum(A * math.cos(B + C * t) for A, B, C in terms) for a, terms in enumerate(data[0]))


def horizons_longitudes(code, jds):
    query = urllib.parse.urlencode({
        "format": "json", "COMMAND": f"'{code}'", "OBJ_DATA": "'NO'", "MAKE_EPHEM": "'YES'", "EPHEM_TYPE": "'VECTORS'", "CENTER": "'500@10'", "REF_PLANE": "'ECLIPTIC'", "REF_SYSTEM": "'ICRF'",
        "OUT_UNITS": "'KM-S'", "VEC_TABLE": "'1'", "CSV_FORMAT": "'YES'", "TIME_TYPE": "'TT'", "TLIST": "'" + " ".join(f"{jd:.6f}" for jd in jds) + "'"})
    text = json.load(urllib.request.urlopen(f"https://ssd.jpl.nasa.gov/api/horizons.api?{query}", timeout=120))["result"]
    rows = [line.split(",") for line in text.split("$$SOE")[1].split("$$EOE")[0].strip().split("\n")]
    return [math.atan2(float(r[3]), float(r[2])) for r in rows]


def drift(code, kept):
    """The straight line (c0 + c1 t) by which the cut series' longitude runs ahead of Horizons, from 80 dates from 1801 to 2199 (a step of 1801 days)."""
    jds = [2378000.0 + 1801.0 * k for k in range(80) if 2378000.0 + 1801.0 * k < 2524000.0]
    ts = [(jd - 2451545.0) / 365250 for jd in jds]
    dl = []
    for t, truth in zip(ts, horizons_longitudes(code, jds)):
        d = longitude(kept, t) - truth
        dl.append(math.atan2(math.sin(d), math.cos(d)))
    n = len(ts)
    mt, md = sum(ts) / n, sum(dl) / n
    c1 = sum((t - mt) * (d - md) for t, d in zip(ts, dl)) / sum((t - mt) ** 2 for t in ts)
    return md - c1 * mt, c1


def number(x, places):
    return repr(round(x, places)).replace("0.", ".", 1) if abs(x) < 1 and x != 0 else repr(round(x, places))


fine_lines = [
    "// Made by scripts/make-vsop-data.py fine from the VSOP87B series (Bretagnon and Francou 1988, Astron. Astrophys. 202, 309; IMCCE, Observatoire de Paris, https://ftp.imcce.fr/pub/ephem/planets/vsop87/); do not edit by hand.",
    f"// The finer cut: a term is kept when A x 0.25^power reaches {THRESHOLD:g}. Importing this file teaches `heliocentric` these series in place of the small ones in data/vsop.ts.",
    'import { registerPlanetSeries } from "../data/theories.ts";',
    "",
]
lines = [
    "// Made by scripts/make-vsop-data.py from the VSOP87B series (Bretagnon and Francou 1988, Astron. Astrophys. 202, 309; IMCCE, Observatoire de Paris, https://ftp.imcce.fr/pub/ephem/planets/vsop87/); do not edit by hand.",
    f"// Each planet is three variables (longitude, latitude, radius: radians and au, equinox and ecliptic J2000), each a list by power of T (thousands of Julian years from J2000, dynamical time) of terms [A, B, C]: A cos(B + C T).",
    f"// A term is kept when A x 0.25^power reaches {THRESHOLD:g}, so the sum is good for the years 1750 to 2250 and degrades slowly beyond.",
    "export type Term = readonly [number, number, number];",
    "export type Variable = readonly (readonly Term[])[];",
    "export type Series = readonly [Variable, Variable, Variable];",
]
names = []
total = 0
for name, code in PLANETS.items():
    data = series(urllib.request.urlopen(BASE + code, timeout=120).read().decode("ascii", "ignore"))
    kept = [[[t for t in data[v][a] if t[0] * (TMAX ** a) >= THRESHOLD] for a in range(6)] for v in range(3)]
    if name in CORRECTED:
        c0, c1 = drift(CODES[name], kept)
        kept[0][0].append((-c0, 0.0, 0.0))
        kept[0][1].append((-c1, 0.0, 0.0))
        print(f"{name:8s} longitude drift {c0 * 206264.806:+.2f} arc-seconds + {c1 * 206264.806:+.2f} per thousand years, taken out", flush=True)
    count = sum(len(terms) for var in kept for terms in var)
    total += count
    parts = []
    for var in kept:
        last = max((a for a in range(6) if var[a]), default=0)
        powers = ["[" + ",".join(f"[{number(A, 10)},{number(B, 6)},{number(C, 6)}]" for A, B, C in var[a]) + "]" for a in range(last + 1)]
        parts.append("[" + ",".join(powers) + "]")
    lines.append(f"/** {name.capitalize()}'s series, on its own so that a page that needs one planet imports only it. */")
    lines.append(f"export const VSOP_{name.upper()}: Series = [{', '.join(parts)}];")
    fine_lines.append(f'registerPlanetSeries("{name}", [{", ".join(parts)}]);')
    names.append(name)
    print(f"{name:8s} {count:5d} terms", flush=True)
lines.append("/** Every planet's series by name. */")
lines.append("export const VSOP87: Record<string, Series> = {")
for name in names:
    lines.append(f"  {name}: VSOP_{name.upper()},")
lines.append("};")
if FINE:
    open("src/tables/vsop.ts", "w").write("\n".join(fine_lines) + "\n")
    print(f"threshold {THRESHOLD:g}: {total} terms, src/tables/vsop.ts")
else:
    open("src/data/vsop.ts", "w").write("\n".join(lines) + "\n")
    print(f"threshold {THRESHOLD:g}: {total} terms, src/data/vsop.ts")
