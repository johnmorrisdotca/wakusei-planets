#!/usr/bin/env python3
"""Writes src/data/moon-osculating.ts and test/data/moon-osculating-horizons.json: for each irregular moon of /moon-catalogue, its osculating orbit (the two-body orbit that fits its place and speed at one moment) at one epoch, taken from JPL Horizons.

Why (MODULES-1091): a mean orbit cannot follow the Sun's pull on an irregular moon, so with JPL's mean elements the irregular moons are 10 to 150 degrees off within a year and a half. An osculating orbit taken from Horizons on one day follows
the moon to within about a degree for 120 days either side and within a few for 150 (measured here on held-out dates, printed below). `catalogueMoonPosition` uses it inside `MOON_OSCULATING_DAYS` of `MOON_OSCULATING_EPOCH_JD`, and the mean orbit
outside it. Refreshing is a run of this script with a new --epoch.

Source: JPL Horizons (https://ssd.jpl.nasa.gov/api/horizons.api; NASA/JPL content is not subject to copyright in the United States), VECTORS, the planet's centre, ecliptic and equinox J2000, km and km/s, TDB. One request a moon with the
epoch and the held-out dates together; one at a time, a pause between them, results cached in the folder given with --cache (outside the repository), and a stop on an error rather than a retry.

Usage: python3 -I scripts/make-moon-osculating.py --cache DIR [--epoch JD]      (needs the network the first time; DIR is outside the repository)"""
import json, math, os, re, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HORIZONS = "https://ssd.jpl.nasa.gov/api/horizons.api"
UA = "wakusei-moon-osculating/1.0"
PAUSE = 1.5
EPOCH = 2461375.5  # 2026-12-01 00:00 TDB
# days either side of the epoch at which the position is measured against Horizons (held out: only the epoch itself sets the orbit)
CHECKS = [-210, -180, -150, -120, -90, -60, -30, -15, 15, 30, 60, 90, 120, 150, 180, 210]
CENTRE = {"jupiter": 599, "saturn": 699, "uranus": 799, "neptune": 899}
# the planets' GM, km^3/s^2 (JPL's planetary satellite physical parameters page: the GM of the planet's system)
GM = {"jupiter": 126686534.9, "saturn": 37931207.8, "uranus": 5793951.3, "neptune": 6835099.5}
REGULAR = {"regular", "inner", "major", "none"}
# a sample of moons whose held-out positions go into test/data/moon-osculating-horizons.json: the first, the middle and the last of every group
FIXTURE_DATES = [-120, -60, -30, 30, 60, 120]


def rows():
    out = []
    for line in open(os.path.join(ROOT, "src", "data", "moon-catalogue.ts")):
        line = line.strip()
        if line.startswith('["'):
            r = json.loads(line.rstrip(","))
            if r[9] is not None and r[18] not in REGULAR and r[4] in CENTRE:
                out.append(r)
    return out


def fetch(cache, id_, code, host, epoch):
    path = os.path.join(cache, f"{id_}-{epoch}.json")
    if os.path.exists(path):
        return json.load(open(path))
    dates = [epoch] + [epoch + d for d in CHECKS]
    params = {"format": "json", "COMMAND": f"'{code}'", "OBJ_DATA": "'NO'", "MAKE_EPHEM": "'YES'", "EPHEM_TYPE": "'VECTORS'", "CENTER": f"'500@{CENTRE[host]}'", "REF_PLANE": "'ECLIPTIC'", "REF_SYSTEM": "'ICRF'",
              "OUT_UNITS": "'KM-S'", "VEC_TABLE": "'2'", "VEC_CORR": "'NONE'", "CSV_FORMAT": "'YES'", "TIME_TYPE": "'TDB'", "TLIST_TYPE": "'JD'", "TLIST": " ".join(f"'{d}'" for d in dates)}
    text = urllib.request.urlopen(urllib.request.Request(HORIZONS + "?" + urllib.parse.urlencode(params), headers={"User-Agent": UA}), timeout=300).read().decode()
    result = json.loads(text).get("result", "")
    m = re.search(r"\$\$SOE(.*?)\$\$EOE", result, re.S)
    if not m:
        raise SystemExit(f"{id_} ({code}): Horizons gave no table: {result[:300]}")
    table = []
    for line in m.group(1).strip().split("\n"):
        c = [x.strip() for x in line.split(",")]
        table.append([float(c[0])] + [float(x) for x in c[2:8]])
    json.dump(table, open(path, "w"))
    time.sleep(PAUSE)
    return table


def norm(v):
    return math.sqrt(sum(x * x for x in v))


def cross(a, b):
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]


def elements(state, gm):
    """The osculating elements of a state (km, km/s): a (km), e, i, node, argument of periapsis, mean anomaly (degrees), in the frame of the state."""
    r, v = state[:3], state[3:]
    rn, v2 = norm(r), sum(x * x for x in v)
    a = 1 / (2 / rn - v2 / gm)
    h = cross(r, v)
    hn = norm(h)
    ev = [c / gm - x / rn for c, x in zip(cross(v, h), r)]
    e = norm(ev)
    i = math.acos(h[2] / hn)
    node = math.atan2(h[0], -h[1]) % (2 * math.pi)
    nodev = [math.cos(node), math.sin(node), 0.0]
    w = math.acos(max(-1, min(1, sum(x * y for x, y in zip(nodev, ev)) / e)))
    if ev[2] < 0:
        w = 2 * math.pi - w
    rdotv = sum(x * y for x, y in zip(r, v))
    big_e = math.atan2(rdotv / math.sqrt(gm * a), 1 - rn / a)
    m = (big_e - e * math.sin(big_e)) % (2 * math.pi)
    return a, e, math.degrees(i), math.degrees(node), math.degrees(w), math.degrees(m)


