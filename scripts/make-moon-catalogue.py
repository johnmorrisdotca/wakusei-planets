#!/usr/bin/env python3
"""Writes src/data/moon-catalogue.ts and test/data/moon-catalogue-horizons.json: every known moon of the planets and the dwarf planets, as a light list (names, discovery, mean orbit, size where known).

Sources, all of the JPL Solar System Dynamics group (NASA/JPL-Caltech; US government work, not subject to copyright in the United States):
- "Planetary Satellite Mean Elements" (https://ssd.jpl.nasa.gov/sats/elem/): each moon's mean orbit, its frame and epoch, and the ephemeris it was taken from.
- "Planetary Satellite Discovery Circumstances" (https://ssd.jpl.nasa.gov/sats/discovery.html): the IAU number and name, the provisional designation, the year, the discoverers and the announcement.
- "Planetary Satellite Physical Parameters" (https://ssd.jpl.nasa.gov/sats/phys_par/): the measured mean radius, with its uncertainty, of the moons it lists.
- The Small-Body Satellites API (https://ssd-api.jpl.nasa.gov/sb_sat.api): the moons of the dwarf planets besides Pluto (their names, years and announcements).
- JPL Horizons (https://ssd.jpl.nasa.gov/api/horizons.api): each moon's own data sheet (a radius, an albedo or a V(1,0) magnitude where the sheet gives one) and its position from its planet's centre (geometric,
  ecliptic and equinox J2000, km, TDB) on the days its place and rate are set from (2026-01-01, 01-02, 02-01, 04-01) and the days it is measured on (2025-07-02, 2026-07-02, 2027-07-02; 1990, 2000 and 2040).
  Three requests a moon.

Fair use (the Solar System Dynamics API terms, https://ssd-api.jpl.nasa.gov/, read 2026-11-11; neither site has a robots.txt): one request at a time with a pause, results cached in the folder given with --cache
(never in the repository), stop on an error rather than retry.

Kept current: run it again with --refresh. The three pages and the dwarf planets' moons are asked again (a moon's Horizons answer stays cached, so only a new moon costs a request), and before writing it prints
what changed against the table in the repository: moons added or gone, a designation that got a name, a changed orbit, size or discovery. --dry prints the changes and writes nothing.

Usage: python3 -I scripts/make-moon-catalogue.py --cache DIR [--refresh] [--dry]   (needs the network the first time; DIR is outside the repository)
       --fetch-only asks for what is not cached and stops; --explore FILE writes the moons as JSON to FILE and stops (to look at them)."""
import difflib, hashlib, html, json, math, os, re, sys, time, urllib.error, urllib.parse, urllib.request

UA = "moon-catalogue-build/1.0"
PAUSE = 1.5
ELEM = "https://ssd.jpl.nasa.gov/sats/elem/"
DISC = "https://ssd.jpl.nasa.gov/sats/discovery.html"
PHYS = "https://ssd.jpl.nasa.gov/sats/phys_par/"
SBSAT = "https://ssd-api.jpl.nasa.gov/sb_sat.api"
HORIZONS = "https://ssd.jpl.nasa.gov/api/horizons.api"
# 1990-01-01, 2000-01-01 12:00, 2026-01-01 and 2040-01-01, TDB: the far dates, and the day each moon's phase is set from (PHASE)
DATES = [2447892.5, 2451545.0, 2461041.5, 2466155.5]
PHASE = 2461041.5
# 2026-01-02, 2026-02-01 and 2026-04-01, TDB: the days after PHASE the rate along the orbit is set from (each step pins the turns the next one makes)
FIT = [2461042.5, 2461072.5, 2461131.5]
# 2025-07-02, 2026-07-02 and 2027-07-02, TDB: the dates near the phase day the position is measured at (not used to set it)
NEAR = [2460858.5, 2461223.5, 2461588.5]
CENTRE = {"Earth": 399, "Mars": 499, "Jupiter": 599, "Saturn": 699, "Uranus": 799, "Neptune": 899, "Pluto": 999}
# the dwarf planets besides Pluto, by their number in the Small-Body Database
DWARFS = {"ceres": "1", "orcus": "90482", "haumea": "136108", "quaoar": "50000", "makemake": "136472", "gonggong": "225088", "eris": "136199", "sedna": "90377"}
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Service:
    def __init__(self, cache, refresh):
        self.cache, self.refresh, self.last, self.count = cache, refresh, 0.0, 0
        os.makedirs(cache, exist_ok=True)

    def path(self, url, params=None):
        full = url + ("?" + urllib.parse.urlencode(params) if params else "")
        return full, os.path.join(self.cache, hashlib.md5(full.encode()).hexdigest() + ".txt")

    def get(self, url, params=None, fresh=False):
        full, key = self.path(url, params)
        if os.path.exists(key) and not (fresh and self.refresh):
            return open(key).read()
        wait = PAUSE - (time.time() - self.last)
        if wait > 0:
            time.sleep(wait)
        try:
            text = urllib.request.urlopen(urllib.request.Request(full, headers={"User-Agent": UA}), timeout=300).read().decode()
        except urllib.error.HTTPError as error:
            raise SystemExit(f"{url} refused: HTTP {error.code} {error.read()[:300]!r}; stopping, not retrying")
        self.last = time.time()
        self.count += 1
        open(os.path.join(self.cache, "requests.log"), "a").write(f"{time.strftime('%F %T')} {full[:160]}\n")
        open(key, "w").write(text)
        return text


