#!/usr/bin/env python3
"""Writes src/data/orbits.ts.
The Moon's row is JPL's Planetary Satellite Mean Elements (https://ssd.jpl.nasa.gov/sats/elem/). Every other moon's orbit is fitted to JPL Horizons' own
positions and velocities (https://ssd.jpl.nasa.gov/api/horizons.api, ICRF equator, UT) for 1950 to 2050: osculating elements in the moon's mean orbit plane, then
a straight line through the mean longitude, the longitude of the periapsis and the node, and, where a line leaves more than 0.3 degrees, an acceleration (Phobos)
or one wave (Mimas and Tethys, in resonance). The page's own phase angles do not reproduce Horizons' positions for most of the Saturn, Uranus and Neptune moons.
Usage: python3 -I scripts/make-moon-data.py [saved-page.html]   (fetches the page when none is given; needs the network for Horizons either way)
The sidereal periods are written here, from the IAU / JPL physical-parameter tables, and only used to count whole turns between samples."""
import html, json, math, re, sys, time, urllib.parse, urllib.request

D = math.pi / 180
# id: (sidereal period in days; parent; row name on the page; Horizons code; Horizons centre; GM of that centre in km^3/s^2)
MOONS = {
    "moon": (27.321661, "earth", "Moon", None, None, None),
    "phobos": (0.31891023, "mars", "Phobos", "401", "499", 42828.375), "deimos": (1.2624407, "mars", "Deimos", "402", "499", 42828.375),
    "io": (1.769137786, "jupiter", "Io", "501", "599", 126686534.0), "europa": (3.551181041, "jupiter", "Europa", "502", "599", 126686534.0),
    "ganymede": (7.15455296, "jupiter", "Ganymede", "503", "599", 126686534.0), "callisto": (16.6890184, "jupiter", "Callisto", "504", "599", 126686534.0),
    "mimas": (0.9424218, "saturn", "Mimas", "601", "699", 37931207.7), "enceladus": (1.370218, "saturn", "Enceladus", "602", "699", 37931207.7),
    "tethys": (1.887802, "saturn", "Tethys", "603", "699", 37931207.7), "dione": (2.736915, "saturn", "Dione", "604", "699", 37931207.7),
    "rhea": (4.5175, "saturn", "Rhea", "605", "699", 37931207.7), "titan": (15.945421, "saturn", "Titan", "606", "699", 37931207.7),
    "iapetus": (79.3215, "saturn", "Iapetus", "608", "699", 37931207.7),
    "miranda": (1.413479, "uranus", "Miranda", "705", "799", 5793951.3), "ariel": (2.520379, "uranus", "Ariel", "701", "799", 5793951.3),
    "umbriel": (4.144176, "uranus", "Umbriel", "702", "799", 5793951.3), "titania": (8.705867, "uranus", "Titania", "703", "799", 5793951.3),
    "oberon": (13.463234, "uranus", "Oberon", "704", "799", 5793951.3),
    "triton": (5.876854, "neptune", "Triton", "801", "899", 6835099.5), "nereid": (360.1362, "neptune", "Nereid", "802", "899", 6835099.5),
    "proteus": (1.122315, "neptune", "Proteus", "808", "899", 6835099.5),
    "charon": (6.38723, "pluto", "Charon", "901", "999", 975.5), "nix": (24.8546, "pluto", "Nix", "902", "9", 975.5), "hydra": (38.20177, "pluto", "Hydra", "903", "9", 975.5),
}
# the IAU poles (right ascension, declination, degrees) of the planets whose moons the page gives in the planet's equator
PLANET_POLE = {"uranus": (257.311, -15.175), "neptune": (299.36, 43.46), "pluto": (132.993, -6.163)}
EPOCH_MS = 946728000000  # 2000-01-01 12:00 UT
START, STOP, STEP_HOURS = "1950-01-02", "2049-12-30", 273  # about 11.4 days: not a multiple of any moon's period

