#!/usr/bin/env python3
"""Writes src/data/pluto.ts: the Pluto system's barycentre from JPL Horizons (https://ssd.jpl.nasa.gov/api/horizons.api, heliocentric, ecliptic and equinox J2000, au, TDB),
1800 to 2200, as Chebyshev series: segments of YEARS Julian years, each a polynomial of degree DEGREE for x, y and z, fitted by least squares to samples every ten days.
VSOP87 has no Pluto, and JPL's approximate elements for it are 39 arc-seconds from Horizons; a slow body needs only a short table. Half of the samples (the odd ones) are kept back and
the fit is measured on them. Usage: python3 -I scripts/make-pluto-data.py [degree [years]]   (needs the network)"""
import json, math, sys, urllib.parse, urllib.request

YEARS = float(sys.argv[2]) if len(sys.argv) > 2 else 20.0  # the length of a segment in Julian years: 5, 10 or 20
DEGREE = int(sys.argv[1]) if len(sys.argv) > 1 else 13
SEGMENT_DAYS = YEARS * 365.25
SEGMENTS = round(400 / YEARS)
START_JD = 2378496.5  # 1800-01-01 00:00 TDB
UNIX_EPOCH_JD = 2440587.5


def fetch():
    query = urllib.parse.urlencode({
        "format": "json", "COMMAND": "'9'", "OBJ_DATA": "'NO'", "MAKE_EPHEM": "'YES'", "EPHEM_TYPE": "'VECTORS'", "CENTER": "'500@10'", "REF_PLANE": "'ECLIPTIC'", "REF_SYSTEM": "'ICRF'",
        "OUT_UNITS": "'AU-D'", "VEC_TABLE": "'1'", "CSV_FORMAT": "'YES'", "TIME_TYPE": "'TDB'", "START_TIME": "'1800-01-01'", "STOP_TIME": "'2200-01-01'", "STEP_SIZE": "'10 d'"})
    text = json.load(urllib.request.urlopen(f"https://ssd.jpl.nasa.gov/api/horizons.api?{query}", timeout=180)).get("result", "")
    if "$$SOE" not in text:
        sys.exit(f"Horizons gave nothing: {text[:200]}")
    rows = []
    for line in text.split("$$SOE")[1].split("$$EOE")[0].strip().split("\n"):
        p = line.split(",")
        rows.append((float(p[0]), [float(p[2]), float(p[3]), float(p[4])]))
    return rows


def chebyshev(x, n):
    t = [1.0, x]
    for k in range(2, n + 1):
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


def fit(samples):
    """Chebyshev coefficients for x, y and z over one segment: samples are (x in -1..1, [x, y, z])."""
    basis = [chebyshev(s[0], DEGREE) for s in samples]
    out = []
    for axis in range(3):
        normal = [[sum(row[i] * row[j] for row in basis) for j in range(DEGREE + 1)] for i in range(DEGREE + 1)]
        rhs = [sum(row[i] * s[1][axis] for row, s in zip(basis, samples)) for i in range(DEGREE + 1)]
        out.append(solve(normal, rhs))
    return out


def evaluate(coefficients, x):
    t = chebyshev(x, DEGREE)
    return [sum(c * u for c, u in zip(axis, t)) for axis in coefficients]


rows = fetch()
segments, worst = [], 0.0
for k in range(SEGMENTS):
    lo = START_JD + k * SEGMENT_DAYS
    inside = [(jd, v) for jd, v in rows if lo <= jd <= lo + SEGMENT_DAYS]
    samples = [(2 * (jd - lo) / SEGMENT_DAYS - 1, v) for jd, v in inside]
    coefficients = fit(samples[0::2])
    for x, v in samples[1::2]:
        p = evaluate(coefficients, x)
        miss = math.dist(p, v)
        worst = max(worst, math.degrees(miss / math.hypot(*v)) * 3600)
    segments.append(coefficients)
print(f"degree {DEGREE}, {SEGMENTS} segments of {SEGMENT_DAYS / 365.25:g} years: worst error on held-back samples {worst:.5f} arc-seconds")

start_ms = round((START_JD - UNIX_EPOCH_JD) * 86400000)
lines = [
    "// Made by scripts/make-pluto-data.py from JPL Horizons (https://ssd.jpl.nasa.gov/api/horizons.api): the Pluto system's barycentre, heliocentric, ecliptic and equinox J2000, in au.",
    f"// 1800 to 2200 as {SEGMENTS} Chebyshev segments of {YEARS:g} Julian years, degree {DEGREE}; measured on samples held back from the fit: {worst:.5f} arc-seconds. Each segment is fitted on its own, so the position can step by about that much where one ends and the next begins. Do not edit by hand.",
    f"/** Milliseconds since 1970, in terrestrial time, at the start of the first segment (1800-01-01). */\nexport const PLUTO_START = {start_ms};",
    f"/** The length of a segment in milliseconds: {YEARS:g} Julian years. */\nexport const PLUTO_SEGMENT_MS = {round(SEGMENT_DAYS * 86400000)};",
    "/** By segment, then x, y, z, then the Chebyshev coefficients, in au. */",
    "export const PLUTO: readonly (readonly (readonly number[])[])[] = [",
]
for coefficients in segments:
    lines.append("  [" + ",".join("[" + ",".join(repr(round(c, 9)) for c in axis) + "]" for axis in coefficients) + "],")
lines.append("];")
open("src/data/pluto.ts", "w").write("\n".join(lines) + "\n")
print("wrote src/data/pluto.ts")