def cells(row):
    return [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", c))).strip() for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]


def table(page, start):
    t = page[page.index(start):]
    return t[: t.index("</table>")]


def number(text):
    text = (text or "").strip().rstrip(".") if text not in ("-", "n/a") else ""
    return float(text) if re.fullmatch(r"[+-]?\d+(\.\d*)?", text or "") else None


def key(text):
    return re.sub(r"[^a-z0-9]", "", text.lower())


def horizons(svc, code, centre, dates, sheet=True):
    params = {"format": "json", "COMMAND": f"'{code}'", "OBJ_DATA": "'YES'" if sheet else "'NO'", "MAKE_EPHEM": "'YES'", "EPHEM_TYPE": "'VECTORS'", "CENTER": f"'500@{centre}'", "REF_PLANE": "'ECLIPTIC'",
              "REF_SYSTEM": "'ICRF'", "OUT_UNITS": "'KM-S'", "VEC_TABLE": "'1'", "VEC_CORR": "'NONE'", "CSV_FORMAT": "'YES'", "TIME_TYPE": "'TDB'", "TLIST_TYPE": "'JD'",
              "TLIST": " ".join(f"'{d}'" for d in dates)}
    return json.loads(svc.get(HORIZONS, params)).get("result", "")


def vectors(text):
    if "$$SOE" not in text:
        return None
    out = {}
    for line in text.split("$$SOE")[1].split("$$EOE")[0].strip().splitlines():
        p = [v.strip() for v in line.split(",")]
        out[float(p[0])] = [float(p[2]), float(p[3]), float(p[4])]
    return out


def fetch(svc):
    """Every answer the table is made from: the three pages, the dwarf planets' moons and one Horizons answer a moon."""
    elem = svc.get(ELEM, fresh=True)
    disc = svc.get(DISC, fresh=True)
    phys = svc.get(PHYS, fresh=True)
    sb = {host: json.loads(svc.get(SBSAT, {"des": des, "orb": "1", "phys-par": "1"}, fresh=True)) for host, des in DWARFS.items()}
    rows = [cells(r) for r in re.findall(r"<tr[^>]*>(.*?)</tr>", table(elem, 'id="sat_elem"'), re.S)]
    rows = [r for r in rows if len(r) >= 19]
    answers, near, fit = {}, {}, {}
    for r in rows:
        code, planet = r[3], r[1]
        if code in answers:
            continue
        near[code] = vectors(horizons(svc, code, CENTRE[planet], NEAR, sheet=False)) or {}
        fit[code] = vectors(horizons(svc, code, CENTRE[planet], FIT, sheet=False)) or {}
        text = horizons(svc, code, CENTRE[planet], DATES)
        if vectors(text) is None:
            # a date outside the moon's ephemeris spoils the whole list: ask the dates one at a time and keep those it covers
            parts = [horizons(svc, code, CENTRE[planet], [d]) for d in DATES]
            text = parts[0].split("$$SOE")[0] if "$$SOE" not in parts[0] else parts[0]
            got = {}
            for p in parts:
                got.update(vectors(p) or {})
            answers[code] = (text, got)
        else:
            answers[code] = (text, vectors(text))
    return elem, disc, phys, sb, rows, answers, near, fit


def main():
    args = sys.argv[1:]
    if "--cache" not in args:
        raise SystemExit("usage: make-moon-catalogue.py --cache DIR [--refresh] [--dry]")
    svc = Service(os.path.expanduser(args[args.index("--cache") + 1]), "--refresh" in args)
    elem, disc, phys, sb, rows, answers, near, fit = fetch(svc)
    global FETCHED
    FETCHED = time.strftime("%Y-%m-%d", time.gmtime(os.path.getmtime(svc.path(ELEM)[1])))
    print(f"{len(rows)} element rows, {len(answers)} Horizons answers, {svc.count} requests made")
    if "--fetch-only" in args:
        return
    moons, notes = build(elem, disc, phys, sb, rows, answers, near, fit)
    for n in notes:
        print("note:", n)
    if "--explore" in args:
        json.dump(moons, open(args[args.index("--explore") + 1], "w"), ensure_ascii=False, indent=0)
        return
    target = os.path.join(ROOT, "src", "data", "moon-catalogue.ts")
    changes = compare(read_rows(target), [row(m) for m in moons]) if os.path.exists(target) else ["no table yet: every moon is new"]
    print("\n".join(changes) if changes else "no change against the table in the repository")
    counts = {}
    for m in moons:
        counts[m["host"]] = counts.get(m["host"], 0) + 1
    print(f"{len(moons)} moons: " + ", ".join(f"{h} {n}" for h, n in counts.items()))
    if "--dry" in args:
        return
    write(target, moons)
    fixture = {"fetched": FETCHED, "near": NEAR, "far": [d for d in DATES if d != PHASE], "moons": {m["id"]: m["fixture"] for m in moons if m["fixture"]}}
    json.dump(fixture, open(os.path.join(ROOT, "test", "data", "moon-catalogue-horizons.json"), "w"), separators=(",", ":"))
    print("wrote", target, "and test/data/moon-catalogue-horizons.json")


ROMAN = re.compile(r"^[IVXLC]+$")
HOSTS = ["earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", *DWARFS]
FRAMES = ["ecliptic", "equatorial", "laplace"]
OBLIQUITY = 23.4392911
RAD = math.pi / 180
UNIX_JD = 2440587.5


def facts():
    """The package's own facts the table leans on: each host's pole (for the frame of a planet's equator) and the English and Japanese names of the moons the package draws in full."""
    text = open(os.path.join(ROOT, "src", "facts.ts")).read()
    poles, names, sizes = {}, {}, {}
    for m in re.finditer(r'f\("([a-z0-9]+)", "([a-z-]+)", "([^"]+)", "([^"]+)", ([-\d.]+), ([-\d.]+), ([-\d.]+), ([-\d.]+), ([-\d.]+)', text):
        ident, kind, en, ja = m.group(1), m.group(2), m.group(3), m.group(4)
        poles[ident] = (float(m.group(8)), float(m.group(9)))
        sizes[ident] = float(m.group(5))
        if kind == "moon":
            names[ident] = (en, ja)
    full = re.search(r"export const MOONS_OF = \{(.*?)\} as const", text, re.S).group(1)
    moons = {host: re.findall(r'"([a-z]+)"', ids) for host, ids in re.findall(r"(\w+): \[([^\]]*)\]", full)}
    return poles, names, moons, sizes


def from_ra_dec(ra, dec):
    return [math.cos(dec * RAD) * math.cos(ra * RAD), math.cos(dec * RAD) * math.sin(ra * RAD), math.sin(dec * RAD)]


def to_ecliptic(v):
    c, s = math.cos(OBLIQUITY * RAD), math.sin(OBLIQUITY * RAD)
    return [v[0], v[1] * c + v[2] * s, -v[1] * s + v[2] * c]


def cross(a, b):
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]


