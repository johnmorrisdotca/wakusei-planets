#!/usr/bin/env python3
"""Writes src/data/orbiters.ts and test/data/orbiters-horizons.json: the spacecraft in orbit round the Moon and Mars, from JPL Horizons
(https://ssd.jpl.nasa.gov/api/horizons.api, VECTORS, centre the body, ecliptic and equinox J2000, km and km/s, TDB), as mean orbital elements with
secular rates fitted over a window of the craft's current track, each with the dates it is good for and the error measured against Horizons.

Time scales: Horizons' vectors are asked for and read in TDB, so every Julian date in the fit (`epochJd`) is TDB. The library takes UTC (a `Date`) and adds
TDB - UTC = 37 s (TAI - UTC, fixed since 2017-01-01) + 32.184 s (TT - TAI) = 69.184 s; TDB differs from TT by under 2 ms. The dates written as ISO strings are UTC.
The test points are asked for as UTC calendar dates (TIME_TYPE UT), so Horizons does the time-scale change itself and the test does not depend on ours.

For each craft: the object header is read for the revision date and how far tracking data reach; one VECTORS request gives samples at STEP minutes
over WINDOW days before the read date; the osculating elements of every sample are worked out and a line is fitted to each (the node, the argument of
periapsis and the mean anomaly as drifts, the rest as means); the fit is propagated back to every sample and the worst error recorded. A craft Horizons
has no track for at the read date is kept from the last good file with `basis: "modelled"`.

Two errors are measured against Horizons for each craft: `fitErrorKm` over the fit's window (what "tracked" means) and, from a second request for the days after the read
date, `predictedErrorKm` over the window's own length past it (what "predicted" means: the ellipse carried on beyond the data it was fitted to). A craft whose Horizons
track has ended has none.

Usage: python3 -I scripts/make-orbiter-data.py [--cache DIR] [--brief] [craft ...]   (needs the network; one request at a time, a pause between requests, stops on any error; keep the cache
outside the repository). `--brief` leaves out the working lines and ends with one line a craft; `pnpm orbiters:refresh` runs it so, with the cache in ~/.cache/wakusei-planets."""
import datetime, hashlib, json, math, os, re, sys, time, urllib.parse, urllib.request

SOURCE = "https://ssd.jpl.nasa.gov/api/horizons.api"
UNIX_EPOCH_JD = 2440587.5
PAUSE = 2.0
# TDB - UTC in seconds: TAI - UTC (37 s since 2017-01-01; no leap second since) plus TT - TAI (32.184 s). TDB - TT is under 2 ms, far below anything this fit can show.
TDB_MINUS_UTC_S = 37.0 + 32.184
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src", "data", "orbiters.ts")
FIXTURE = os.path.join(ROOT, "test", "data", "orbiters-horizons.json")
# GM in km^3/s^2 (JPL DE440 values)
GM = {"moon": 4902.800118, "mars": 42828.375816}
CENTER = {"moon": "500@301", "mars": "500@499"}
EQUATORIAL_RADIUS_KM = {"moon": 1737.4, "mars": 3396.2}

# id: (Horizons id, body, window days, step minutes, error limit in km or ("relative", share of the mean radius))
CRAFT = {
    "lro": ("-85", "moon", 7, 5, 60.0),
    "chandrayaan-2": ("-152", "moon", 7, 5, 60.0),
    "danuri": ("-155", "moon", 7, 5, 60.0),
    "artemis-p1": ("-192", "moon", 14, 5, ("relative", 0.1)),
    "artemis-p2": ("-193", "moon", 14, 5, ("relative", 0.1)),
    "capstone": ("-1176", "moon", 14, 5, ("relative", 0.1)),
    "mro": ("-74", "mars", 7, 5, 60.0),
    "odyssey": ("-53", "mars", 7, 5, 60.0),
    "maven": ("-202", "mars", 7, 5, 60.0),
    "mars-express": ("-41", "mars", 10, 5, 25.0),
    "tgo": ("-143", "mars", 4, 5, 60.0),
    "hope": ("-62", "mars", 10, 5, 40.0),
}
# Craft Horizons has no orbit track for at all: Tianwen-1's record is a volunteers' cruise that ends an hour after its closest approach to Mars, before the orbit insertion, so there is nothing to fit.
NO_TRACK = {"tianwen-1": ("-9901491", "mars")}

