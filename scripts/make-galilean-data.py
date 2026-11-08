#!/usr/bin/env python3
"""Writes src/data/galilean.ts: the theory L1.2 of the motion of Io, Europa, Ganymede and Callisto (V. Lainey, A. Vienne and L. Duriez; Lainey, Duriez and Vienne 2006, Astron. Astrophys. 456, 783;
IMCCE, Observatoire de Paris, https://ftp.imcce.fr/pub/ephem/satel/galilean/L1/L1.2/BisL1.2.dat), truncated. A term is kept when its amplitude reaches THRESHOLD kilometres of the moon's orbit.
Usage: python3 -I scripts/make-galilean-data.py [threshold-km]   (needs the network)"""
import sys, urllib.request

THRESHOLD = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0
URL = "https://ftp.imcce.fr/pub/ephem/satel/galilean/L1/L1.2/BisL1.2.dat"
NAMES = ["io", "europa", "ganymede", "callisto"]
AU_KM = 149597870.7

lines = urllib.request.urlopen(URL, timeout=120).read().decode("ascii", "ignore").split("\n")
pos = 0


def nums(line):
    return [float(x.replace("D", "E")) for x in line.replace("-", " -").replace("E -", "E-").replace("D -", "D-").split()]


def row():
    global pos
    pos += 1
    return lines[pos - 1]


t0 = nums(row())[0]
for _ in range(17):
    row()
mu = nums(row())
ome, ainc = nums(row())
moons = []
for ks in range(4):
    series, al = [], None
    for kv in range(4):
        n = int(row().split()[0])
        if kv == 1:
            al = nums(row())
        terms = []
        for _ in range(n):
            p = row().split()
            terms.append((float(p[1]), float(p[2].replace("D", "E")), float(p[3].replace("D", "E"))))
        series.append(terms)
    moons.append((al, series))
t1, t2 = nums(row())
cheb = []
for ks in range(4):
    rows = [nums(row())[1:6] for _ in range(9)]
    cheb.append(rows)

size = [m[1][0][0][0] * AU_KM for m in moons]  # the first term of the semi-major axis is the axis itself


def f(x, places):
    s = repr(round(x, places))
    return s.replace("0.", ".", 1) if s.startswith("0.") else s.replace("-0.", "-.", 1) if s.startswith("-0.") else s


out = [
    "// Made by scripts/make-galilean-data.py from L1.2 (V. Lainey, A. Vienne and L. Duriez; Lainey, Duriez and Vienne 2006, Astron. Astrophys. 456, 783; IMCCE, Observatoire de Paris, https://ftp.imcce.fr/pub/ephem/satel/galilean/L1/L1.2/); do not edit by hand.",
    "// Each moon is its mean longitude's constants, four series of terms [amplitude, phase, rate] (a in au; L, z and zeta in radians; time in days from T0, terrestrial time) and the Chebyshev coefficients of its very slow perturbations.",
    f"// A term is kept when its amplitude reaches {THRESHOLD:g} km of the moon's orbit.",
    "export interface GalileanMoon { name: string; l0: number; n0: number; series: readonly [readonly (readonly number[])[], readonly (readonly number[])[], readonly (readonly number[])[], readonly (readonly number[])[]]; chebyshev: readonly (readonly number[])[] }",
    f"export const GALILEAN_CONSTANTS = {{ t0: {t0!r}, mu: {mu!r}, node: {ome!r}, incline: {ainc!r}, years: [{t1!r}, {t2!r}] as const }};",
    "export const GALILEAN: readonly GalileanMoon[] = [",
]
total = 0
for ks, (al, series) in enumerate(moons):
    kept = []
    for kv, terms in enumerate(series):
        k = [t for i, t in enumerate(terms) if i == 0 and kv == 0 or abs(t[0]) * (AU_KM if kv == 0 else size[ks]) >= THRESHOLD]
        kept.append("[" + ",".join(f"[{f(a, 15)},{f(b, 9)},{f(c, 12)}]" for a, b, c in k) + "]")
        total += len(k)
    print(f"{NAMES[ks]:9s} {sum(len(s) for s in series):4d} terms", flush=True)
    ch = "[" + ",".join("[" + ",".join(repr(round(v, 15)) for v in r) + "]" for r in cheb[ks]) + "]"
    out.append(f'  {{ name: "{NAMES[ks]}", l0: {al[0]!r}, n0: {al[1]!r}, series: [{",".join(kept)}], chebyshev: {ch} }},')
out.append("];")
open("src/data/galilean.ts", "w").write("\n".join(out) + "\n")
print(f"threshold {THRESHOLD:g} km: {total} terms, src/data/galilean.ts")
