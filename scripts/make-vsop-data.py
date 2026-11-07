#!/usr/bin/env python3
"""Writes src/data/vsop.ts: the planets' heliocentric longitude, latitude and radius from the VSOP87B series, truncated.
VSOP87B (Bretagnon and Francou 1988, Astron. Astrophys. 202, 309; IMCCE, Observatoire de Paris, https://ftp.imcce.fr/pub/ephem/planets/vsop87/) gives each planet as
sums of A cos(B + C T) in spherical variables, equinox and ecliptic J2000, T in thousands of Julian years from J2000 in dynamical time. A term is kept when
A x TMAX^power reaches THRESHOLD (au or radians): TMAX of 0.25 is the years 1750 to 2250.
Usage: python3 -I scripts/make-vsop-data.py [threshold]   (needs the network; the default is the one the accuracy test is written for)"""
import re, sys, urllib.request

THRESHOLD = float(sys.argv[1]) if len(sys.argv) > 1 else 3e-6
TMAX = 0.25
BASE = "https://ftp.imcce.fr/pub/ephem/planets/vsop87/VSOP87B."
PLANETS = {"mercury": "mer", "venus": "ven", "earth": "ear", "mars": "mar", "jupiter": "jup", "saturn": "sat", "uranus": "ura", "neptune": "nep"}


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


def number(x, places):
    return repr(round(x, places)).replace("0.", ".", 1) if abs(x) < 1 and x != 0 else repr(round(x, places))


lines = [
    "// Made by scripts/make-vsop-data.py from the VSOP87B series (Bretagnon and Francou 1988, Astron. Astrophys. 202, 309; IMCCE, Observatoire de Paris, https://ftp.imcce.fr/pub/ephem/planets/vsop87/); do not edit by hand.",
    f"// Each planet is three variables (longitude, latitude, radius: radians and au, equinox and ecliptic J2000), each a list by power of T (thousands of Julian years from J2000, dynamical time) of terms [A, B, C]: A cos(B + C T).",
    f"// A term is kept when A x 0.25^power reaches {THRESHOLD:g}, so the sum is good for the years 1750 to 2250 and degrades slowly beyond.",
    "export type Term = readonly [number, number, number];",
    "export type Variable = readonly (readonly Term[])[];",
    "export const VSOP87: Record<string, readonly [Variable, Variable, Variable]> = {",
]
total = 0
for name, code in PLANETS.items():
    data = series(urllib.request.urlopen(BASE + code, timeout=120).read().decode("ascii", "ignore"))
    kept = [[[t for t in data[v][a] if t[0] * (TMAX ** a) >= THRESHOLD] for a in range(6)] for v in range(3)]
    count = sum(len(terms) for var in kept for terms in var)
    total += count
    parts = []
    for var in kept:
        last = max((a for a in range(6) if var[a]), default=0)
        powers = ["[" + ",".join(f"[{number(A, 10)},{number(B, 6)},{number(C, 6)}]" for A, B, C in var[a]) + "]" for a in range(last + 1)]
        parts.append("[" + ",".join(powers) + "]")
    lines.append(f"  {name}: [{', '.join(parts)}],")
    print(f"{name:8s} {count:5d} terms", flush=True)
lines.append("};")
open("src/data/vsop.ts", "w").write("\n".join(lines) + "\n")
print(f"threshold {THRESHOLD:g}: {total} terms, src/data/vsop.ts")
