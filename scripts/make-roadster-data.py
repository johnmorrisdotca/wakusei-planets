#!/usr/bin/env python3
"""Writes src/data/roadster.ts and test/data/roadster-horizons.json: the Tesla Roadster (Starman, JPL Horizons target -143205, solution s11) from JPL Horizons
(https://ssd.jpl.nasa.gov/api/horizons.api, VECTORS, centre the Sun 500@10, ecliptic and equinox J2000, km and km/s, TDB), as a table of state vectors that src/roadster.ts
joins with cubic Hermite interpolation on position and velocity.

The table starts where Horizons' record starts (2018-02-07 03:00 TDB) and ends at END (2036-01-01 03:00 TDB). Rows are 2 hours apart for the first day (the car is still
near the Earth and the Earth's pull bends its path), a day apart from day 1 to day 10, then STEP days apart (the largest step, tried from 5 days up, whose worst interpolation error against
the daily record, an hourly record of the first 13 days and an hourly record round each of the Mars passes of October 2020 and April 2035 stays under LIMIT_KM). Positions are rounded to whole
kilometres and velocities to 1e-5 km/s. Afterwards the script fetches, for the test fixture, the state at times that are on no row from the Sun, the Earth and Mars, and Horizons' own
osculating elements at the same times; with --approaches FILE (a JSON list of Julian dates, TDB) it adds the Earth- and Mars-centred states at those times too.

Usage: python3 -I scripts/make-roadster-data.py [--cache DIR] [--approaches FILE]   (needs the network; one request at a time with a pause between them, stops on any error;
--cache keeps every answer so a stopped run resumes without asking again. A full run asks Horizons for 9 answers, 10 with --approaches.)"""
import json, math, os, re, sys, time, urllib.parse, urllib.request, hashlib

SOURCE = "https://ssd.jpl.nasa.gov/api/horizons.api"
TARGET = "-143205"
PAUSE = 1.5
LIMIT_KM = 1000.0
SAFETY = 0.8  # the step chosen keeps the worst error under this share of the limit, so a moment between two rows of the record has room
START = "2018-02-07 03:00"
END = "2036-01-01 03:00"
UNIX_EPOCH_JD = 2440587.5

# Dates for the test fixture, read as TDB; none is on a table row.
FIXTURE_TIMES = ["2018-02-07 12:17", "2018-02-10 06:17", "2018-05-23 11:41", "2018-11-02 17:29", "2019-08-14 02:53", "2020-04-09 20:11", "2020-10-04 14:37",
               "2020-10-07 06:26", "2021-06-18 09:05", "2022-12-31 23:11", "2024-03-11 13:47", "2026-11-11 07:19", "2029-07-27 18:33", "2033-09-05 04:21", "2034-12-20 10:10"]


def to_jd(text):
    import datetime
    when = datetime.datetime.strptime(text, "%Y-%m-%d %H:%M").replace(tzinfo=datetime.timezone.utc)
    return (when - datetime.datetime(1970, 1, 1, tzinfo=datetime.timezone.utc)).total_seconds() / 86400 + UNIX_EPOCH_JD