def basis(pole):
    if pole is None:
        return [1, 0, 0], [0, 1, 0], [0, 0, 1]
    z, x = from_ra_dec(*pole), from_ra_dec(pole[0] + 90, 0)
    return to_ecliptic(x), to_ecliptic(cross(z, x)), to_ecliptic(z)


# Uranus's moons go round the IAU's south pole of Uranus (the poles of their Laplace planes on the element page are near RA 77.3, Dec 15.2): an `equatorial` orbit of Uranus is measured about that pole
EQUATOR_POLE = {"uranus": (77.311, 15.175)}


def mean_anomaly(o, pole, v, w, node):
    """The mean anomaly that puts a moon on orbit `o` (with periapsis `w` and node `node`) at the place along it where `v` is: its argument of latitude in the orbit's plane, as a mean anomaly."""
    bx, by, bz = basis(pole)
    p = [sum(a * b for a, b in zip(v, axis)) for axis in (bx, by, bz)]
    i, n = o["i"] * RAD, node * RAD
    line = [math.cos(n), math.sin(n), 0]
    normal = [math.sin(i) * math.sin(n), -math.sin(i) * math.cos(n), math.cos(i)]
    u = math.atan2(sum(a * b for a, b in zip(p, cross(normal, line))), sum(a * b for a, b in zip(p, line)))
    nu = u - w * RAD
    e = o["e"]
    E = 2 * math.atan2(math.sqrt(1 - e) * math.sin(nu / 2), math.sqrt(1 + e) * math.cos(nu / 2))
    return math.degrees(E - e * math.sin(E))