JD0 = datetime.datetime(1970, 1, 1, tzinfo=datetime.timezone.utc)


def jd_of(when):
    return (when - JD0).total_seconds() / 86400 + UNIX_EPOCH_JD


def tdb_of_utc(utc_jd):
    return utc_jd + TDB_MINUS_UTC_S / 86400


def iso_of_jd(jd):
    """An ISO UTC string from a UTC Julian date."""
    return (JD0 + datetime.timedelta(days=jd - UNIX_EPOCH_JD)).strftime("%Y-%m-%dT%H:%M:%SZ")


def iso_of_tdb(jd):
    """An ISO UTC string from a TDB Julian date."""
    return iso_of_jd(jd - TDB_MINUS_UTC_S / 86400)


class Horizons:
    def __init__(self, cache):
        self.cache = cache
        self.last = 0.0
        self.requests = 0

    def get(self, params):
        query = urllib.parse.urlencode(params)
        key = None
        if self.cache:
            os.makedirs(self.cache, exist_ok=True)
            key = os.path.join(self.cache, re.sub(r"[^A-Za-z0-9]+", "_", query)[:150] + "_" + hashlib.sha1(query.encode()).hexdigest()[:12] + ".json")
            if os.path.exists(key):
                return json.load(open(key))
        wait = self.last + PAUSE - time.time()
        if wait > 0:
            time.sleep(wait)
        req = urllib.request.Request(SOURCE + "?" + query, headers={"User-Agent": "wakusei-planets-data-script/0.1 (+https://github.com/johnmorrisdotca/wakusei-planets)"})
        with urllib.request.urlopen(req, timeout=120) as r:
            answer = json.load(r)
        self.last = time.time()
        self.requests += 1
        if key:
            json.dump(answer, open(key, "w"))
        return answer

    def header(self, command):
        answer = self.get({"format": "json", "COMMAND": f"'{command}'", "OBJ_DATA": "'YES'", "MAKE_EPHEM": "'NO'"})
        return answer.get("result", "")

    def vectors(self, command, center, start_jd, stop_jd, step_minutes):
        answer = self.get({"format": "json", "COMMAND": f"'{command}'", "OBJ_DATA": "'NO'", "MAKE_EPHEM": "'YES'", "EPHEM_TYPE": "'VECTORS'", "CENTER": f"'{center}'", "REF_PLANE": "'ECLIPTIC'",
                           "REF_SYSTEM": "'ICRF'", "OUT_UNITS": "'KM-S'", "VEC_TABLE": "'2'", "CSV_FORMAT": "'YES'", "TIME_TYPE": "'TDB'",
                           "START_TIME": f"'JD {start_jd:.7f}'", "STOP_TIME": f"'JD {stop_jd:.7f}'", "STEP_SIZE": f"'{step_minutes} m'"})
        text = answer.get("result", "")
        if "$$SOE" not in text:
            return None, text
        rows = []
        for line in text.split("$$SOE")[1].split("$$EOE")[0].strip().splitlines():
            parts = [p.strip() for p in line.split(",")]
            if len(parts) < 8:
                continue
            rows.append((float(parts[0]), [float(parts[2]), float(parts[3]), float(parts[4])], [float(parts[5]), float(parts[6]), float(parts[7])]))
        return rows, text


    def vectors_at_utc(self, command, center, start, stop, steps):
        """Vectors at `steps` equal intervals between two UTC calendar dates ('YYYY-MM-DD HH:MM'), asked in UT so Horizons changes the time scale itself.
        Returns [(UTC ISO string, position, velocity)]."""
        answer = self.get({"format": "json", "COMMAND": f"'{command}'", "OBJ_DATA": "'NO'", "MAKE_EPHEM": "'YES'", "EPHEM_TYPE": "'VECTORS'", "CENTER": f"'{center}'", "REF_PLANE": "'ECLIPTIC'",
                           "REF_SYSTEM": "'ICRF'", "OUT_UNITS": "'KM-S'", "VEC_TABLE": "'2'", "CSV_FORMAT": "'YES'", "TIME_TYPE": "'UT'",
                           "START_TIME": f"'{start}'", "STOP_TIME": f"'{stop}'", "STEP_SIZE": f"'{steps}'"})
        text = answer.get("result", "")
        if "$$SOE" not in text or "JDUT" not in text:
            return None
        rows = []
        for line in text.split("$$SOE")[1].split("$$EOE")[0].strip().splitlines():
            parts = [p.strip() for p in line.split(",")]
            if len(parts) < 8:
                continue
            when = datetime.datetime.strptime(parts[1].replace("A.D. ", ""), "%Y-%b-%d %H:%M:%S.%f").strftime("%Y-%m-%dT%H:%M:%SZ")
            rows.append((when, [float(parts[2]), float(parts[3]), float(parts[4])], [float(parts[5]), float(parts[6]), float(parts[7])]))
        return rows


