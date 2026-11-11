#!/usr/bin/env python3
"""Writes src/tables/minor.ts: the minor bodies Vesta, Pallas, Chiron, Pholus and Halley's comet from JPL Horizons (https://ssd.jpl.nasa.gov/api/horizons.api), as Chebyshev series, and src/data/minor.ts's
osculating elements (the plain ellipse used outside a table's years). Each body is measured from the solar system's barycentre (Horizons centre 500@0, ecliptic and equinox J2000, au, TDB), the same as the dwarf
planets (scripts/make-dwarf-data.py); the package adds the Sun's swing back at run time (src/ephemeris.ts).
The segments are not all one length: a comet moves fast near the Sun and slowly far from it, so the cut is made greedily, each segment as long as it can be (up to MAX_YEARS) while a polynomial of DEGREE for x, y and z
fitted to every other sample still lies within TOLERANCE arc-seconds (seen from the barycentre) of the samples left out. The table says where each segment starts (`edges`) and the worst error it measured.
Usage: python3 -I scripts/make-minor-data.py   (needs the network; it writes the raw answers to MINOR_RAW, a folder outside the repository, and reads them from there when they are already there)"""
import datetime, json, math, os, urllib.parse, urllib.request

UNIX_EPOCH_JD = 2440587.5
RAW = os.environ.get("MINOR_RAW", os.path.expanduser("~/Projects/backups/wakusei-planets/2026-11-10-minor-horizons"))
UA = {"User-Agent": "wakusei-planets-data-build (john@johnmorris.ca)"}
TOLERANCE = 1.0
# Halley is Horizons' record 90000030, the solution of the 1986 apparition (epoch 1968, observations 1835 to 1994): "DES=1P;CAP" picks a different apparition's solution for each request, so a table cut from several requests would join several orbits.
# name: (Horizons command, first year, last year, days between samples, longest segment in years, degree)
BODIES = {
    "vesta": ("4;", 1900, 2100, 2, 4, 12),
    "pallas": ("2;", 1900, 2100, 2, 4, 14),
    "chiron": ("2060;", 1800, 2200, 5, 10, 11),
    "pholus": ("5145;", 1800, 2200, 5, 10, 11),
    "halley": ("90000030", 1800, 2200, 0.5, 16, 13),
}


def jd(year):
    return (datetime.datetime(year, 1, 1, tzinfo=datetime.timezone.utc).timestamp() / 86400) + UNIX_EPOCH_JD


def fetch(name, code, first, last, step):
    """Rows of (JD TDB, [x, y, z]) from the barycentre, in 50-year requests so none is too large; the raw answers are kept in RAW."""
    os.makedirs(RAW, exist_ok=True)
    path = os.path.join(RAW, f"{name}.json")
    if os.path.exists(path):
        answers = json.load(open(path))
    else:
        answers = []
        year = first
        while year < last:
            stop = min(year + 50, last)
            query = urllib.parse.urlencode({
                "format": "json", "COMMAND": f"'{code}'", "OBJ_DATA": "'NO'", "MAKE_EPHEM": "'YES'", "EPHEM_TYPE": "'VECTORS'", "CENTER": "'500@0'", "REF_PLANE": "'ECLIPTIC'", "REF_SYSTEM": "'ICRF'",
                "OUT_UNITS": "'AU-D'", "VEC_TABLE": "'1'", "CSV_FORMAT": "'YES'", "TIME_TYPE": "'TDB'", "START_TIME": f"'{year}-01-01'", "STOP_TIME": f"'{stop}-01-01'", "STEP_SIZE": f"'{round(step * 1440)} m'"})
            text = json.load(urllib.request.urlopen(urllib.request.Request(f"https://ssd.jpl.nasa.gov/api/horizons.api?{query}", headers=UA), timeout=180)).get("result", "")
            if "$$SOE" not in text:
                raise SystemExit(f"Horizons gave nothing for {code} {year}: {text[:200]}")
            answers.append(text)
            year = stop
        json.dump(answers, open(path, "w"))
    rows = []
    for text in answers:
        for line in text.split("$$SOE")[1].split("$$EOE")[0].strip().split("\n"):
            p = line.split(",")
            t = float(p[0])
            if rows and t <= rows[-1][0] + 1e-6:
                continue
            rows.append((t, [float(p[2]), float(p[3]), float(p[4])]))
    return rows


def chebyshev(x, n):
    t = [1.0, x]
    for _ in range(2, n + 1):
        t.append(2 * x * t[-1] - t[-2])
    return t[: n + 1]