def phased(o, pole, v, fits):
    """JPL's mean orbit carried to PHASE at its own rates, with the mean anomaly set so the moon is where Horizons puts it that day, and, for a moon that goes round in under 90 days, the rate along the orbit set from where Horizons puts it
    1, 31 and 90 days later (each step counts the whole turns from the rate the step before gave). The shape, the plane and the turning of the periapsis and node stay JPL's. Without a Horizons place that day, the orbit is left as JPL gives it."""
    if v is None:
        return o
    n, dw, dn = rates(o)
    dt = PHASE - o["epoch"]
    w, node = (o["w"] + dw * dt) % 360, (o["node"] + dn * dt) % 360
    m0 = mean_anomaly(o, pole, v, w, node)
    # only a moon that goes round at least once in the 90 days: a slower one's place over a few months is pulled about by the Sun more than it shows its mean rate, so JPL's period is kept
    for jd, place in sorted(fits.items()) if o["period"] < FIT[-1] - PHASE else []:
        step = jd - PHASE
        seen = mean_anomaly(o, pole, place, w + dw * step, node + dn * step)
        turns = round((m0 + n * step - seen) / 360)
        n = (seen + 360 * turns - m0) / step
    # a fitted rate more than 1 per cent from JPL's is a miscounted turn (a new moon whose ephemeris is still rough): JPL's is kept
    if abs(n / rates(o)[0] - 1) > 0.01:
        n = rates(o)[0]
    period = float(f"{360 / (n + dw + dn):.10g}")
    return {**o, "epoch": PHASE, "w": round(w, 4), "node": round(node, 4), "m": round(m0 % 360, 4), "period": period, "jplEpoch": o["epoch"], "jplPeriod": o["period"]}


def kepler(m, e):
    m = math.remainder(m, 2 * math.pi)
    E = m if e < 0.8 else m + 0.85 * e * (1 if math.sin(m) >= 0 else -1)
    for _ in range(30):
        d = (E - e * math.sin(E) - m) / (1 - e * math.cos(E))
        E -= d
        if abs(d) < 1e-13:
            break
    return E


def rates(o):
    """The rate of the mean anomaly and the turning of the periapsis and the node, degrees a day, as src/moon-catalogue.ts works them out from the periods (the same rule, so the measured error is the package's)."""
    n = 360 / o["period"]
    ci = math.cos(o["i"] * RAD)
    dw = 0 if not o["apsisYears"] else math.copysign(360 / (o["apsisYears"] * 365.25), 5 * ci * ci - 1)
    dn = 0 if not o["nodeYears"] else -math.copysign(360 / (o["nodeYears"] * 365.25), ci)
    # the period is sidereal: the mean longitude (periapsis, node and mean anomaly together) goes once round in it, so the mean anomaly runs slower by the turning of the other two
    return n - dw - dn, dw, dn


def position(o, pole, jd):
    n, dw, dn = rates(o)
    dt = jd - o["epoch"]
    w, node, mean = (o["w"] + dw * dt) * RAD, (o["node"] + dn * dt) * RAD, (o["m"] + n * dt) * RAD
    E = kepler(mean, o["e"])
    x, y = o["a"] * (math.cos(E) - o["e"]), o["a"] * math.sqrt(1 - o["e"] ** 2) * math.sin(E)
    cw, sw, cn, sn, ci, si = math.cos(w), math.sin(w), math.cos(node), math.sin(node), math.cos(o["i"] * RAD), math.sin(o["i"] * RAD)
    px = (cw * cn - sw * sn * ci) * x + (-sw * cn - cw * sn * ci) * y
    py = (cw * sn + sw * cn * ci) * x + (-sw * sn + cw * cn * ci) * y
    pz = sw * si * x + cw * si * y
    bx, by, bz = basis(pole)
    return [px * bx[k] + py * by[k] + pz * bz[k] for k in range(3)]


