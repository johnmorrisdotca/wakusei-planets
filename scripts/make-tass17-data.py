#!/usr/bin/env python3
"""Writes src/data/tass17.ts: the theory TASS1.7 of the motion of Mimas, Enceladus, Tethys, Dione, Rhea, Titan, Hyperion and Iapetus (Vienne and Duriez 1995, Astron. Astrophys. 297, 588; IMCCE,
Observatoire de Paris, https://ftp.imcce.fr/pub/ephem/satel/tass17/), truncated. The numbers are read from Orbiter's copy of IMCCE's table, `Src/Celbody/Satsat/tass17.dat` in
github.com/orbitersim/orbiter (MIT, Copyright (c) Martin Schweiger), which keeps the 1.7 series in one plain file.
A term is kept when its amplitude times the moon's orbit size reaches the threshold (20 km by default). For the seven coupled moons, all the terms that feed the mean longitude perturbations are kept.
Usage: python3 -I scripts/make-tass17-data.py [threshold-km] [--input tass17.dat]"""
import argparse
from pathlib import Path
import urllib.request

parser = argparse.ArgumentParser(description="Write the truncated TASS1.7 tables.")
parser.add_argument("threshold_km", nargs="?", type=float, default=20.0)
parser.add_argument("--input", type=Path, help="Read a local copy of Orbiter's tass17.dat.")
args = parser.parse_args()
THRESHOLD = args.threshold_km
URL = "https://raw.githubusercontent.com/orbitersim/orbiter/main/Src/Celbody/Satsat/tass17.dat"
NAMES = ["mimas", "enceladus", "tethys", "dione", "rhea", "titan", "hyperion", "iapetus"]
AU_KM = 149597870.7

text = args.input.read_text(encoding="ascii") if args.input else urllib.request.urlopen(URL, timeout=120).read().decode("ascii")
tok = text.split()
pos = 0


def take(n=1):
    global pos
    out = tok[pos:pos + n]
    pos += n
    return out


gk, tas, aia, oma = [float(x) for x in take(4)]
tam = [float(x) for x in take(9)]
am = [float(x) for x in take(9)]
moons = {}
for i in range(8):
    if i == 6:
        continue
    series = []
    al0 = an0 = 0.0
    nlong = 0
    for j in range(4):
        _, ieq, nt1, nt2 = [int(x) for x in take(4)]
        if ieq == 2:
            _, a, b = take(3)
            al0, an0, nlong = float(a), float(b), nt1
        terms = []
        for _ in range(nt2):
            _, amp, phase, freq = take(4)
            ik = [int(x) for x in take(8)]
            terms.append((float(amp), float(phase), float(freq), ik))
        series.append(terms)
    moons[i] = (al0, an0, nlong, series)

# Hyperion's separate series is last in Orbiter's file. Its rates are radians per day.
hyp_epoch, hyp_rate = (float(x) for x in take(2))
hyp_offsets, hyp_series = [], []
for j in range(4):
    count = int(take()[0])
    if j < 2:
        hyp_offsets.append(float(take()[0]))
    hyp_series.append([tuple(float(x) for x in take(3)) for _ in range(count)])
if pos != len(tok):
    raise ValueError("unexpected data after the Hyperion series")

# the size of each orbit in km: the mean motion am (radians a day) and the masses give the semi-major axis, as TASS does
gk1 = (gk * 365.25) ** 2 / tas
size = {}
for i in range(8):
    n = am[i] * 365.25
    mu = gk1 * (1 / tam[i] + 1)
    size[i] = (mu / (n * n)) ** (1 / 3) * AU_KM


def f(x, places):
    s = repr(round(x, places))
    return s.replace("0.", ".", 1) if s.startswith("0.") else s.replace("-0.", "-.", 1) if s.startswith("-0.") else s


lines = [
    "// Made by scripts/make-tass17-data.py from TASS1.7 (Vienne and Duriez 1995, Astron. Astrophys. 297, 588; IMCCE, Observatoire de Paris, https://ftp.imcce.fr/pub/ephem/satel/tass17/) as Orbiter keeps its table",
    "// (github.com/orbitersim/orbiter, Src/Celbody/Satsat/tass17.dat, MIT, Copyright (c) Martin Schweiger); do not edit by hand.",
    f"// The coupled moons have mean longitude constants and four series of terms [amplitude, phase, rate, e0..e7] (a, lambda, z, zeta). The e's multiply the mean longitude perturbations. The amplitude cut is {THRESHOLD:g} km of the moon's orbit.",
    "export type Tass17Term = readonly number[];",
    "export interface Tass17Moon { name: string; l0: number; n0: number; longTerms: number; series: readonly [readonly Tass17Term[], readonly Tass17Term[], readonly Tass17Term[], readonly Tass17Term[]] }",
    f"export const TASS17_CONSTANTS = {{ gk: {gk!r}, tas: {tas!r}, incline: {aia!r}, node: {oma!r}, massRatio: {tam!r}, meanMotion: {am!r} }};",
]
total = 0
rows = []
for i, (al0, an0, nlong, series) in moons.items():
    kept = []
    for j, terms in enumerate(series):
        out = []
        for k, (amp, phase, freq, ik) in enumerate(terms):
            keep = amp * size[i] >= THRESHOLD or (j == 1 and k < nlong)
            if keep:
                out.append("[" + ",".join([f(amp, 12), f(phase, 7), f(freq, 8)] + [str(x) for x in ik]) + "]")
        kept.append(out)
    total += sum(len(o) for o in kept)
    print(f"{NAMES[i]:10s} {sum(len(s) for s in series):4d} -> {sum(len(o) for o in kept):4d} terms (orbit {size[i]:.0f} km)", flush=True)
    rows.append(f'  {{ name: "{NAMES[i]}", l0: {al0!r}, n0: {an0!r}, longTerms: {nlong}, series: [' + ",".join("[" + ",".join(o) + "]" for o in kept) + "] },")
lines.append("export const TASS17: readonly Tass17Moon[] = [")
lines += rows
lines.append("];")
lines += [
    "// Hyperion's four series use independent phases and rates in radians per day.",
    "type HyperionTerm = readonly [amplitude: number, phase: number, rate: number];",
    "export const TASS17_HYPERION: {",
    "  epoch: number; rate: number; motionOffset: number; longitudeOffset: number;",
    "  motion: readonly HyperionTerm[]; longitude: readonly HyperionTerm[];",
    "  eccentricity: readonly HyperionTerm[]; inclination: readonly HyperionTerm[];",
    "} = {",
    f"  epoch: {hyp_epoch!r}, rate: {hyp_rate!r}, motionOffset: {hyp_offsets[0]!r}, longitudeOffset: {hyp_offsets[1]!r},",
]
kept_hyp = 0
for name, terms in zip(("motion", "longitude", "eccentricity", "inclination"), hyp_series):
    kept = [f"[{f(amp, 12)},{f(phase, 8)},{f(rate, 12)}]" for amp, phase, rate in terms if abs(amp) * size[6] >= THRESHOLD]
    kept_hyp += len(kept)
    lines.append(f"  {name}: [" + ",".join(kept) + "],")
lines.append("};")
total += kept_hyp
print(f"hyperion   {sum(len(s) for s in hyp_series):4d} -> {kept_hyp:4d} terms (orbit {size[6]:.0f} km)")
open("src/data/tass17.ts", "w").write("\n".join(lines) + "\n")
print(f"threshold {THRESHOLD:g} km: {total} terms, src/data/tass17.ts")