class Horizons:
    def __init__(self, cache):
        self.cache = cache
        self.last = 0.0
        self.requests = 0

    def ask(self, command, center, kind="VECTORS", **when):
        params = {"format": "json", "COMMAND": f"'{command}'", "OBJ_DATA": "'NO'", "MAKE_EPHEM": "'YES'", "EPHEM_TYPE": f"'{kind}'", "CENTER": f"'{center}'", "REF_PLANE": "'ECLIPTIC'",
                  "REF_SYSTEM": "'ICRF'", "OUT_UNITS": "'KM-S'", "CSV_FORMAT": "'YES'", "TIME_TYPE": "'TDB'"}
        if kind == "VECTORS":
            params["VEC_TABLE"] = "'2'"
        if "times" in when:
            params["TLIST_TYPE"] = "'JD'"
            params["TLIST"] = "'" + "' '".join(f"{t:.7f}" for t in when["times"]) + "'"
        else:
            params.update({"START_TIME": f"'{when['start']}'", "STOP_TIME": f"'{when['stop']}'", "STEP_SIZE": f"'{when['step']}'"})
        query = urllib.parse.urlencode(params)
        key = None
        if self.cache:
            os.makedirs(self.cache, exist_ok=True)
            key = os.path.join(self.cache, hashlib.md5(query.encode()).hexdigest() + ".txt")
            if os.path.exists(key):
                return parse(open(key).read(), kind)
        wait = PAUSE - (time.time() - self.last)
        if wait > 0:
            time.sleep(wait)
        text = json.load(urllib.request.urlopen(SOURCE + "?" + query, timeout=300)).get("result", "")
        self.last = time.time()
        self.requests += 1
        if "$$SOE" not in text:
            raise SystemExit(f"Horizons gave no rows ({command} from {center}): {text.strip()[:400]}")
        if key:
            open(key, "w").write(text)
        return parse(text, kind)


def parse(text, kind):
    rows = []
    for line in text.split("$$SOE")[1].split("$$EOE")[0].strip().split("\n"):
        p = [v.strip() for v in line.split(",")]
        if kind == "VECTORS":
            rows.append([float(p[0])] + [float(v) for v in p[2:8]])
        else:  # ELEMENTS: JD, calendar, EC, QR, IN, OM, W, Tp, N, MA, TA, A, AD, PR
            rows.append([float(p[0])] + [float(v) for v in p[2:14]])
    return rows


def hermite(r0, r1, jd):
    h = (r1[0] - r0[0]) * 86400
    s = (jd - r0[0]) * 86400 / h
    a, b, c, d = 2 * s**3 - 3 * s**2 + 1, s**3 - 2 * s**2 + s, -2 * s**3 + 3 * s**2, s**3 - s**2
    return [a * r0[1 + i] + b * h * r0[4 + i] + c * r1[1 + i] + d * h * r1[4 + i] for i in range(3)]


def worst_of(nodes, checks):
    """The worst distance, in km, between the interpolation through `nodes` and the rows of `checks` that lie within them (and the row it is at)."""
    worst, at, j = 0.0, None, 0
    for row in checks:
        if row[0] < nodes[0][0] or row[0] > nodes[-1][0]:
            continue
        while j < len(nodes) - 2 and nodes[j + 1][0] <= row[0]:
            j += 1
        e = math.dist(hermite(nodes[j], nodes[j + 1], row[0]), row[1:4])
        if e > worst:
            worst, at = e, row[0]
    return worst, at


def rounded(row):
    return [row[0]] + [round(v) for v in row[1:4]] + [round(v, 5) for v in row[4:7]]