def angle(a, b):
    la, lb = math.sqrt(sum(v * v for v in a)), math.sqrt(sum(v * v for v in b))
    return math.degrees(math.acos(max(-1, min(1, sum(x * y for x, y in zip(a, b)) / (la * lb)))))


def sheet(text):
    """A moon's radius, albedo and V(1,0) from its Horizons data sheet, where the sheet gives them."""
    head = text.split("$$SOE")[0]
    out = {}
    m = re.search(r"(?:Mean )?[Rr]adius \(km\)\s*=\s*([\d.]+)(?:\s*x\s*([\d.]+)\s*x\s*([\d.]+))?(?:\s*\+-\s*([\d.]+))?", head)
    if m:
        axes = [float(v) for v in m.groups()[:3] if v]
        out["radius"] = round((axes[0] * axes[1] * axes[2]) ** (1 / 3), 2) if len(axes) == 3 else axes[0]
        out["radiusAxes"] = axes if len(axes) == 3 else None
        out["radiusSigma"] = float(m.group(4)) if m.group(4) else None
    m = re.search(r"(?:Geometric )?[Aa]lbedo\s*=\s*([\d.]+)", head)
    if m:
        out["albedo"] = float(m.group(1))
    m = re.search(r"V\(1,0\)\s*=\s*([+-]?[\d.]+)", head)
    if m:
        out["magnitude"] = float(m.group(1))
    return out


def jd_of(text):
    """'2000-01-01.5' (TDB) as a Julian date."""
    import datetime
    y, mo, rest = text.split("-")
    day = float(rest)
    when = datetime.datetime(int(y), int(mo), 1, tzinfo=datetime.timezone.utc) + datetime.timedelta(days=day - 1)
    return round((when - datetime.datetime(1970, 1, 1, tzinfo=datetime.timezone.utc)).total_seconds() / 86400 + UNIX_JD, 5)


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower().replace("ʻ", "").replace("'", "")).strip("-")


def designation(text):
    """'S2003_J_18', 'S/2003 J18' and 'S/2003 J 18' are one designation, written 'S/2003 J 18'."""
    m = re.fullmatch(r"S/?(\d{4})[ _]?([A-Z])[ _]?(\d+)", text.replace(" ", "_").replace("/", ""))
    return f"S/{m.group(1)} {m.group(2)} {m.group(3)}" if m else text


