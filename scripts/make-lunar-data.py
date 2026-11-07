#!/usr/bin/env python3
"""Writes src/data/lunar.ts: the Moon's longitude, latitude and distance from the lunar solution ELP2000-82B (Chapront-Touze and Chapront, Astron. Astrophys. 124, 50 (1983) and 190, 342 (1988);
IMCCE, Observatoire de Paris, https://ftp.imcce.fr/pub/ephem/moon/elp82b/), truncated. The 36 files hold 37,872 terms; each is a sine of a whole-number mix of the Moon's and the planets' mean arguments, and
the ones kept are those above THRESHOLD arc-seconds (kilometres of distance count as 1 arc-second to 1.87 km, the Moon's mean distance over the arc-second). The constants fitted to JPL's DE200 are folded into the main
problem's amplitudes as the IMCCE notice describes (src/ephemeris.ts holds the arguments and the precession of the final frame). Usage: python3 -I scripts/make-lunar-data.py [threshold]   (needs the network)"""
import math, sys, urllib.request

THRESHOLD = float(sys.argv[1]) if len(sys.argv) > 1 else 0.05
BASE = "https://ftp.imcce.fr/pub/ephem/moon/elp82b/ELP"
RAD = 648000.0 / math.pi
DEG = math.pi / 180
KM_PER_ARCSECOND = 385000.0 / 206264.806
# the corrections of the constants (fit to DE200), from the notice
AM, ALPHA = 0.074801329518, 0.002571881335
DTASM = 2 * ALPHA / (3 * AM)
W1_RATE = 1732559343.73604 / RAD
DELNU = 0.55604 / RAD / W1_RATE
DELE, DELG = 0.01789 / RAD, -0.08066 / RAD
DELNP = -0.06424 / RAD / W1_RATE
DELEP = -0.12879 / RAD


def read(index):
    return urllib.request.urlopen(f"{BASE}{index}", timeout=120).read().decode("ascii").split("\n")[1:]


main, periodic = [], []
for f in range(1, 37):
    coordinate = (f - 1) % 3
    table = (f + 2) // 3
    power = 1 if table in (3, 5, 7, 9) else (2 if table == 12 else 0)
    for line in read(f):
        if not line.strip():
            continue
        if f <= 3:
            n = [int(line[3 * i:3 * i + 3]) for i in range(4)]
            c = [float(line[14:27])] + [float(line[29 + 12 * j:39 + 12 * j]) for j in range(6)]
            tgv = c[1] + DTASM * c[5]
            if f == 3:
                c[0] = c[0] - 2 * c[0] * DELNU / 3
            amplitude = c[0] + tgv * (DELNP - AM * DELNU) + c[2] * DELG + c[3] * DELE + c[4] * DELEP
            main.append((coordinate, amplitude, n))
        elif 4 <= f <= 9 or f >= 22:
            n = [int(line[3 + 3 * i:6 + 3 * i]) for i in range(4)]
            periodic.append((coordinate, power, float(line[26:35]), float(line[16:25]), n + [int(line[0:3])] + [0] * 8))
        else:
            ip = [int(line[3 * i:3 * i + 3]) for i in range(11)]
            pha, amplitude = float(line[34:43]), float(line[44:53])
            # arguments in the order D, l', l, F, zeta, then the eight planets
            n = [ip[8], 0, ip[9], ip[10], 0] + ip[:8] if f < 16 else [ip[7], ip[8], ip[9], ip[10], 0] + ip[:7] + [0]
            periodic.append((coordinate, power, amplitude, pha, n))


def size(coordinate, amplitude, power):
    """The term's largest effect in arc-seconds over 1800 to 2200 (time up to 2 centuries from J2000)."""
    return abs(amplitude) * (2 ** power) / (KM_PER_ARCSECOND if coordinate == 2 else 1)


kept_main = [t for t in main if size(t[0], t[1], 0) >= THRESHOLD]
kept = [t for t in periodic if size(t[0], t[2], t[1]) >= THRESHOLD]
print(f"threshold {THRESHOLD} arc-seconds: {len(kept_main)} of {len(main)} main-problem terms and {len(kept)} of {len(periodic)} others")


def number(x):
    text = f"{x:.5f}".rstrip("0").rstrip(".")
    return "0" if text in ("-0", "") else text


lines = [
    "// Made by scripts/make-lunar-data.py from the lunar solution ELP2000-82B (Chapront-Touze and Chapront, Astron. Astrophys. 124, 50 (1983) and 190, 342 (1988); IMCCE, Observatoire de Paris, https://ftp.imcce.fr/pub/ephem/moon/elp82b/); do not edit by hand.",
    f"// Terms of at least {THRESHOLD} arc-seconds over 1800 to 2200 ({len(kept_main)} of {len(main)} main-problem terms, {len(kept)} of {len(periodic)} others). Each is a sine; longitude and latitude in arc-seconds, distance in kilometres.",
    "/** The main problem: coordinate (0 longitude, 1 latitude, 2 distance), amplitude, then the multipliers of D, l', l and F. A distance term is a cosine, which the evaluator makes a sine a quarter turn on. */",
    "export const LUNAR_MAIN: readonly (readonly number[])[] = [",
]
for coordinate, amplitude, n in kept_main:
    lines.append("  [" + ",".join([str(coordinate), number(amplitude)] + [str(i) for i in n]) + "],")
lines += [
    "];",
    "/** The perturbations: coordinate, the power of time the amplitude is multiplied by, amplitude, phase in degrees, then the multipliers of D, l', l, F, zeta (the Moon's mean longitude with the precession) and the eight planets' mean longitudes (the Earth's is the third). */",
    "export const LUNAR_PERIODIC: readonly (readonly number[])[] = [",
]
for coordinate, power, amplitude, pha, n in kept:
    lines.append("  [" + ",".join([str(coordinate), str(power), number(amplitude), number(pha)] + [str(i) for i in n]) + "],")
lines.append("];")
open("src/data/lunar.ts", "w").write("\n".join(lines) + "\n")
print("wrote src/data/lunar.ts")
