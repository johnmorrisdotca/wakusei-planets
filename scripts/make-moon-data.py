#!/usr/bin/env python3
"""Writes src/data/orbits.ts from JPL's Planetary Satellite Mean Elements (https://ssd.jpl.nasa.gov/sats/elem/).
Usage: python3 -I scripts/make-moon-data.py [saved-page.html]   (fetches the page when none is given)
The sidereal periods and the radii are written here, from the IAU / JPL physical-parameter tables, and not read from the page."""
import html, json, re, sys, urllib.request

# id: (sidereal period in days, negative when retrograde; parent; row name on the page)
MOONS = {
    "moon": (27.321661, "earth", "Moon"),
    "phobos": (0.31891023, "mars", "Phobos"), "deimos": (1.2624407, "mars", "Deimos"),
    "io": (1.769137786, "jupiter", "Io"), "europa": (3.551181041, "jupiter", "Europa"),
    "ganymede": (7.15455296, "jupiter", "Ganymede"), "callisto": (16.6890184, "jupiter", "Callisto"),
    "mimas": (0.9424218, "saturn", "Mimas"), "enceladus": (1.370218, "saturn", "Enceladus"),
    "tethys": (1.887802, "saturn", "Tethys"), "dione": (2.736915, "saturn", "Dione"),
    "rhea": (4.5175, "saturn", "Rhea"), "titan": (15.945421, "saturn", "Titan"), "iapetus": (79.3215, "saturn", "Iapetus"),
    "miranda": (1.413479, "uranus", "Miranda"), "ariel": (2.520379, "uranus", "Ariel"), "umbriel": (4.144176, "uranus", "Umbriel"),
    "titania": (8.705867, "uranus", "Titania"), "oberon": (13.463234, "uranus", "Oberon"),
    "triton": (-5.876854, "neptune", "Triton"), "nereid": (360.1362, "neptune", "Nereid"), "proteus": (1.122315, "neptune", "Proteus"),
    "charon": (6.38723, "pluto", "Charon"), "nix": (24.8546, "pluto", "Nix"), "hydra": (38.20177, "pluto", "Hydra"),
}

src = sys.argv[1] if len(sys.argv) > 1 else None
page = open(src, encoding="utf8", errors="ignore").read() if src else urllib.request.urlopen("https://ssd.jpl.nasa.gov/sats/elem/", timeout=60).read().decode("utf8", "ignore")
rows = {}
for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", page, re.S):
    cells = [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", c))).strip() for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S)]
    if len(cells) >= 18 and cells[0].isdigit():
        rows[cells[2]] = cells

def num(text):
    try:
        return float(text)
    except ValueError:
        return 0.0

out = []
for key, (period, parent, name) in MOONS.items():
    c = rows[name]
    frame, epoch = c[5], c[6]
    a, e, w, m, i, node = (num(c[k]) for k in (7, 8, 9, 10, 11, 12))
    papsis, pnode = num(c[14]), num(c[15])
    ra, dec = num(c[16]), num(c[17])
    retro = period < 0
    listed = 360.0 / num(c[13])                      # deg per day, the page's P
    sid = 360.0 / abs(period) * (-1 if retro else 1)
    ap_mag = 360.0 / (papsis * 365.25) if papsis else 0.0
    diff = abs(sid) - listed                         # equals the periapsis rate when the page's P is the anomalistic period
    ap = diff if papsis and abs(abs(diff) - ap_mag) < 0.3 * ap_mag else ap_mag
    if e < 0.003:
        ap = 0.0                                          # a circle has no periapsis to turn
    node_rate = 0.0 if not pnode else (360.0 / (pnode * 365.25) * (1 if retro else -1))
    ep = {"2000-01-01.5": 946728000000, "2020-01-01.0": 1577836800000}[epoch]
    pole = None if frame == "ecliptic" else ([ra, dec] if frame == "Laplace" else "planet")
    out.append((key, parent, frame, ep, a, e, w, m, i, node, sid, ap, node_rate, pole, ra, dec))

lines = ["// Made by scripts/make-moon-data.py from JPL's Planetary Satellite Mean Elements (https://ssd.jpl.nasa.gov/sats/elem/); do not edit by hand.",
         "// `sid` is the mean motion in degrees a day (negative: retrograde); `dw` and `dn` are the precession rates of the periapsis and the node, degrees a day.",
         "export interface OrbitElements {", "  /** The planet it goes round. */", "  parent: string;",
         "  /** The reference plane: the ecliptic, the planet's equator, or the Laplace plane whose pole is `pole` (right ascension, declination, degrees). */",
         "  frame: \"ecliptic\" | \"equatorial\" | \"laplace\";", "  pole?: [number, number];",
         "  /** The epoch of the elements, in milliseconds since 1970. */", "  epoch: number;",
         "  /** Semi-major axis in km, eccentricity, argument of periapsis, mean anomaly, inclination and node, degrees. */",
         "  a: number; e: number; w: number; m: number; i: number; node: number;",
         "  sid: number; dw: number; dn: number;", "}", "",
         "export const ORBITS: Record<string, OrbitElements> = {"]
for key, parent, frame, ep, a, e, w, m, i, node, sid, ap, nr, pole, ra, dec in out:
    f = {"ecliptic": "ecliptic", "equatorial": "equatorial", "Laplace": "laplace"}[frame]
    p = f", pole: [{ra}, {dec}]" if f == "laplace" else ""
    lines.append(f'  {key}: {{ parent: "{parent}", frame: "{f}"{p}, epoch: {ep}, a: {a:g}, e: {e:g}, w: {w:g}, m: {m:g}, i: {i:g}, node: {node:g}, sid: {sid:.7f}, dw: {ap:.5f}, dn: {nr:.5f} }},')
lines.append("};")
open("src/data/orbits.ts", "w").write("\n".join(lines) + "\n")
print("wrote src/data/orbits.ts,", len(out), "orbits")