def build(elem, disc, phys, sb, rows, answers, near, fit):
    poles, ja_names, full, radii_of = facts()
    full_ids = {i for ids in full.values() for i in ids}
    # the discovery page: one row a moon, under a row naming its planet
    found, planet = [], None
    for r in re.findall(r"<tr[^>]*>(.*?)</tr>", table(disc, 'class="sat-discovery'), re.S):
        c = cells(r)
        if len(c) == 1:
            planet = re.search(r"of\s+(\w+)", c[0]).group(1)
            planet = "Pluto" if planet == "Dwarf" else planet
        elif len(c) >= 6:
            # a moon seen, lost and found again has two years ("1975, 2000") and two designations joined by "=": the first year is when it was first seen
            year = re.match(r"\d{4}", c[3])
            found.append({"planet": planet, "number": c[0] or None, "name": c[1] or None, "designation": " = ".join(designation(d.strip()) for d in c[2].split("=")) if c[2] else None, "year": int(year.group()) if year else None,
                          "by": c[4] or None, "reference": c[5] or None})
    # the measured radii
    radii = {}
    for c in [cells(r) for r in re.findall(r"<tr[^>]*>(.*?)</tr>", table(phys, 'id="sat_phys_par"'), re.S)]:
        if len(c) >= 5:
            p = c[4].split()
            if p and number(p[0]) is not None:
                radii[c[2]] = (number(p[0]), number(p[1]) if len(p) > 1 else None)
    # the element rows: one a moon (Puck is listed twice, from two ephemerides: the later epoch is kept)
    by_code = {}
    for r in rows:
        if r[3] not in by_code or jd_of(r[6]) > jd_of(by_code[r[3]][6]):
            by_code[r[3]] = r
    unmatched = list(found)
    moons, notes = [], []
    for code, r in by_code.items():
        host = r[1].lower()
        k = key(r[2])
        match = next((d for d in unmatched if d["planet"] == r[1] and (key(d["name"] or "") == k or key(d["designation"] or "") == key(designation(r[2])))), None)
        if match is None and host != "earth":
            # a name the element page spells differently from the discovery page (it has "Magaclite" and "Philophrosyn"): the discovery page's closest name in the same planet's list, when it is close
            close = [(difflib.SequenceMatcher(None, key(d["name"]), k).ratio(), i) for i, d in enumerate(unmatched) if d["planet"] == r[1] and d["name"]]
            best = max(close, default=(0, -1))
            match = unmatched[best[1]] if best[0] >= 0.8 else None
            if match:
                notes.append(f"{r[2]} on the element page is {match['name']} on the discovery page")
        if match:
            unmatched.remove(match)
        text, vec = answers[code]
        s = sheet(text)
        name = (match or {}).get("name") or (r[2] if host == "earth" else None)
        des = (match or {}).get("designation") or (designation(r[2]) if r[2].startswith("S") and re.search(r"\d{4}", r[2]) else None)
        ident = slug(name or des)
        orbit = {"frame": r[5].lower(), "epoch": jd_of(r[6]), "a": number(r[7]), "e": number(r[8]), "w": number(r[9]), "m": number(r[10]), "i": number(r[11]), "node": number(r[12]),
                 "period": number(r[13]), "apsisYears": number(r[14]), "nodeYears": number(r[15]), "ephemeris": r[4]}
        pole = (number(r[16]), number(r[17])) if orbit["frame"] == "laplace" and number(r[16]) is not None else (EQUATOR_POLE.get(host, poles[host]) if orbit["frame"] == "equatorial" else None)
        if pole is not None:
            orbit["pole"] = list(pole)
        orbit = phased(orbit, pole, (vec or {}).get(PHASE), fit.get(code) or {})
        moon = {"id": ident, "name": name, "designation": des, "number": (match or {}).get("number"), "host": host, "code": int(code), "year": (match or {}).get("year"), "by": (match or {}).get("by"),
                "reference": (match or {}).get("reference"), "orbit": orbit, **measured_size(name, code, radii, s)}
        moon["orbit"] = orbit
        # the orbit against Horizons: at the dates near the phase day (not used to set it), and at the far ones
        close = near.get(code) or {}
        errors = [(math.dist(position(orbit, pole, jd), v), angle(position(orbit, pole, jd), v)) for jd, v in sorted(close.items())]
        far = [angle(position(orbit, pole, jd), v) for jd, v in sorted((vec or {}).items()) if jd != PHASE]
        moon["errorKm"] = round(max(e[0] for e in errors)) if errors else None
        moon["errorDeg"] = round(max(e[1] for e in errors), 3) if errors else None
        moon["farDeg"] = round(max(far), 1) if far else None
        moon["full"] = ident in full_ids
        moon["ja"] = ja_names[ident][1] if ident in ja_names else None
        moon["fixture"] = {str(jd): [round(x, 1) for x in v] for jd, v in sorted({**(vec or {}), **close}.items()) if jd != PHASE}
        moons.append(moon)
    for d in unmatched:
        # on the discovery page with no mean orbit (S/2009 S 1, a moonlet in the rings)
        host = d["planet"].lower()
        ident = slug(d["name"] or d["designation"])
        moons.append({"id": ident, "name": d["name"], "designation": d["designation"], "number": d["number"], "host": host, "code": None, "year": d["year"], "by": d["by"], "reference": d["reference"],
                      "orbit": None, "radius": None, "errorKm": None, "errorDeg": None, "group": "none", "full": ident in full_ids, "ja": ja_names.get(ident, (None, None))[1], "fixture": {}})
        notes.append(f"{d['name'] or d['designation']} ({d['planet']}) has no mean orbit on the element page")
    for host, answer in sb.items():
        for rec in answer.get("data", []) if isinstance(answer, dict) else []:
            sat = rec["sat"]
            name = sat["iau_name"] or None
            des = sat["sat_fullname"] if not name else f"S/{sat['prov_year']} ({sat['pdes']}) {sat['prov_num']}"
            ident = slug(name or des)
            moons.append({"id": ident, "name": name, "designation": des, "number": ROMAN_OF.get(sat["iau_num"]) if sat["iau_num"] else None, "host": host, "code": None, "year": int(sat["prov_year"]),
                          "by": None, "reference": sat["ref"], "orbit": None, "radius": None, "errorKm": None, "errorDeg": None, "group": "none", "full": slug(name or "").replace("-", "") in full_ids,
                          "ja": ja_names.get(slug(name or "").replace("-", ""), (None, None))[1], "fixture": {}, "confirmed": sat["confirmed"] == "Y"})
    majors = [m for m in moons if m["orbit"] is not None and (m.get("radius") or 0) >= 150 and not (m["orbit"]["frame"] == "ecliptic" and m["host"] != "earth")]
    for moon in moons:
        if moon["orbit"] is not None:
            moon["group"] = group_of(moon["host"], moon, majors, radii_of)
    for moon in moons:
        if moon["full"] and moon["id"] not in full_ids:
            moon["id"] = moon["id"].replace("-", "")
        if moon["id"] in ja_names:
            # the package's own spelling of its own moons ("Hiʻiaka" with the ʻokina)
            moon["name"] = ja_names[moon["id"]][0]
    ids = [m["id"] for m in moons]
    assert len(set(ids)) == len(ids), f"an id twice: {[i for i in ids if ids.count(i) > 1]}"
    missing = full_ids - set(ids)
    assert not missing, f"the package's own moons missing from the table: {missing}"
    return moons, notes