def cross(a, b):
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def norm(a):
    return math.sqrt(dot(a, a))


def elements_of(r, v, mu):
    """Osculating elements (km, degrees) from a state in an inertial frame."""
    h = cross(r, v)
    hn = norm(h)
    n = [-h[1], h[0], 0.0]
    nn = norm(n)
    rn = norm(r)
    vn = norm(v)
    ev = [(vn * vn - mu / rn) * r[k] / mu - dot(r, v) * v[k] / mu for k in range(3)]
    e = norm(ev)
    energy = vn * vn / 2 - mu / rn
    a = -mu / (2 * energy)
    i = math.degrees(math.acos(max(-1.0, min(1.0, h[2] / hn))))
    raan = math.degrees(math.atan2(n[1], n[0])) % 360 if nn > 1e-12 else 0.0
    if nn > 1e-12 and e > 1e-9:
        argp = math.degrees(math.atan2(dot(cross(n, ev), h) / hn, dot(n, ev))) % 360
    else:
        argp = 0.0
    if e > 1e-9:
        nu = math.atan2(dot(cross(ev, r), h) / hn, dot(ev, r))
    else:
        nu = math.atan2(dot(cross(n, r), h) / hn, dot(n, r)) if nn > 1e-12 else math.atan2(r[1], r[0])
    ea = 2 * math.atan2(math.sqrt(1 - e) * math.sin(nu / 2), math.sqrt(1 + e) * math.cos(nu / 2))
    m = (ea - e * math.sin(ea)) % (2 * math.pi)
    return {"a": a, "e": e, "i": i, "raan": raan, "argp": argp, "m": math.degrees(m)}


def position_of(el, mu, dt_days):
    """The position of mean elements with rates after dt_days, in the same frame (km)."""
    n = math.degrees(math.sqrt(mu / el["a"] ** 3)) * 86400  # degrees a day
    m = math.radians((el["m0"] + (n + el["meanMotionCorrection"]) * dt_days) % 360)
    e = el["e"]
    ea = m
    for _ in range(30):
        ea = ea - (ea - e * math.sin(ea) - m) / (1 - e * math.cos(ea))
    nu = 2 * math.atan2(math.sqrt(1 + e) * math.sin(ea / 2), math.sqrt(1 - e) * math.cos(ea / 2))
    rr = el["a"] * (1 - e * math.cos(ea))
    raan = math.radians(el["raan"] + el["raanRate"] * dt_days)
    argp = math.radians(el["argp"] + el["argpRate"] * dt_days)
    inc = math.radians(el["i"])
    u = argp + nu
    x = rr * (math.cos(raan) * math.cos(u) - math.sin(raan) * math.sin(u) * math.cos(inc))
    y = rr * (math.sin(raan) * math.cos(u) + math.cos(raan) * math.sin(u) * math.cos(inc))
    z = rr * math.sin(u) * math.sin(inc)
    return [x, y, z]