def solve(a, rhs):
    """Gaussian elimination with partial pivoting, one matrix and several right-hand sides (the three axes)."""
    n = len(a)
    m = [a[i][:] + [r[i] for r in rhs] for i in range(n)]
    for c in range(n):
        pivot = max(range(c, n), key=lambda r: abs(m[r][c]))
        m[c], m[pivot] = m[pivot], m[c]
        for r in range(n):
            if r != c:
                f = m[r][c] / m[c][c]
                m[r] = [u - f * v for u, v in zip(m[r], m[c])]
    return [[m[i][n + k] / m[i][i] for i in range(n)] for k in range(len(rhs))]


def fit(samples, degree):
    basis = [chebyshev(s[0], degree) for s in samples]
    normal = [[sum(row[i] * row[j] for row in basis) for j in range(degree + 1)] for i in range(degree + 1)]
    rhs = [[sum(row[i] * s[1][axis] for row, s in zip(basis, samples)) for i in range(degree + 1)] for axis in range(3)]
    return solve(normal, rhs)


def error_of(coefficients, held, degree):
    worst = 0.0
    for x, v in held:
        basis = chebyshev(x, degree)
        p = [sum(c * u for c, u in zip(axis, basis)) for axis in coefficients]
        worst = max(worst, math.degrees(math.dist(p, v) / math.hypot(*v)) * 3600)
    return worst


def cut(rows, first_jd, last_jd, max_days, degree):
    """Greedy segments: from each start, the longest length (shrinking by a fifth at a time) whose fit is within TOLERANCE."""
    segments, edges, worst = [], [first_jd], 0.0
    lo = first_jd
    times = [r[0] for r in rows]
    import bisect
    while lo < last_jd - 1e-6:
        length = min(max_days, last_jd - lo)
        while True:
            hi = lo + length
            a, b = bisect.bisect_left(times, lo - 1e-9), bisect.bisect_right(times, hi + 1e-9)
            inside = rows[a:b]
            if len(inside) >= 2 * (degree + 1) + 2 or length <= 1:
                samples = [(2 * (t - lo) / length - 1, v) for t, v in inside]
                fitting = samples[0::2]
                stride = max(1, len(fitting) // 160)
                fitting = fitting[::stride]
                held = samples[1::2]
                held = held[:: max(1, len(held) // 400)]
                coefficients = fit(fitting, degree)
                err = error_of(coefficients, held, degree)
                if err <= TOLERANCE or length <= 1:
                    break
            length *= 0.8
        segments.append(coefficients)
        edges.append(hi)
        worst = max(worst, err)
        lo = hi
    return segments, edges, worst


tables = {}
for name, (code, first, last, step, years, degree) in BODIES.items():
    rows = fetch(name, code, first, last, step)
    segments, edges, worst = cut(rows, jd(first), jd(last), years * 365.25, degree)
    print(f"{name}: {first} to {last}, {len(segments)} segments (up to {years} years each), degree {degree}: worst error on held-back samples {worst:.4f} arc-seconds")
    tables[name] = (round((jd(first) - UNIX_EPOCH_JD) * 86400000), [round((e - jd(first)) * 86400000) for e in edges], worst, segments, degree, first, last)

lines = [
    "// Made by scripts/make-minor-data.py from JPL Horizons (https://ssd.jpl.nasa.gov/api/horizons.api): Vesta, Pallas, Chiron, Pholus and Halley's comet, each one's position from the solar system's barycentre, ecliptic and equinox J2000, in au, terrestrial time.",
    "// Chebyshev segments of unequal length (`edges` are where they start, in milliseconds from `start`): one polynomial of the stated degree for each of x, y and z; the Sun's swing about the barycentre is added back by src/ephemeris.ts. The error on samples held back from each fit is in `worst`. Do not edit by hand.",
    'import { registerTable } from "../data/tables.ts";',
    "",
]
for name, (start, edges, worst, segments, degree, first, last) in tables.items():
    lines.append(f"// {name}: {first} to {last}, {len(segments)} segments, degree {degree}")
    lines.append(f'registerTable("{name}", {{ start: {start}, segment: {round(edges[-1] / len(segments))}, edges: [{",".join(str(e) for e in edges)}], worst: {worst:.4f}, segments: [')
    for coefficients in segments:
        lines.append("  [" + ",".join("[" + ",".join(repr(round(c, 8)) for c in axis) + "]" for axis in coefficients) + "],")
    lines.append("] });")
open("src/tables/minor.ts", "w").write("\n".join(lines) + "\n")
print("wrote src/tables/minor.ts")