ROMAN_OF = {n: r for n, r in enumerate(["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"])}
FETCHED = None
GROUPS = ["inner", "major", "regular", "themisto", "himalia", "carpo", "valetudo", "ananke", "carme", "pasiphae", "inuit", "gallic", "norse", "prograde", "retrograde", "none"]


def group_of(host, moon, majors, radius):
    """The dynamical group, by this package's rule (the guide "Every known moon" states it). Irregular: JPL gives the mean orbit about the ecliptic (the Sun's pull steers it), or it is over 100 planet radii out.
    Then Jupiter's by distance and slope (Themisto under 9 million km; Himalia 10 to 13 million km and under 35 degrees; Carpo over 45 degrees; Valetudo the other prograde one; Carme retrograde at 160 degrees or more;
    Ananke retrograde under 22 million km; Pasiphae the rest), Saturn's by slope (Gallic prograde under 42 degrees, Inuit prograde from 42, Norse retrograde), and the others' prograde or retrograde. Regular: `major`
    at 150 km of radius or more, `inner` a smaller one inside its planet's innermost major moon, and `regular` the others."""
    o = moon["orbit"]
    if o is None:
        return "none"
    irregular = o["frame"] == "ecliptic" and host != "earth" or o["a"] > 100 * radius[host]
    if not irregular:
        if (moon.get("radius") or 0) >= 150:
            return "major"
        inside = [m["orbit"]["a"] for m in majors if m["host"] == host]
        return "inner" if inside and o["a"] < min(inside) else "regular"
    a, i = o["a"] / 1e6, o["i"]
    if host == "jupiter":
        if i < 90:
            return "themisto" if a < 9 else "himalia" if 10 <= a <= 13 and i < 35 else "carpo" if i >= 45 else "valetudo"
        return "carme" if i >= 160 else "ananke" if a < 22 else "pasiphae"
    if host == "saturn":
        return "norse" if i > 90 else "gallic" if i < 42 else "inuit"
    return "retrograde" if i > 90 else "prograde"


def row(m):
    o = m["orbit"]
    orbit = None
    if o is not None:
        orbit = [FRAMES.index(o["frame"]), o["epoch"], o["a"], o["e"], o["w"], o["m"], o["i"], o["node"], o["period"], o["apsisYears"], o["nodeYears"], o["ephemeris"]]
        if o.get("pole"):
            orbit += o["pole"]
    source = {"jpl-phys": 0, "horizons": 1}.get(m.get("radiusFrom"))
    return [m["id"], m["name"], m["designation"], m["number"], m["host"], m["code"], m["year"], m["by"], m["reference"], orbit, m["radius"], m.get("radiusSigma"), source, m.get("albedo"),
            m.get("magnitude"), m["errorKm"], m["errorDeg"], m.get("farDeg"), m["group"], m["ja"], 0 if m.get("confirmed") is False else 1]