def main():
    args = sys.argv[1:]
    cache = args[args.index("--cache") + 1] if "--cache" in args else None
    approaches = json.load(open(args[args.index("--approaches") + 1])) if "--approaches" in args else None
    hz = Horizons(cache)
    start_jd = to_jd(START)
    first_day = hz.ask(TARGET, "500@10", start=START, stop="2018-02-08 03:00", step="2 h")
    daily = hz.ask(TARGET, "500@10", start=START, stop=END, step="1 d")
    hourly_launch = hz.ask(TARGET, "500@10", start=START, stop="2018-02-20 03:00", step="1 h")
    hourly_mars = hz.ask(TARGET, "500@10", start="2020-09-25 03:00", stop="2020-10-20 03:00", step="1 h")
    hourly_2035 = hz.ask(TARGET, "500@10", start="2035-04-10 03:00", stop="2035-05-05 03:00", step="1 h")
    checks = [("the daily record", daily), ("the hourly record of the first 13 days", hourly_launch), ("the hourly record round the Mars pass of 2020", hourly_mars), ("the hourly record round the Mars pass of 2035", hourly_2035)]

    chosen = None
    print("step  worst error in km (record)")
    for step in range(5, 31):
        nodes = [r for r in first_day] + [r for r in daily[2:11]] + [daily[i] for i in range(10 + step, len(daily), step)]
        if nodes[-1][0] != daily[-1][0]:
            nodes.append(daily[-1])
        worst = [worst_of(nodes, rows) for _, rows in checks]
        top = max(w[0] for w in worst)
        print(f"{step:>4}  {top:10.1f}  " + "  ".join(f"{w[0]:.0f}" for w in worst))
        if top < SAFETY * LIMIT_KM:
            chosen = (step, nodes, top)
    if chosen is None:
        raise SystemExit("no step keeps the error under the limit")
    step, nodes, top = chosen
    nodes = [rounded(r) for r in nodes]
    worst = max(worst_of(nodes, rows)[0] for _, rows in checks)
    jd0 = nodes[0][0]
    flat = []
    for r in nodes:
        hours = round((r[0] - jd0) * 24)
        flat += [hours] + [int(v) for v in r[1:4]] + [v for v in r[4:7]]
    body = ",\n".join("  " + ",".join(("%d" % v) if i < 4 else repr(v) for i, v in enumerate(flat[k:k + 7])) for k in range(0, len(flat), 7))
    ms = round((jd0 - UNIX_EPOCH_JD) * 86400000)
    out = f"""// Made by scripts/make-roadster-data.py from JPL Horizons (https://ssd.jpl.nasa.gov/api/horizons.api): the Tesla Roadster (target {TARGET}, solution s11), centre the Sun, ecliptic and equinox J2000, TDB (taken as terrestrial time), fetched 2026-11-11.
// {len(nodes)} rows: rows 2 hours apart for the first day, a day apart from day 1 to day 10, then {step} days apart to the end; measured against Horizons' own record (every day of the span, every hour of the first 13 days and of 25 days round each of the Mars passes of October 2020 and April 2035), the Hermite interpolation of src/roadster.ts is within {round(worst)} km. Do not edit by hand.
/** Where the table starts: milliseconds since 1970 (TDB taken as terrestrial time) of its first row. */
export const ROADSTER_START = {ms};
/** The worst interpolation error against Horizons' own record, in kilometres, as measured when the table was made. */
export const ROADSTER_WORST_KM = {round(worst)};
/** The step in days between rows after day 10. */
export const ROADSTER_STEP_DAYS = {step};
/** Seven numbers to a row: hours after the start, then x, y, z in kilometres and vx, vy, vz in kilometres a second from the Sun. */
export const ROADSTER_ROWS: readonly number[] = [
{body},
];
"""
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    open(os.path.join(root, "src", "data", "roadster.ts"), "w").write(out)
    print(f"table: {len(nodes)} rows, step {step} days, worst {worst:.0f} km, {len(out)} bytes")

    # the fixture: states at times on no row, and Horizons' own elements and distances
    times = [to_jd(t) for t in FIXTURE_TIMES]
    fixture = {"times": times, "sun": hz.ask(TARGET, "500@10", times=times), "earth": hz.ask(TARGET, "500@399", times=times), "mars": hz.ask(TARGET, "500@499", times=times),
               "elements": hz.ask(TARGET, "500@10", "ELEMENTS", times=times), "table": {"step": step, "rows": len(nodes), "worstKm": round(worst)}}
    if approaches:
        fixture["approachTimes"] = approaches
        fixture["approachEarth"] = hz.ask(TARGET, "500@399", times=approaches["earth"]) if approaches.get("earth") else []
        fixture["approachMars"] = hz.ask(TARGET, "500@499", times=approaches["mars"]) if approaches.get("mars") else []
    json.dump(fixture, open(os.path.join(root, "test", "data", "roadster-horizons.json"), "w"))
    print(f"fixture written; {hz.requests} requests to Horizons this run")


main()