def position(el, gm, dt_days):
    """The same two-body step `catalogueMoonPosition` takes from the rounded elements, so what is measured here is what the package does."""
    a, e, i, node, w, m = el
    n = math.sqrt(gm / a ** 3)
    mm = math.radians(m) + n * dt_days * 86400
    big_e = mm
    for _ in range(60):
        big_e -= (big_e - e * math.sin(big_e) - mm) / (1 - e * math.cos(big_e))
    x, y = a * (math.cos(big_e) - e), a * math.sqrt(1 - e * e) * math.sin(big_e)
    cw, sw, cn, sn, ci, si = math.cos(math.radians(w)), math.sin(math.radians(w)), math.cos(math.radians(node)), math.sin(math.radians(node)), math.cos(math.radians(i)), math.sin(math.radians(i))
    return [(cw * cn - sw * sn * ci) * x + (-sw * cn - cw * sn * ci) * y, (cw * sn + sw * cn * ci) * x + (-sw * sn + cw * cn * ci) * y, sw * si * x + cw * si * y]


def angle(p, q):
    d = sum(x * y for x, y in zip(p, q)) / (norm(p) * norm(q))
    return math.degrees(math.acos(max(-1, min(1, d))))


def main():
    args = sys.argv[1:]
    if "--cache" not in args:
        raise SystemExit("usage: make-moon-osculating.py --cache DIR [--epoch JD]")
    cache = os.path.expanduser(args[args.index("--cache") + 1])
    epoch = float(args[args.index("--epoch") + 1]) if "--epoch" in args else EPOCH
    os.makedirs(cache, exist_ok=True)
    out, errors, held = [], {}, {}
    by_group = {}
    for r in rows():
        by_group.setdefault((r[4], r[18]), []).append(r[0])
    sample = set()
    for ids in by_group.values():
        sample |= {ids[0], ids[len(ids) // 2], ids[-1]}
    order = []
    for r in rows():
        order.append(r[0])
        id_, code, host = r[0], r[5], r[4]
        table = fetch(cache, id_, code, host, epoch)
        state = [t for t in table if abs(t[0] - epoch) < 1e-6][0][1:7]
        a, e, i, node, w, m = elements(state, GM[host])
        # kept as whole numbers, to the precision that costs the position nothing measurable: a in units of 100 km, e to 1e-4, the angles to 0.01 degree (the moon is 10 to 50 million km away: 0.01 degree is under 90 km)
        packed = [round(a / 100), round(e * 1e4), round(i * 100), round(node * 100) % 36000, round(w * 100) % 36000, round(m * 100) % 36000]
        out.append(packed)
        el = (packed[0] * 100.0, packed[1] / 1e4, packed[2] / 100, packed[3] / 100, packed[4] / 100, packed[5] / 100)
        rec = {}
        for t in table:
            dt = t[0] - epoch
            if abs(dt) < 1e-6:
                continue
            ours = position(el, GM[host], dt)
            rec[int(round(dt))] = angle(ours, t[1:4])
            if id_ in sample and int(round(dt)) in FIXTURE_DATES:
                held.setdefault(id_, {"host": host, "dates": {}})["dates"][str(int(round(dt)))] = [round(x, 1) for x in t[1:4]]
        errors[id_] = (host, r[18], rec)
    # the elements, the held-out positions and the error table
    lines = ["// Made by scripts/make-moon-osculating.py from JPL Horizons (NASA/JPL-Caltech; see NOTICE.md): the osculating orbit of each irregular moon of /moon-catalogue on one day; do not edit by hand. Read again with a new --epoch.",
             f"export const MOON_OSCULATING_EPOCH_JD = {epoch};", "",
             "/**",
             " * Six whole numbers for each irregular moon of a giant planet that has a mean orbit, in the order of the rows of data/moon-catalogue.ts: a in units of 100 km, e in units of 0.0001, then i, the node, the argument of periapsis",
             " * and the mean anomaly in units of 0.01 degree, in the J2000 ecliptic frame, at the epoch (JD, TDB).",
             " */",
             "export const MOON_OSCULATING: readonly number[] = ["]
    lines += ["  " + ",".join(str(x) for x in row) + "," for row in out]
    lines += ["];", ""]
    open(os.path.join(ROOT, "src", "data", "moon-osculating.ts"), "w").write("\n".join(lines))
    json.dump({"epochJd": epoch, "source": "JPL Horizons VECTORS, planet-centred, ecliptic J2000, km, TDB", "moons": held}, open(os.path.join(ROOT, "test", "data", "moon-osculating-horizons.json"), "w"), separators=(",", ":"))
    print(f"{len(out)} moons, epoch JD {epoch}; held-out angular error (degrees) of the two-body step from the rounded elements, by days from the epoch:")
    for window in (30, 60, 90, 120, 150, 180, 210):
        vals = sorted(v for host, g, rec in errors.values() for d, v in rec.items() if abs(d) <= window)
        worst = {h: max([v for hh, g, rec in errors.values() if hh == h for d, v in rec.items() if abs(d) <= window] or [0]) for h in CENTRE}
        print(f"  within {window:3d} days: median {vals[len(vals) // 2]:.2f}, 95th {vals[int(len(vals) * 0.95)]:.2f}, worst {vals[-1]:.2f}; worst by planet " + ", ".join(f"{h} {x:.1f}" for h, x in worst.items()))


if __name__ == "__main__":
    main()