HEADER = """// Made by scripts/make-moon-catalogue.py from NASA/JPL's Solar System Dynamics pages "Planetary Satellite Mean Elements", "Planetary Satellite Discovery Circumstances" and "Planetary Satellite Physical
// Parameters", its Small-Body Satellites API and JPL Horizons (credit: NASA/JPL-Caltech; see NOTICE.md); do not edit by hand. Read again with --refresh, which prints what changed.
import type { HostId } from "../facts.ts";
import type { MoonGroup } from "../moon-catalogue.ts";

/** frame (0 ecliptic, 1 equatorial, 2 laplace), epoch (JD TDB), a (km), e, w, M, i, node (degrees), period (days), apsis and node periods (years), ephemeris, and the plane's pole (RA, Dec) for 1 and 2. */
export type MoonOrbitRow = [number, number, number, number, number, number, number, number, number, number | null, number | null, string, number?, number?];
/** id, name, designation, IAU number, host, JPL code, year found, discoverers, announcement, orbit, radius (km), its sigma, its source (0 JPL's physical parameters, 1 the Horizons sheet), albedo, V(1,0),
 * worst error against Horizons near the phase day (km, degrees) and at the far dates (degrees), group, Japanese name (the package's own moons only), confirmed (0 or 1). */
export type MoonRow = [string, string | null, string | null, string | null, HostId, number | null, number | null, string | null, string | null, MoonOrbitRow | null, number | null, number | null, 0 | 1 | null,
  number | null, number | null, number | null, number | null, number | null, MoonGroup, string | null, 0 | 1];
"""


def write(path, moons):
    lines = [HEADER, f'export const MOON_CATALOGUE_READ = "{FETCHED}";', "", "export const MOON_CATALOGUE_ROWS: readonly MoonRow[] = ["]
    lines += ["  " + json.dumps(row(m), ensure_ascii=False, separators=(",", ":")) + "," for m in moons]
    lines += ["];", ""]
    open(path, "w").write("\n".join(lines))


def read_rows(path):
    return [json.loads(line.strip().rstrip(",")) for line in open(path) if line.startswith("  [")]


def compare(old, new):
    """What changed between the table in the repository and the one just read, in words."""
    out = []
    label = lambda r: r[1] or r[2] or r[0]
    before = {r[0]: r for r in old}
    after = {r[0]: r for r in new}
    by_code = {r[5]: r for r in old if r[5] is not None}
    for ident, r in after.items():
        was = before.get(ident) or (by_code.get(r[5]) if r[5] is not None else None)
        if was is None:
            out.append(f"+ new: {label(r)} ({r[4]}), found {r[6]} by {r[7]} ({r[8]})")
            continue
        if was[1] != r[1]:
            out.append(f"named: {label(was)} ({r[4]}) is now {r[1]}")
        elif was[2] != r[2]:
            out.append(f"designation: {label(r)}: {was[2]} -> {r[2]}")
        o, n = was[9], r[9]
        if (o is None) != (n is None) or (o and n and (o[11] != n[11] or abs(o[2] - n[2]) > 1e-3 * o[2] or abs(o[3] - n[3]) > 0.005 or abs(o[6] - n[6]) > 0.1)):
            out.append(f"orbit: {label(r)}: " + (f"a {o[2]} -> {n[2]} km, e {o[3]} -> {n[3]}, i {o[6]} -> {n[6]}, ephemeris {o[11]} -> {n[11]}" if o and n else f"{'now has' if n else 'no longer has'} a mean orbit"))
        if was[10] != r[10]:
            out.append(f"size: {label(r)}: radius {was[10]} -> {r[10]} km")
        if was[6:9] != r[6:9]:
            out.append(f"discovery: {label(r)}: {was[6:9]} -> {r[6:9]}")
        if was[18] != r[18]:
            out.append(f"group: {label(r)}: {was[18]} -> {r[18]}")
    gone = {r[0] for r in old} - set(after) - {by_code[r[5]][0] for r in new if r[5] in by_code}
    out += [f"- gone: {label(before[i])} ({before[i][4]})" for i in sorted(gone)]
    return out


def measured_size(name, code, radii, s):
    """The radius: measured (JPL's physical parameters, with its uncertainty), else as the moon's Horizons sheet gives it; else none here (an estimate from the magnitude is the package's, made at run time)."""
    if code in radii and radii[code][0] is not None:
        return {"radius": radii[code][0], "radiusSigma": radii[code][1], "radiusFrom": "jpl-phys", "albedo": s.get("albedo"), "magnitude": s.get("magnitude")}
    if "radius" in s:
        return {"radius": s["radius"], "radiusSigma": s.get("radiusSigma"), "radiusFrom": "horizons", "albedo": s.get("albedo"), "magnitude": s.get("magnitude")}
    return {"radius": None, "radiusSigma": None, "radiusFrom": None, "albedo": s.get("albedo"), "magnitude": s.get("magnitude")}


if __name__ == "__main__":
    main()