dot = lambda a, b: a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
cross = lambda a, b: [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
norm = lambda a: math.sqrt(dot(a, a))
unit = lambda a: [x / norm(a) for x in a]
wrap = lambda x: x % 360.0


def num(text):
    try:
        return float(text)
    except ValueError:
        return 0.0


def horizons(code, centre):
    query = urllib.parse.urlencode({
        "format": "json", "COMMAND": f"'{code}'", "OBJ_DATA": "'NO'", "MAKE_EPHEM": "'YES'", "EPHEM_TYPE": "'VECTORS'", "CENTER": f"'500@{centre}'",
        "REF_PLANE": "'FRAME'", "REF_SYSTEM": "'ICRF'", "OUT_UNITS": "'KM-S'", "VEC_TABLE": "'2'", "CSV_FORMAT": "'YES'", "TIME_TYPE": "'UT'",
        "START_TIME": f"'{START}'", "STOP_TIME": f"'{STOP}'", "STEP_SIZE": f"'{STEP_HOURS} h'"})
    for _ in range(4):
        text = json.load(urllib.request.urlopen(f"https://ssd.jpl.nasa.gov/api/horizons.api?{query}", timeout=120)).get("result", "")
        if "$$SOE" in text:
            rows = []
            for line in text.split("$$SOE")[1].split("$$EOE")[0].strip().split("\n"):
                p = line.split(",")
                rows.append((float(p[0]) - 2451545.0, [float(x) for x in p[2:5]], [float(x) for x in p[5:8]]))
            return rows
        time.sleep(4)
    sys.exit(f"Horizons gave nothing for {code}@{centre}: {text[:200]}")


def unwrap(series):
    out, prev, shift = [], None, 0.0
    for v in series:
        if prev is not None:
            d = v - prev
            shift += -360.0 if d > 180 else 360.0 if d < -180 else 0.0
        out.append(v + shift)
        prev = v
    return out


def least_squares(cols, y):
    k = len(cols)
    m = [[sum(p * q for p, q in zip(cols[i], cols[j])) for j in range(k)] + [sum(p * q for p, q in zip(cols[i], y))] for i in range(k)]
    for c in range(k):
        pivot = max(range(c, k), key=lambda r: abs(m[r][c]))
        m[c], m[pivot] = m[pivot], m[c]
        for r in range(k):
            if r != c:
                f = m[r][c] / m[c][c]
                m[r] = [x - f * z for x, z in zip(m[r], m[c])]
    return [m[i][k] / m[i][i] for i in range(k)]


def rms(values):
    return math.sqrt(sum(v * v for v in values) / len(values))


def straight(ts, y):
    c = least_squares([[1.0] * len(ts), ts], y)
    return c[0], c[1]


def mean_longitude_model(ts, y):
    """The mean longitude against time (days from J2000): a line, or a line with an acceleration, or a line with one wave, whichever leaves least when it helps a lot."""
    one = [1.0] * len(ts)
    c = least_squares([one, ts], y)
    best = (rms([v - c[0] - c[1] * t for v, t in zip(y, ts)]), c[0], c[1], 0.0, None)
    if best[0] < 0.3:
        return best
    c = least_squares([one, ts, [t * t for t in ts]], y)
    left = rms([v - c[0] - c[1] * t - c[2] * t * t for v, t in zip(y, ts)])
    if left < best[0] / 3:
        best = (left, c[0], c[1], 2 * c[2], None)
    period = 1000.0
    while period < 60000.0:
        w = 2 * math.pi / period
        c = least_squares([one, ts, [math.sin(w * t) for t in ts], [math.cos(w * t) for t in ts]], y)
        left = rms([v - c[0] - c[1] * t - c[2] * math.sin(w * t) - c[3] * math.cos(w * t) for v, t in zip(y, ts)])
        if left < best[0] / 3:
            best = (left, c[0], c[1], 0.0, (math.hypot(c[2], c[3]), period, math.atan2(c[3], c[2]) / D))
        period *= 1.01
    return best


def fit(pole, period, code, centre, mu):
    rows = horizons(code, centre)
    spins = [cross(r, v) for _, r, v in rows]
    if pole is None:
        z = unit([sum(h[k] / norm(h) for h in spins) for k in range(3)])
        pole = (math.atan2(z[1], z[0]) / D % 360, math.asin(z[2]) / D)
    z = [math.cos(pole[1] * D) * math.cos(pole[0] * D), math.cos(pole[1] * D) * math.sin(pole[0] * D), math.sin(pole[1] * D)]
    if sum(dot(z, h) / norm(h) for h in spins) < 0:  # it goes round clockwise about that pole: use the opposite one, so it goes round anticlockwise
        z = [-c for c in z]
        pole = ((pole[0] + 180) % 360, -pole[1])
    x = unit([-z[1], z[0], 0.0])  # the node of its plane on the ICRF equator
    y = cross(z, x)
    ts, nodes, peris, lons, axes, ecc, tilts = [], [], [], [], [], [], []
    for t, r, v in rows:
        r2, v2 = [dot(r, x), dot(r, y), dot(r, z)], [dot(v, x), dot(v, y), dot(v, z)]
        h = cross(r2, v2)
        hn = [c / norm(h) for c in h]
        node = math.atan2(h[0], -h[1])
        ev = [c / mu for c in cross(v2, h)]
        ev = [ev[k] - r2[k] / norm(r2) for k in range(3)]
        e = norm(ev)
        nvec = [math.cos(node), math.sin(node), 0.0]
        w = math.atan2(dot(cross(nvec, ev), hn), dot(nvec, ev))
        nu = math.atan2(dot(cross(ev, r2), hn), dot(ev, r2))
        E = 2 * math.atan2(math.sqrt(1 - e) * math.sin(nu / 2), math.sqrt(1 + e) * math.cos(nu / 2))
        ts.append(t)
        nodes.append(wrap(node / D))
        peris.append(wrap((node + w) / D))
        lons.append(wrap((node + w + E - e * math.sin(E)) / D))
        axes.append(1 / (2 / norm(r2) - dot(v2, v2) / mu))
        ecc.append(e)
        tilts.append(math.acos(max(-1, min(1, h[2] / norm(h)))) / D)
    node0, node_rate = straight(ts, unwrap(nodes))
    peri0, peri_rate = straight(ts, unwrap(peris))
    known = 360.0 / period
    left, lon0, extra, acc, wave = mean_longitude_model(ts, unwrap([((v - known * t + 180) % 360) - 180 for v, t in zip(lons, ts)]))
    return {"pole": pole, "a": sum(axes) / len(axes), "e": sum(ecc) / len(ecc), "i": sum(tilts) / len(tilts), "node": wrap(node0), "dn": node_rate,
            "w": wrap(peri0 - node0), "dw": peri_rate - node_rate, "m": wrap(lon0 - peri0), "sid": known + extra, "acc": acc, "wave": wave, "scatter": left}


src = sys.argv[1] if len(sys.argv) > 1 else None
page = open(src, encoding="utf8", errors="ignore").read() if src else urllib.request.urlopen("https://ssd.jpl.nasa.gov/sats/elem/", timeout=60).read().decode("utf8", "ignore")
rows = {}
for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", page, re.S):
    cells = [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", c))).strip() for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S)]
    if len(cells) >= 18 and cells[0].isdigit():
        rows[cells[2]] = cells

lines = ["// Made by scripts/make-moon-data.py: the Moon from JPL's Planetary Satellite Mean Elements (https://ssd.jpl.nasa.gov/sats/elem/), every other moon fitted to JPL Horizons' positions for 1950 to 2050; do not edit by hand.",
         "// The moons of the dwarf planets other than Pluto's are not in either: their orbits are in dwarf.ts, from the papers it cites, and are added at the end.",
         "import { DWARF_MOON_ORBITS } from \"./dwarf.ts\";", "",
         "// `sid` is the mean longitude's rate in degrees a day; `dw` and `dn` are the precession rates of the periapsis and the node, degrees a day.",
         "export interface OrbitElements {", "  /** The planet it goes round. */", "  parent: string;",
         "  /** The reference plane: the ecliptic, the Earth's equator of J2000, the planet's equator, or the plane whose pole is `pole` (right ascension, declination, degrees). */",
         "  frame: \"ecliptic\" | \"j2000\" | \"equatorial\" | \"laplace\";", "  pole?: [number, number];",
         "  /** The epoch of the elements, in milliseconds since 1970. */", "  epoch: number;",
         "  /** Semi-major axis in km, eccentricity, argument of periapsis, mean anomaly, inclination and node, degrees. */",
         "  a: number; e: number; w: number; m: number; i: number; node: number;",
         "  sid: number; dw: number; dn: number;",
         "  /** The mean longitude's acceleration, degrees a day squared (Phobos, whose orbit is shrinking). */", "  acc?: number;",
         "  /** A swing in the mean longitude: its amplitude in degrees, its period in days and its phase in degrees (Mimas and Tethys, in resonance). */", "  wave?: [number, number, number];",
         "}", "",
         "export const ORBITS: Record<string, OrbitElements> = {"]
for key, (period, parent, name, code, centre, mu) in MOONS.items():
    c = rows[name]
    if code is None:
        a, e, w, m, i, node = (num(c[k]) for k in (7, 8, 9, 10, 11, 12))
        papsis, pnode = num(c[14]), num(c[15])
        listed = 360.0 / num(c[13])
        sid = 360.0 / period
        ap_mag = 360.0 / (papsis * 365.25) if papsis else 0.0
        diff = sid - listed
        ap = diff if papsis and abs(abs(diff) - ap_mag) < 0.3 * ap_mag else ap_mag
        node_rate = 0.0 if not pnode else -360.0 / (pnode * 365.25)
        lines.append(f'  {key}: {{ parent: "{parent}", frame: "ecliptic", epoch: {EPOCH_MS}, a: {a:g}, e: {e:g}, w: {w:g}, m: {m:g}, i: {i:g}, node: {node:g}, sid: {sid:.7f}, dw: {ap:.5f}, dn: {node_rate:.5f} }},')
        continue
    pole = PLANET_POLE.get(parent) if c[5] == "equatorial" else (num(c[16]), num(c[17])) if c[5] == "Laplace" else None
    f = fit(pole, period, code, centre, mu)
    extra = (f", acc: {f['acc']:.4e}" if f["acc"] else "") + (f", wave: [{f['wave'][0]:.3f}, {f['wave'][1]:.1f}, {f['wave'][2]:.2f}]" if f["wave"] else "")
    lines.append(f'  {key}: {{ parent: "{parent}", frame: "laplace", pole: [{f["pole"][0]:.4f}, {f["pole"][1]:.4f}], epoch: {EPOCH_MS}, a: {f["a"]:.0f}, e: {f["e"]:.6f}, w: {f["w"]:.4f}, m: {f["m"]:.4f}, i: {f["i"]:.4f}, node: {f["node"]:.4f}, sid: {f["sid"]:.7f}, dw: {f["dw"]:.6f}, dn: {f["dn"]:.6f}{extra} }},')
    print(f"{key:10s} scatter {f['scatter']:.3f} deg", flush=True)
    time.sleep(0.8)
lines.append("  ...DWARF_MOON_ORBITS,")
lines.append("};")
open("src/data/orbits.ts", "w").write("\n".join(lines) + "\n")
print("wrote src/data/orbits.ts,", len(MOONS), "orbits")
