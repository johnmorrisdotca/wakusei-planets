#!/usr/bin/env python3
"""Writes src/data/dwarfs.ts: the dwarf planets from JPL Horizons (https://ssd.jpl.nasa.gov/api/horizons.api), as Chebyshev series.
Each body is measured from the solar system's barycentre (Horizons centre 500@0, ecliptic and equinox J2000, au, TDB), where its path is smooth: from the Sun it also carries the Sun's own
twelve-year swing about the barycentre (Jupiter's pull), which no short polynomial follows. The package adds that swing back at run time from the planets' masses (src/ephemeris.ts).
Each body is cut into segments of YEARS Julian years, each a polynomial of DEGREE for x, y and z, fitted by least squares to samples STEP days apart; the odd samples are kept back and the
fit is measured on them. Usage: python3 -I scripts/make-dwarf-data.py   (needs the network; the table of bodies below says how each is cut)"""
import json, math, urllib.parse, urllib.request

UNIX_EPOCH_JD = 2440587.5
# name: (Horizons small-body code, first year, last year, days between samples, segment years, degree)
BODIES = {
    "ceres": ("1;", 1900, 2100, 2, 4, 16),
    "orcus": ("90482;", 1800, 2200, 20, 50, 9),
    "haumea": ("136108;", 1800, 2200, 20, 100, 11),
    "quaoar": ("50000;", 1800, 2200, 20, 100, 8),
    "makemake": ("136472;", 1800, 2200, 20, 100, 10),
    "gonggong": ("225088;", 1800, 2200, 20, 50, 10),
    "eris": ("136199;", 1800, 2200, 20, 200, 10),
    "sedna": ("90377;", 1800, 2200, 20, 100, 10),
}


def jd(year):
    import datetime
    return (datetime.datetime(year, 1, 1, tzinfo=datetime.timezone.utc).timestamp() / 86400) + UNIX_EPOCH_JD


def fetch(code, first, last, step):
    """Rows of (JD TDB, [x, y, z]) from the barycentre, in 50-year requests so none is too large."""
    rows = []
    year = first
    while year < last:
        stop = min(year + 50, last)
        query = urllib.parse.urlencode({
            "format": "json", "COMMAND": f"'{code}'", "OBJ_DATA": "'NO'", "MAKE_EPHEM": "'YES'", "EPHEM_TYPE": "'VECTORS'", "CENTER": "'500@0'", "REF_PLANE": "'ECLIPTIC'", "REF_SYSTEM": "'ICRF'",
            "OUT_UNITS": "'AU-D'", "VEC_TABLE": "'1'", "CSV_FORMAT": "'YES'", "TIME_TYPE": "'TDB'", "START_TIME": f"'{year}-01-01'", "STOP_TIME": f"'{stop}-01-01'", "STEP_SIZE": f"'{step} d'"})
        text = json.load(urllib.request.urlopen(f"https://ssd.jpl.nasa.gov/api/horizons.api?{query}", timeout=180)).get("result", "")
        if "$$SOE" not in text:
            raise SystemExit(f"Horizons gave nothing for {code} {year}: {text[:200]}")
        for line in text.split("$$SOE")[1].split("$$EOE")[0].strip().split("\n"):
            p = line.split(",")
            t = float(p[0])
            if rows and t <= rows[-1][0] + 1e-6:
                continue
            rows.append((t, [float(p[2]), float(p[3]), float(p[4])]))
        year = stop
    return rows


def chebyshev(x, n):
    t = [1.0, x]
    for _ in range(2, n + 1):
        t.append(2 * x * t[-1] - t[-2])
    return t[: n + 1]


def solve(a, b):
    n = len(b)
    m = [a[i][:] + [b[i]] for i in range(n)]
    for c in range(n):
        pivot = max(range(c, n), key=lambda r: abs(m[r][c]))
        m[c], m[pivot] = m[pivot], m[c]
        for r in range(n):
            if r != c:
                f = m[r][c] / m[c][c]
                m[r] = [u - f * v for u, v in zip(m[r], m[c])]
    return [m[i][n] / m[i][i] for i in range(n)]


def fit(samples, degree):
    basis = [chebyshev(s[0], degree) for s in samples]
    out = []
    for axis in range(3):
        normal = [[sum(row[i] * row[j] for row in basis) for j in range(degree + 1)] for i in range(degree + 1)]
        rhs = [sum(row[i] * s[1][axis] for row, s in zip(basis, samples)) for i in range(degree + 1)]
        out.append(solve(normal, rhs))
    return out


tables = {}
for name, (code, first, last, step, years, degree) in BODIES.items():
    rows = fetch(code, first, last, step)
    seg_days = years * 365.25
    start_jd = jd(first)
    count = math.ceil((last - first) / years)
    segments, worst = [], 0.0
    for k in range(count):
        lo = start_jd + k * seg_days
        inside = [(t, v) for t, v in rows if lo <= t <= lo + seg_days]
        samples = [(2 * (t - lo) / seg_days - 1, v) for t, v in inside]
        coefficients = fit(samples[0::2], degree)
        for x, v in samples[1::2]:
            basis = chebyshev(x, degree)
            p = [sum(c * u for c, u in zip(axis, basis)) for axis in coefficients]
            worst = max(worst, math.degrees(math.dist(p, v) / math.hypot(*v)) * 3600)
        segments.append(coefficients)
    print(f"{name}: {first} to {last}, {count} segments of {years} years, degree {degree}: worst error on held-back samples {worst:.4f} arc-seconds")
    tables[name] = (round((start_jd - UNIX_EPOCH_JD) * 86400000), round(seg_days * 86400000), worst, segments, years, degree, first, last)

lines = [
    "// Made by scripts/make-dwarf-data.py from JPL Horizons (https://ssd.jpl.nasa.gov/api/horizons.api): each dwarf planet's position from the solar system's barycentre, ecliptic and equinox J2000, in au, terrestrial time.",
    "// Chebyshev segments, one polynomial of the stated degree for each of x, y and z; the Sun's swing about the barycentre is added back by src/ephemeris.ts. The error on samples held back from each fit is in `worst`. Do not edit by hand.",
    "/** One dwarf planet's table. */",
    "export interface FittedTable {",
    "  /** Milliseconds since 1970, in terrestrial time, at the start of the first segment. */",
    "  start: number;",
    "  /** The length of a segment in milliseconds. */",
    "  segment: number;",
    "  /** The error on samples held back from the fit, in arc-seconds. */",
    "  worst: number;",
    "  /** By segment, then x, y, z, then the Chebyshev coefficients, in au. */",
    "  segments: readonly (readonly (readonly number[])[])[];",
    "}",
    "",
    "export const DWARF_TABLES: Readonly<Record<string, FittedTable>> = {",
]
for name, (start, segment, worst, segments, years, degree, first, last) in tables.items():
    lines.append(f"  // {first} to {last}, {len(segments)} segments of {years} years, degree {degree}")
    lines.append(f"  {name}: {{ start: {start}, segment: {segment}, worst: {worst:.4f}, segments: [")
    for coefficients in segments:
        lines.append("    [" + ",".join("[" + ",".join(repr(round(c, 9)) for c in axis) + "]" for axis in coefficients) + "],")
    lines.append("  ] },")
lines.append("};")
open("src/data/dwarfs.ts", "w").write("\n".join(lines) + "\n")
print("wrote src/data/dwarfs.ts")