def unwrap(values):
    out = [values[0]]
    for v in values[1:]:
        d = (v - out[-1] + 180) % 360 - 180
        out.append(out[-1] + d)
    return out


def line_fit(xs, ys):
    n = len(xs)
    mx = sum(xs) / n
    my = sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    slope = sxy / sxx if sxx > 0 else 0.0
    return my - slope * mx, slope


def fit(rows, mu):
    """Mean elements at the window's middle, with rates, from osculating elements of every sample."""
    t0 = rows[len(rows) // 2][0]
    ts = [row[0] - t0 for row in rows]
    els = [elements_of(r, v, mu) for _, r, v in rows]
    a = sum(e["a"] for e in els) / len(els)
    e = sum(x["e"] for x in els) / len(els)
    i = sum(x["i"] for x in els) / len(els)
    raan0, raan_rate = line_fit(ts, unwrap([x["raan"] for x in els]))
    argp0, argp_rate = line_fit(ts, unwrap([x["argp"] for x in els]))
    n_kepler = math.degrees(math.sqrt(mu / a ** 3)) * 86400
    # a near-circular orbit has no clear periapsis: the argument of periapsis and the mean anomaly trade places sample to sample, so their sum (the mean argument of latitude) is fitted as one line,
    # and the mean anomaly's start and rate follow from it and the periapsis line
    u_unwrapped = unwrap([(x["argp"] + x["m"]) % 360 for x in els])
    u0, u_rate = line_fit(ts, u_unwrapped)
    m0 = u0 - argp0
    m_rate = u_rate - argp_rate
    return {"epochJd": t0, "a": a, "e": e, "i": i, "raan": raan0 % 360, "argp": argp0 % 360, "m0": m0 % 360, "raanRate": raan_rate, "argpRate": argp_rate, "meanMotionCorrection": m_rate - n_kepler}


def error_of(el, rows, mu):
    errors = []
    for t, r, _ in rows:
        p = position_of(el, mu, t - el["epochJd"])
        errors.append(norm([p[k] - r[k] for k in range(3)]))
    errors.sort()
    return errors[len(errors) // 2], errors[-1]


def read_header(text):
    revised = re.search(r"Revised:\s*([A-Za-z]{3} \d{1,2}, \d{4})", text)
    through = re.search(r"(?:tracking data|data|fit to data|Fit to data|tracking)\s+(?:through|thru|to)\s+(\d{4}-[A-Za-z]{3}-\d{2}|\d{4}-\d{2}-\d{2}|[A-Za-z]+ \d{1,2},? \d{4}|[A-Za-z]{3} \d{1,2}, \d{4})", text)
    return (revised.group(1) if revised else ""), (through.group(1) if through else "")


def load_existing():
    if not os.path.exists(OUT):
        return {}
    text = open(OUT).read()
    m = re.search(r"export const ORBITER_FITS = (\{.*?\}) as const;", text, re.S)
    if not m:
        return {}
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return {}


BRIEF = False


def say(text):
    """A working line, left out with --brief."""
    if not BRIEF:
        print(text, file=sys.stderr)


def summary(craft, fit):
    """One line for a craft: what the file now holds for it."""
    if "a" not in fit:
        return f"{craft}: {fit.get('basis', 'modelled')}, no path"
    predicted = fit.get("predictedErrorKm")
    after = f", predicted worst {predicted['max']} km to {fit['validUntil'][:10]}" if predicted else ""
    return f"{craft}: {fit['basis']}, fit worst {fit['fitErrorKm']['max']} km to {fit.get('fitUntil', '')[:10]}{after}"


def main():
    global BRIEF
    args = sys.argv[1:]
    if "--brief" in args:
        BRIEF = True
        args.remove("--brief")
    cache = None
    if "--cache" in args:
        at = args.index("--cache")
        cache = args[at + 1]
        del args[at:at + 2]
    wanted = args or list(CRAFT)
    horizons = Horizons(cache)
    existing = load_existing()
    today = datetime.datetime.now(datetime.timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    read = today.strftime("%Y-%m-%d")
    fits = dict(existing)
    fixture = {k: v for k, v in (json.load(open(FIXTURE)) if os.path.exists(FIXTURE) else {}).items() if k not in wanted}
    for craft in wanted:
        command, body, window, step, limit = CRAFT[craft]
        mu = GM[body]
        header = horizons.header(command)
        revised, through = read_header(header)
        stop = tdb_of_utc(jd_of(today))  # the read date's UTC midnight, as the TDB Julian date Horizons is asked for
        start = stop - window
        rows, text = horizons.vectors(command, CENTER[body], start, stop, step)
        ended = None
        if rows is None or len(rows) < 50:
            # no track at the read date: the last window of the track Horizons has, fitted as a mean orbit the craft was on, said to be modelled
            reason = re.search(r"No ephemeris for target.*?after\s+(?:A\.D\.\s+)?(\d{4})-([A-Za-z]{3})-(\d{2})", text or "", re.S)
            if reason is None:
                print(f"{craft}: no track and no end date in Horizons' answer; kept as it was", file=sys.stderr)
                kept = dict(existing.get(craft, {}))
                kept.update({"id": craft, "center": body, "horizonsId": int(command), "basis": "modelled", "retrieved": read})
                fits[craft] = kept
                continue
            month = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"].index(reason.group(2).upper()) + 1
            ended = datetime.datetime(int(reason.group(1)), month, int(reason.group(3)), tzinfo=datetime.timezone.utc)
            stop = jd_of(ended) - 0.5  # Horizons' own end date, in the TDB it was asked in
            start = stop - window
            rows, text = horizons.vectors(command, CENTER[body], start, stop, step)
            if rows is None or len(rows) < 50:
                print(f"{craft}: no vectors before the track's end {ended.date()} either; kept as it was", file=sys.stderr)
                kept = dict(existing.get(craft, {}))
                kept.update({"id": craft, "center": body, "horizonsId": int(command), "basis": "modelled", "retrieved": read})
                fits[craft] = kept
                continue
            say(f"{craft}: no track now (Horizons ends {ended.date()}): the last {window} days of it, modelled")
        el = fit(rows, mu)
        median, worst = error_of(el, rows, mu)
        mean_r = sum(norm(r) for _, r, _ in rows) / len(rows)
        allowed = limit if not isinstance(limit, tuple) else limit[1] * mean_r
        if worst > 0.5 * mean_r:
            # no ellipse describes this path (CAPSTONE's near-rectilinear halo orbit): the craft is kept with no elements, so nothing is drawn for it
            say(f"{craft}: a mean ellipse misses by {worst:.0f} km of a {mean_r:.0f} km orbit: no elements kept, modelled")
            fits[craft] = {"id": craft, "center": body, "horizonsId": int(command), "basis": "modelled", "retrieved": read, "horizonsRevised": revised, "trackedUntil": through or (ended.strftime("%Y-%m-%d") if ended else ""), "trackEnd": iso_of_tdb(stop) if ended else ""}
            continue
        basis = "tracked" if ended is None else "modelled"
        # the same ellipse carried on past the fit, for as many days as the window is long, against what Horizons has there (none once a craft's track has ended)
        predicted = None
        if ended is None:
            extra, _ = horizons.vectors(command, CENTER[body], stop, stop + window, step)
            if extra is not None and len(extra) >= 50:
                p_median, p_worst = error_of(el, extra, mu)
                predicted = {"median": round(p_median, 1), "max": round(p_worst, 1)}
                say(f"{craft}: predicted span, {len(extra)} samples over the next {window} days: error median {p_median:.1f} km, worst {p_worst:.1f} km")
            else:
                say(f"{craft}: Horizons has nothing for the {window} days after the read date: no predicted error")
        say(f"{craft}: {len(rows)} samples over {window} days, a {el['a']:.0f} km, e {el['e']:.4f}, i {el['i']:.2f}, node {el['raanRate']:+.4f} and periapsis {el['argpRate']:+.4f} deg/day; error median {median:.1f} km, worst {worst:.1f} km (limit {allowed:.0f}){'' if worst <= allowed else '  OVER THE LIMIT'}")
        period_days = 360 / (math.degrees(math.sqrt(mu / el["a"] ** 3)) * 86400 + el["meanMotionCorrection"])
        fits[craft] = {
            "id": craft, "center": body, "horizonsId": int(command),
            "epochJd": round(el["epochJd"], 6), "a": round(el["a"], 3), "e": round(el["e"], 7), "i": round(el["i"], 5), "raan": round(el["raan"], 5), "argp": round(el["argp"], 5), "m0": round(el["m0"], 5),
            "raanRate": round(el["raanRate"], 7), "argpRate": round(el["argpRate"], 7), "meanMotionCorrection": round(el["meanMotionCorrection"], 7),
            "periodDays": round(period_days, 7),
            "validFrom": iso_of_tdb(start), "fitUntil": iso_of_tdb(stop), "validUntil": iso_of_tdb(stop + window), "trackedUntil": through or (ended.strftime("%Y-%m-%d") if ended else ""), "trackEnd": iso_of_tdb(stop) if ended else "", "horizonsRevised": revised, "retrieved": read,
            "fitErrorKm": {"median": round(median, 1), "max": round(worst, 1)}, "predictedErrorKm": predicted, "basis": basis if worst <= allowed else "modelled",
        }
        # four Horizons points for the tests, inside the fit's window, asked for as UTC calendar dates (to the minute) so that Horizons itself does the UTC to TDB change
        first = iso_of_tdb(start + 0.1 * window)[:16].replace("T", " ")
        last = iso_of_tdb(stop - 0.1 * window)[:16].replace("T", " ")
        points = horizons.vectors_at_utc(command, CENTER[body], first, last, 3)
        if points is None or len(points) != 4:
            print(f"{craft}: Horizons gave no UTC test points; stopping", file=sys.stderr)
            sys.exit(1)
        fixture[craft] = [{"span": "fit", "utc": t, "position": [round(x, 3) for x in r], "velocity": [round(x, 6) for x in v]} for t, r, v in points]
        if predicted is not None:
            first = iso_of_tdb(stop + 0.1 * window)[:16].replace("T", " ")
            last = iso_of_tdb(stop + 0.9 * window)[:16].replace("T", " ")
            points = horizons.vectors_at_utc(command, CENTER[body], first, last, 3)
            if points is None or len(points) != 4:
                print(f"{craft}: Horizons gave no UTC test points for the predicted span; stopping", file=sys.stderr)
                sys.exit(1)
            fixture[craft] += [{"span": "predicted", "utc": t, "position": [round(x, 3) for x in r], "velocity": [round(x, 6) for x in v]} for t, r, v in points]
    for craft, (command, body) in NO_TRACK.items():
        fits[craft] = {"id": craft, "center": body, "horizonsId": int(command), "basis": "modelled", "retrieved": read}
    ordered = {k: fits[k] for k in list(CRAFT) + list(NO_TRACK) if k in fits}
    with open(OUT, "w") as f:
        f.write("// Made by scripts/make-orbiter-data.py from JPL Horizons (https://ssd.jpl.nasa.gov/api/horizons.api): the spacecraft in orbit round the Moon and Mars, as mean elements with secular rates fitted over a window\n")
        f.write(f"// of each craft's current track (centre the body, ecliptic and equinox J2000, km and degrees, `epochJd` in TDB, the dates in UTC), with the dates the fit is good for and its error against Horizons, over the fit and past it. Fetched {read}. Do not edit by hand.\n")
        f.write("export const ORBITER_FITS = " + json.dumps(ordered, indent=2) + " as const;\n")
    with open(FIXTURE, "w") as f:
        json.dump(fixture, f, indent=1)
    print(f"wrote {OUT} ({len(ordered)} craft) and {FIXTURE}; {horizons.requests} requests", file=sys.stderr)
    if BRIEF:
        for craft in wanted + [k for k in NO_TRACK if k not in wanted]:
            print(summary(craft, ordered[craft]))


main()
