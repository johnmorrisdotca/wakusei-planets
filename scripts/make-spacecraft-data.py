#!/usr/bin/env python3
"""Writes src/craft/<craft>.ts and test/data/spacecraft-horizons.json: ten spacecraft from JPL Horizons (https://ssd.jpl.nasa.gov/api/horizons.api, VECTORS, heliocentric,
ecliptic and equinox J2000, km and km/s, TDB), over the whole span each craft's own record covers, as Chebyshev segments of varying length.

The record's start and stop are read from Horizons itself (the message it gives for a time outside the record). Samples start on a coarse grid; a segment is grown until a
polynomial fitted to every other sample misses the samples in between by more than the limit, or their speed by more than SPEED_LIMIT of the speed (and the degree is then
lowered as far as it will go). Where even the shortest segment fails, Horizons is asked for a denser grid there and the fit is run again. The limit on each sample is
LIMIT_KM (1,000 km) within NEAR_DAYS of a planet or target the craft flew past, and in orbit round Saturn, Jupiter or Mars; elsewhere the larger of LIMIT_KM and
RELATIVE_LIMIT (1e-6, about 0.2 arc-seconds seen from the Sun) of the distance from the Sun. Coefficients are rounded to whole kilometres.
Afterwards fresh samples at random times (never on the fitting grid) are fetched to measure the table and to write the test fixture.

Usage: python3 -I scripts/make-spacecraft-data.py [--cache DIR] [--flybys-only] [craft ...]   (needs the network; one request at a time, a pause between requests, stops on any error;
--cache keeps every answer so a stopped run resumes without asking again)"""
import bisect, datetime, hashlib, json, math, os, random, re, sys, time, urllib.parse, urllib.request

SOURCE = "https://ssd.jpl.nasa.gov/api/horizons.api"
UNIX_EPOCH_JD = 2440587.5
PAUSE = 1.2
UA = {"User-Agent": "wakusei-planets-data-build/1.0 (john@johnmorris.ca)"}  # the Solar System Dynamics terms ask for a User-Agent naming the product, its version and a contact
LIMIT_KM = 1000.0
RELATIVE_LIMIT = 1e-6
SPEED_LIMIT = float(os.environ.get('SPEED_LIMIT', '0.01'))
SAFETY = 0.85
NEAR_DAYS = 10.0
PAD = 2
MIN_SAMPLES = 12
JUMP_SECONDS = 120.0
JUMP_KM = 500.0
SPEED_FLOOR_SECONDS = 5.0
REFINE = 8
MAX_ROWS = 2500
DEBUG = None

# name: Horizons id, coarse grid [(from, to, hours between samples)] (the first and last are clipped to the record), highest degree, flybys and orbits [(label, Horizons id of the body, approximate UTC)],
# orbits [(Horizons id of the body, from, to)] where the limit stays 1,000 km all the way round
CRAFT = {
    "voyager1": ("-31", [("1977", "2100", 240)], 10, [("Jupiter", "599", "1979-03-05 12:05"), ("Saturn", "699", "1980-11-12 23:46")], []),
    "voyager2": ("-32", [("1977", "2100", 240)], 10, [("Jupiter", "599", "1979-07-09 22:29"), ("Saturn", "699", "1981-08-26 03:24"), ("Uranus", "799", "1986-01-24 17:59"), ("Neptune", "899", "1989-08-25 03:56")], []),
    "newhorizons": ("-98", [("2006", "2050", 120)], 10, [("APL", "132524;", "2006-06-13 04:05"), ("Jupiter", "599", "2007-02-28 05:43"), ("Pluto", "999", "2015-07-14 11:50"), ("Arrokoth", "486958;", "2019-01-01 05:33")], []),
    "pioneer10": ("-23", [("1972", "2050", 240)], 10, [("Jupiter", "599", "1973-12-04 02:26")], []),
    "pioneer11": ("-24", [("1973", "2050", 240)], 10, [("Jupiter", "599", "1974-12-03 05:21"), ("Saturn", "699", "1979-09-01 16:31")], []),
    "cassini": ("-82", [("1997", "2004-05-01", 24), ("2004-05-01", "2018", 0.5)], 10, [("Venus", "299", "1998-04-26 13:49"), ("Venus", "299", "1999-06-24 20:19"), ("Earth", "399", "1999-08-18 03:28"), ("Jupiter", "599", "2000-12-30 10:00"), ("Saturn", "699", "2004-07-01 02:50")], [("699", "2004-06-01", "2017-09-16")]),
    "galileo": ("-77", [("1989", "1995-10-01", 12), ("1995-10-01", "2004", 2)], 10, [("Venus", "299", "1990-02-10 05:58"), ("Earth", "399", "1990-12-08 20:35"), ("Gaspra", "951;", "1991-10-29 22:37"), ("Earth", "399", "1992-12-08 15:09"), ("Ida", "243;", "1993-08-28 16:52"), ("Jupiter", "599", "1995-12-07 23:00")], [("599", "1995-12-01", "2003-09-22")]),
    "juno": ("-61", [("2011", "2016-06-01", 24), ("2016-06-01", "2029", 1)], 10, [("Earth", "399", "2013-10-09 19:21"), ("Jupiter", "599", "2016-07-05 02:47")], [("599", "2016-06-20", "2029")]),
    "parker": ("-96", [("2018", "2030", 6)], 10, [("Venus", "299", "2018-10-03 08:44"), ("Venus", "299", "2019-12-26 18:14"), ("Venus", "299", "2020-07-11 03:22"), ("Venus", "299", "2021-02-20 08:19"), ("Venus", "299", "2021-10-16 07:04"), ("Venus", "299", "2023-08-21 14:54"), ("Venus", "299", "2024-11-06 03:46")], []),
    "webb": ("-170", [("2021", "2032", 24)], 10, [], []),
    # the deep-space craft added 2026-11-11 (flyby dates are only where to look: the closest approach is found from Horizons within 3 days of them)
    "bepicolombo": ("-121", [("2018", "2028", 24)], 10, [("Earth", "399", "2020-04-10 04:25"), ("Venus", "299", "2020-10-15 03:58"), ("Venus", "299", "2021-08-10 13:51"), ("Mercury", "199", "2021-10-01 23:34"), ("Mercury", "199", "2022-06-23 09:44"), ("Mercury", "199", "2023-06-19 18:34"), ("Mercury", "199", "2024-09-04 21:48"), ("Mercury", "199", "2024-12-02 00:00"), ("Mercury", "199", "2025-01-08 05:59")], []),
    "psyche": ("-255", [("2023", "2030", 24)], 10, [("Mars", "499", "2026-05-15 19:00")], []),
    "europaclipper": ("-159", [("2024", "2035", 24)], 10, [("Mars", "499", "2025-03-01 17:00"), ("Earth", "399", "2026-12-03 12:00")], []),
    "lucy": ("-49", [("2021", "2034", 24)], 10, [("Earth", "399", "2022-10-16 06:00"), ("Dinkinesh", "152830;", "2023-11-01 17:00"), ("Earth", "399", "2024-12-12 12:00"), ("Donaldjohanson", "52246;", "2025-04-20 12:00"), ("Eurybates", "3548;", "2027-08-12 12:00"), ("Polymele", "15094;", "2027-09-15 12:00"), ("Leucus", "11351;", "2028-04-18 12:00"), ("Orus", "21900;", "2028-11-11 12:00"), ("Patroclus", "617;", "2033-03-02 12:00")], []),
    "juice": ("-28", [("2023", "2032", 24)], 10, [("Moon", "301", "2024-08-19 21:16"), ("Earth", "399", "2024-08-20 21:57"), ("Venus", "299", "2025-08-31 04:00"), ("Earth", "399", "2026-09-29 12:00"), ("Earth", "399", "2029-01-18 12:00")], []),
    "hayabusa2": ("-37", [("2014", "2028", 24)], 10, [("Earth", "399", "2015-12-03 10:08"), ("Earth", "399", "2020-12-06 06:00")], []),
    "osirisapex": ("-64", [("2016", "2031", 24)], 10, [("Earth", "399", "2017-09-22 16:52"), ("Earth", "399", "2023-09-24 15:00")], []),
    "solarorbiter": ("-144", [("2020", "2031", 12)], 10, [("Venus", "299", "2020-12-27 12:00"), ("Venus", "299", "2021-08-09 12:00"), ("Earth", "399", "2021-11-27 12:00"), ("Venus", "299", "2022-09-04 12:00"), ("Venus", "299", "2025-02-18 12:00"), ("Venus", "299", "2026-12-24 12:00"), ("Venus", "299", "2030-09-03 03:00")], []),
}

JD0 = datetime.datetime(1970, 1, 1, tzinfo=datetime.timezone.utc)


def to_jd(text):
    """'2004-07-01 02:50', '1995' or '1977-SEP-05 13:59:24.3830' as a Julian date (the clock's own scale; the difference between UTC and TDB is under two minutes)."""
    text = text.strip()
    m = re.match(r"(\d{4})-([A-Z]{3})-(\d\d) (\d\d):(\d\d):(\d\d(?:\.\d+)?)", text)
    if m:
        month = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"].index(m.group(2)) + 1
        when = datetime.datetime(int(m.group(1)), month, int(m.group(3)), int(m.group(4)), int(m.group(5)), tzinfo=datetime.timezone.utc)
        return (when - JD0).total_seconds() / 86400 + UNIX_EPOCH_JD + float(m.group(6)) / 86400
    parts = [int(p) for p in re.split(r"[-: ]", text)] + [1, 1, 0, 0][len(re.split(r"[-: ]", text)) - 1:]
    return (datetime.datetime(*parts[:5], tzinfo=datetime.timezone.utc) - JD0).total_seconds() / 86400 + UNIX_EPOCH_JD


class Horizons:
    def __init__(self, cache):
        self.cache = cache
        self.last = 0.0
        self.requests = 0

    def ask(self, command, center, *, start=None, stop=None, step=None, times=None, table="2"):
        params = {"format": "json", "COMMAND": f"'{command}'", "OBJ_DATA": "'NO'", "MAKE_EPHEM": "'YES'", "EPHEM_TYPE": "'VECTORS'", "CENTER": f"'{center}'", "REF_PLANE": "'ECLIPTIC'",
                  "REF_SYSTEM": "'ICRF'", "OUT_UNITS": "'KM-S'", "VEC_TABLE": f"'{table}'", "CSV_FORMAT": "'YES'", "TIME_TYPE": "'TDB'"}
        if times is not None:
            params["TLIST_TYPE"] = "'JD'"
            params["TLIST"] = "'" + "' '".join(f"{t:.7f}" for t in times) + "'"
        else:
            if stop <= start or (stop - start) * 86400 / int(step) < 1.0:
                raise SystemExit(f"{command}: asked for steps of {(stop - start) * 86400 / int(step):.3f} s between JD {start} and {stop}")
            params.update({"START_TIME": f"'JD {start:.9f}'", "STOP_TIME": f"'JD {stop:.9f}'", "STEP_SIZE": f"'{step}'"})
        query = urllib.parse.urlencode(params)
        key = None
        if self.cache:
            key = os.path.join(self.cache, re.sub(r"[^A-Za-z0-9._-]", "_", query)[:200] + "." + hashlib.md5(query.encode()).hexdigest()[:12] + ".json")
            if os.path.exists(key):
                return json.load(open(key))
        wait = PAUSE - (time.time() - self.last)
        if wait > 0:
            time.sleep(wait)
        text = json.load(urllib.request.urlopen(urllib.request.Request(SOURCE + "?" + query, headers=UA), timeout=300)).get("result", "")
        self.last = time.time()
        self.requests += 1
        if "$$SOE" not in text:
            if self.cache and key is not None and "No ephemeris" in text:
                pass
            raise SystemExit(f"Horizons gave no rows ({command} from {center}): {text.strip()[:300]}")
        rows = []
        for line in text.split("$$SOE")[1].split("$$EOE")[0].strip().split("\n"):
            p = line.split(",")
            rows.append([float(p[0])] + [float(v) for v in p[2:8]])
        if key:
            json.dump(rows, open(key, "w"))
        return rows

    def record(self, command):
        """The first and last instants of a craft's record, from the messages Horizons gives for times outside it."""
        found = []
        for when, word in (("1900-01-01", "prior to"), ("2900-01-01", "after")):
            query = urllib.parse.urlencode({"format": "json", "COMMAND": f"'{command}'", "OBJ_DATA": "'NO'", "MAKE_EPHEM": "'YES'", "EPHEM_TYPE": "'VECTORS'", "CENTER": "'500@10'", "TIME_TYPE": "'TDB'",
                                            "START_TIME": f"'{when}'", "STOP_TIME": f"'{when} 01:00'", "STEP_SIZE": "'1 h'"})
            path = os.path.join(self.cache, f"record{command}{word.replace(' ', '')}.txt") if self.cache else None
            if path and os.path.exists(path):
                text = open(path).read()
            else:
                wait = PAUSE - (time.time() - self.last)
                if wait > 0:
                    time.sleep(wait)
                text = json.load(urllib.request.urlopen(urllib.request.Request(SOURCE + "?" + query, headers=UA), timeout=120)).get("result", "")
                self.last = time.time()
                if path:
                    open(path, "w").write(text)
            m = re.search(word + r" A\.D\. (\S+ \S+) TDB", text)
            if not m:
                raise SystemExit(f"{command}: no record edge in: {text.strip()[:300]}")
            found.append((to_jd(m.group(1)), m.group(1)))
        return found


def chebyshev(x, n):
    t = [1.0, x]
    for _ in range(2, n + 1):
        t.append(2 * x * t[-1] - t[-2])
    return t[: n + 1]


def clenshaw(c, x):
    b1 = b2 = 0.0
    for k in range(len(c) - 1, 0, -1):
        b1, b2 = 2 * x * b1 - b2 + c[k], b1
    return x * b1 - b2 + c[0]


def derivative(c):
    """The coefficients of the derivative with respect to x."""
    n = len(c)
    d = [0.0] * (n + 1)
    for k in range(n - 1, 0, -1):
        d[k - 1] = d[k + 1] + 2 * k * c[k]
    d[0] /= 2
    return d[: max(n - 1, 1)]


def solve(a, rhs):
    n = len(a)
    m = [a[i][:] + rhs[i] for i in range(n)]
    for c in range(n):
        pivot = max(range(c, n), key=lambda r: abs(m[r][c]))
        m[c], m[pivot] = m[pivot], m[c]
        for r in range(c + 1, n):
            f = m[r][c] / m[c][c]
            if f:
                m[r] = [u - f * v for u, v in zip(m[r], m[c])]
    out = [None] * n
    for i in range(n - 1, -1, -1):
        out[i] = [(m[i][n + k] - sum(m[i][j] * out[j][k] for j in range(i + 1, n))) / m[i][i] for k in range(len(rhs[0]))]
    return out


def fit(xs, ps, degree):
    """Chebyshev coefficients for x, y and z: least squares over samples (x in -1..1, position). Uses T_i T_j = (T_(i+j) + T_|i-j|) / 2, so the cost is one pass over the samples."""
    sums = [0.0] * (2 * degree + 1)
    rhs = [[0.0] * 3 for _ in range(degree + 1)]
    for x, p in zip(xs, ps):
        t = chebyshev(x, 2 * degree)
        for k in range(2 * degree + 1):
            sums[k] += t[k]
        for i in range(degree + 1):
            ti = t[i]
            r = rhs[i]
            r[0] += ti * p[0]
            r[1] += ti * p[1]
            r[2] += ti * p[2]
    normal = [[(sums[i + j] + sums[abs(i - j)]) / 2 for j in range(degree + 1)] for i in range(degree + 1)]
    solved = solve(normal, rhs)
    return [[solved[i][axis] for i in range(degree + 1)] for axis in range(3)]


class Samples:
    """Rows sorted by time, with the limit that applies at each."""

    def __init__(self, windows):
        self.t, self.p, self.v, self.limit = [], [], [], []
        self.windows = windows

    def limit_at(self, jd, r):
        for a, b in self.windows:
            if a <= jd <= b:
                return LIMIT_KM
        return max(LIMIT_KM, RELATIVE_LIMIT * r)

    def add(self, rows):
        have = set(round(t * 1e6) for t in self.t)
        fresh = [r for r in rows if round(r[0] * 1e6) not in have]
        merged = sorted(list(zip(self.t, self.p, self.v)) + [(r[0], r[1:4], r[4:7]) for r in fresh], key=lambda s: s[0])
        self.t = [s[0] for s in merged]
        self.p = [s[1] for s in merged]
        self.v = [s[2] for s in merged]
        self.limit = [self.limit_at(t, math.hypot(*p)) for t, p in zip(self.t, self.p)]


def check(S, a, b, e0, e1, coefficients, held_only):
    """The worst ratio of error to limit, in position and in speed, over the samples a..b (the odd ones only when held_only), and the worst position error in km."""
    ratio = 0.0
    worst = 0.0
    speed = 0.0
    watch_speed = b == a or (S.t[b] - S.t[a]) * 86400 / (b - a) >= SPEED_FLOOR_SECONDS
    dc = [derivative(c) for c in coefficients]
    half = (e1 - e0) / 2
    for i in range(a, b + 1):
        if held_only and ((i - a) % 2 == 0 or i == b):
            continue
        x = 2 * (S.t[i] - S.t0) * 86400 / (e1 - e0) - (e1 + e0) / (e1 - e0)
        miss = math.dist([clenshaw(c, x) for c in coefficients], S.p[i])
        worst = max(worst, miss)
        ratio = max(ratio, miss / S.limit[i])
        v = [clenshaw(c, x) / half for c in dc]
        sp = math.hypot(*S.v[i])
        if watch_speed:
            speed = max(speed, math.dist(v, S.v[i]) / max(SPEED_LIMIT * sp, 1e-9))
    return ratio, speed, worst


def roundto(c, seconds, degree):
    """A coefficient to the precision that keeps the speed within about a millimetre per second: whole kilometres in a long segment, metres in a short one."""
    places = max(0, math.ceil(-math.log10(0.0005 * seconds / (2 * (degree + 1) ** 2))))
    return int(round(c)) if places == 0 else round(c, places)


def attempt(S, a, b, degree, e0, e1):
    fit_ids = [i for i in range(a, b + 1) if (i - a) % 2 == 0 or i == b]
    degree = max(1, min(degree, len(fit_ids) // 2))
    xs = [2 * (S.t[i] - S.t0) * 86400 / (e1 - e0) - (e1 + e0) / (e1 - e0) for i in fit_ids]
    coefficients = fit(xs, [S.p[i] for i in fit_ids], degree)
    ratio, speed, worst = check(S, a, b, e0, e1, coefficients, False)
    return coefficients, max(ratio / SAFETY, speed), worst


def jumps(S):
    """Indices of samples that start a new piece of Horizons' record: close to the one before in time, yet not where its position and velocity say it should be."""
    out = set()
    for i in range(1, len(S.t)):
        dt = (S.t[i] - S.t[i - 1]) * 86400
        if dt <= JUMP_SECONDS:
            guess = [S.p[i - 1][k] + dt * (S.v[i - 1][k] + S.v[i][k]) / 2 for k in range(3)]
            if math.dist(guess, S.p[i]) > JUMP_KM:
                out.add(i)
    return out


def segment_from(S, a, degree, cut):
    """The longest segment starting at sample a that does not run over a jump: (last sample, start edge, end edge, coefficients, failed, where the next one starts)."""
    n = len(S.t)
    sec = lambda i: round((S.t[i] - S.t0) * 86400)
    wall = min([k for k in cut if k > a] + [n])
    most = wall - a
    edge = lambda b: sec(b + 1) if b + 1 in cut else sec(b)
    nxt = lambda b: b + 1 if b + 1 in cut else b
    if most == 1:
        c = [[roundto(S.p[a][k], edge(a) - sec(a), 1)] for k in range(3)]
        return a, sec(a), edge(a), c, False, nxt(a)
    minimum = min(MIN_SAMPLES, most)

    def ok(count):
        b = a + count - 1
        e0, e1 = sec(a), edge(b)
        if e1 <= e0:
            return None
        return attempt(S, a, b, degree, e0, e1)

    first = ok(minimum)
    if first is None or first[1] > 1.0:
        b = a + minimum - 1
        return b, sec(a), edge(b), first[0] if first else None, True, nxt(b)
    lo, hi = minimum, None
    count = minimum
    while count < most:
        count = min(count * 2, most)
        r = ok(count)
        if r is not None and r[1] <= 1.0:
            lo = count
        else:
            hi = count
            break
    if hi is None:
        hi = lo
    while hi - lo > max(2, lo // 20):
        mid = (lo + hi) // 2
        r = ok(mid)
        if r is not None and r[1] <= 1.0:
            lo = mid
        else:
            hi = mid
    b = a + lo - 1
    e0, e1 = sec(a), edge(b)
    low, high = 1, degree
    while high - low > 1:
        mid = (low + high) // 2
        r = attempt(S, a, b, mid, e0, e1)
        if r[1] <= 1.0:
            high = mid
        else:
            low = mid
    for d in range(high, degree + 3):
        coefficients, score, worst = attempt(S, a, b, d, e0, e1)
        rounded = [[roundto(c, e1 - e0, d) for c in axis] for axis in coefficients]
        ratio, speed, worst = check(S, a, b, e0, e1, rounded, False)
        if ratio <= 1.0 and speed <= 1.0:
            while len(rounded[0]) > 1 and all(axis[-1] == 0 for axis in rounded):
                rounded = [axis[:-1] for axis in rounded]
            return b, e0, e1, rounded, False, nxt(b)
    return b, e0, e1, [[roundto(c, e1 - e0, high) for c in axis] for axis in coefficients], True, nxt(b)


def segmentation(S, degree, kept):
    """Cut the samples into segments. `kept` maps a start time to a segment found before whose samples have not changed."""
    n = len(S.t)
    cut = jumps(S)
    S.cut = sorted(S.t[i] for i in cut)
    segments, failures = [], []
    a = 0
    while a < n - 1:
        old = kept.get(S.t[a])
        if old is not None and old["b_t"] in S.index and old["next_t"] in S.index and not old["failed"]:
            b = S.index[old["b_t"]]
            if b - a + 1 == old["count"] and S.index[old["next_t"]] == (b + 1 if b + 1 in cut else b):
                segments.append(old)
                a = S.index[old["next_t"]]
                continue
        b, e0, e1, coefficients, failed, nxt = segment_from(S, a, degree, cut)
        seg = {"a_t": S.t[a], "b_t": S.t[b], "next_t": S.t[nxt], "count": b - a + 1, "e0": e0, "e1": e1, "coefficients": coefficients, "failed": failed}
        segments.append(seg)
        if failed:
            failures.append((a, b))
        else:
            kept[S.t[a]] = seg
        a = nxt
    return segments, failures


def build(horizons, name, spec, log):
    code, grid, degree, flybys, orbits = spec
    degree = int(os.environ.get("DEGREE", degree))
    (first, first_text), (last, last_text) = horizons.record(code)
    log(f"{name}: Horizons record {first_text} to {last_text} TDB")
    first, last = first + 1 / 86400, last - 1 / 86400
    if DEBUG:
        first, last = to_jd(DEBUG[0]), to_jd(DEBUG[1])
    windows = []
    for _, _, when in flybys:
        c = to_jd(when)
        windows.append((c - NEAR_DAYS, c + NEAR_DAYS))
    for _, a, b in orbits:
        windows.append((to_jd(a), to_jd(b)))
    S = Samples(windows)
    S.t0 = first
    for a, b, hours in grid:
        lo, hi = max(to_jd(a), first), min(to_jd(b), last)
        if hi <= lo:
            continue
        steps = max(1, round((hi - lo) * 24 / hours))
        pieces = math.ceil(steps / MAX_ROWS)
        for k in range(pieces):
            s0 = lo + (hi - lo) * k / pieces
            s1 = lo + (hi - lo) * (k + 1) / pieces
            S.add(horizons.ask(code, "500@10", start=s0, stop=s1, step=max(1, round(steps / pieces))))
    S.index = {t: i for i, t in enumerate(S.t)}
    for _, _, when in flybys:
        c = to_jd(when)
        for half, hours in ((NEAR_DAYS, 12), (3.0, 2)):
            lo, hi = max(c - half, first), min(c + half, last)
            if hi > lo:
                S.add(horizons.ask(code, "500@10", start=lo, stop=hi, step=max(1, round((hi - lo) * 24 / hours))))
    S.index = {t: i for i, t in enumerate(S.t)}
    kept = {}
    for round_number in range(16):
        segments, failures = segmentation(S, degree, kept)
        log(f"{name}: pass {round_number}: {len(S.t)} samples, {len(segments)} segments, {len(failures)} places to refine, {horizons.requests} requests so far")
        if not failures:
            break
        if round_number == 15:
            raise SystemExit(f"{name}: still failing after 16 passes at {S.t[failures[0][0]]}")
        runs = []
        for a, b in failures:
            lo, hi = max(a - PAD * MIN_SAMPLES, 0), min(b + PAD * MIN_SAMPLES, len(S.t) - 1)
            if runs and lo <= runs[-1][1]:
                runs[-1][1] = max(runs[-1][1], hi)
            else:
                runs.append([lo, hi])
        requests = []
        ranges = [(S.t[lo], S.t[hi]) for lo, hi in runs]
        for lo, hi in runs:
            gaps = [S.t[i + 1] - S.t[i] for i in range(lo, hi)]
            widest = max(gaps)
            i = 0
            while i < len(gaps):
                if gaps[i] < widest * 0.5:
                    i += 1
                    continue
                j = i
                while j < len(gaps) and gaps[j] >= widest * 0.5 and j - i < MAX_ROWS // REFINE:
                    j += 1
                if widest * 86400 / REFINE >= 2.0:
                    requests.append((S.t[lo + i], S.t[lo + j], (j - i) * REFINE))
                i = j
        for start, stop, steps in requests:
            S.add(horizons.ask(code, "500@10", start=start, stop=stop, step=steps))
        S.index = {t: i for i, t in enumerate(S.t)}
        kept = {t: s for t, s in kept.items() if not any(s["a_t"] <= hi and lo <= s["b_t"] for lo, hi in ranges)}
    for i in sorted(jumps(S)):
        dt = (S.t[i] - S.t[i - 1]) * 86400
        guess = [S.p[i - 1][k] + dt * (S.v[i - 1][k] + S.v[i][k]) / 2 for k in range(3)]
        log(f"  join {name} JD {S.t[i]:.6f} = {to_iso(S.t[i])}: {math.dist(guess, S.p[i]):.0f} km")
    return S, segments, first, last, windows


def relative(horizons, craft, body, **when):
    """The craft's rows seen from a body: from Horizons' own centre for a planet, and the difference of two heliocentric answers for a small body (its id ends in a semicolon)."""
    if not body.endswith(";"):
        return horizons.ask(craft, f"500@{body}", **when)
    mine = horizons.ask(craft, "500@10", **when)
    theirs = horizons.ask(body, "500@10", **when)
    return [[a[0]] + [x - y for x, y in zip(a[1:7], b[1:7])] for a, b in zip(mine, theirs)]


def flybys_of(horizons, name, first, last):
    """Where Horizons puts each flyby's closest approach, and the body's state then: the craft's heliocentric state less its state seen from the body. Horizons' own planetary ephemeris differs from the one a
    craft's trajectory was built on by a few thousand km at Uranus, so the planet is placed where that trajectory has it."""
    out = []
    for label, body, when in CRAFT[name][3]:
        centre = to_jd(when)
        rows = relative(horizons, CRAFT[name][0], body, start=centre - 3.0, stop=centre + 3.0, step=4320)
        ranges = [math.hypot(*r[1:4]) for r in rows]
        k = min(max(ranges.index(min(ranges)), 1), len(rows) - 2)
        if ranges.index(min(ranges)) in (0, len(rows) - 1):
            raise SystemExit(f"{name}: the closest approach to {label} is at the edge of the window round {when}: the date given is more than 3 days out")
        a0, a1, a2 = ranges[k - 1], ranges[k], ranges[k + 1]
        jd = rows[k][0] + 0.5 * (a0 - a2) / (a0 - 2 * a1 + a2) * (rows[k + 1][0] - rows[k][0])
        seen = relative(horizons, CRAFT[name][0], body, times=[jd])[0]
        craft = horizons.ask(CRAFT[name][0], "500@10", times=[jd])[0]
        state = [0] + [c - r for c, r in zip(craft[1:7], seen[1:7])]
        print(f"  flyby {name} {label}: closest approach JD {jd:.5f} = {to_iso(jd)} UTC-ish, {math.hypot(*seen[1:4]):.0f} km from the centre", flush=True)
        out.append({"craft": name, "body": label, "horizons": body, "jd": round(jd, 7), "distanceKm": round(math.hypot(*seen[1:4])), "bodyState": [round(v, 3) for v in state[1:7]], "inRecord": first <= jd <= last})
    return out


def to_iso(jd):
    return (JD0 + datetime.timedelta(days=jd - UNIX_EPOCH_JD)).strftime("%Y-%m-%d %H:%M")


def evaluate(table, jd):
    """Position, speed of the table at a Julian date (TDB)."""
    t = (jd - table["jd0"]) * 86400
    edges = table["edges"]
    k = min(max(bisect.bisect_right(edges, t) - 1, 0), len(edges) - 2)
    e0, e1 = edges[k], edges[k + 1]
    x = 2 * (t - e0) / (e1 - e0) - 1
    c = table["segments"][k]
    p = [clenshaw(axis, x) for axis in c]
    v = [clenshaw(derivative(axis), x) * 2 / (e1 - e0) for axis in c]
    return p, v


def main():
    args = sys.argv[1:]
    cache = None
    chosen = []
    flybys_only = False
    while args:
        a = args.pop(0)
        if a == "--cache":
            cache = args.pop(0)
            os.makedirs(cache, exist_ok=True)
        elif a == "--flybys-only":
            flybys_only = True
        elif a == "--debug":
            global DEBUG
            DEBUG = args.pop(0).split(":")
        else:
            chosen.append(a)
    names = chosen or list(CRAFT)
    horizons = Horizons(cache)
    log = lambda *m: print(*m, flush=True)
    if flybys_only:
        path = "test/data/spacecraft-horizons.json"
        old = json.load(open(path))
        old["flybys"] = [f for f in old["flybys"] if f["craft"] not in names]
        for name in names:
            (first, _), (last, _) = horizons.record(CRAFT[name][0])
            old["flybys"] += flybys_of(horizons, name, first + 1 / 86400, last - 1 / 86400)
        json.dump(old, open(path, "w"), indent=None, separators=(",", ":"))
        log(f"wrote {path}")
        return
    fixture = {"source": SOURCE, "frame": "heliocentric, ecliptic and equinox J2000", "units": "km and km/s", "time": "Julian date, TDB", "craft": {}, "flybys": []}
    report = {}
    for name in names:
        S, segments, first, last, windows = build(horizons, name, CRAFT[name], log)
        if DEBUG:
            coefs = sum(len(s["coefficients"][0]) * 3 for s in segments)
            log(f"{name}: debug span: {len(segments)} segments, {coefs} coefficients, lengths in s {sorted(s['e1'] - s['e0'] for s in segments)[::max(1, len(segments) // 8)]}")
            continue
        edges = [segments[0]["e0"]] + [s["e1"] for s in segments]
        table = {"jd0": S.t0, "edges": edges, "segments": [s["coefficients"] for s in segments]}
        held = []
        everything = 0.0
        worst_speed = 0.0
        for k, s in enumerate(segments):
            e0, e1 = s["e0"], s["e1"]
            a, b = S.index[s["a_t"]], S.index[s["b_t"]]
            _, _, worst_here = check(S, a, b, e0, e1, s["coefficients"], True)
            held.append(worst_here)
            _, _, w = check(S, a, b, e0, e1, s["coefficients"], False)
            everything = max(everything, w)
        # fresh samples at random times, never on the fitting grid
        rng = random.Random(name)
        near = [(a, b) for a, b in windows]
        times = [first + (last - first) * rng.random() for _ in range(160)]
        for _ in range(80):
            if near:
                a, b = rng.choice(near)
                times.append(min(max(a + (b - a) * rng.random(), first), last))
        times = sorted(set(times))
        fresh = []
        for i in range(0, len(times), 40):
            fresh += horizons.ask(CRAFT[name][0], "500@10", times=times[i:i + 40])
        fresh_worst = 0.0
        fresh_speed = 0.0
        for row in fresh:
            p, v = evaluate(table, row[0])
            fresh_worst = max(fresh_worst, math.dist(p, row[1:4]))
            fresh_speed = max(fresh_speed, math.dist(v, row[4:7]))
        fresh_rel = max(math.dist(evaluate(table, r[0])[0], r[1:4]) / math.hypot(*r[1:4]) for r in fresh)
        report[name] = dict(segments=len(segments), samples=len(S.t), held=max(held), everything=everything, fresh=fresh_worst, fresh_speed=fresh_speed, fresh_arcsec=math.degrees(fresh_rel) * 3600)
        log(f"{name}: {len(segments)} segments, {sum(len(c[0]) for c in table['segments'])} coefficients per axis; worst on held-back fit samples {max(held):.0f} km, on all fit samples {everything:.0f} km; "
            f"on {len(fresh)} fresh samples {fresh_worst:.0f} km, {fresh_rel:.2e} of the distance from the Sun ({math.degrees(fresh_rel) * 3600:.2f} arc-seconds), speed {fresh_speed * 1000:.1f} m/s")
        # the fixture: twelve of the fresh samples, spread over the record and the hard places
        pick = fresh[:: max(1, len(fresh) // 12)][:12]
        fixture["craft"][name] = [[round(r[0], 7)] + [round(v, 3) for v in r[1:7]] for r in pick]
        write_table(name, table, first, last, report[name])
        fixture["flybys"] += flybys_of(horizons, name, first, last)
        # the fixture is written after each craft, so a stopped run keeps what it has done
        path = "test/data/spacecraft-horizons.json"
        old = json.load(open(path)) if os.path.exists(path) and chosen else {"craft": {}, "flybys": []}
        old["craft"].update(fixture["craft"])
        old["flybys"] = [f for f in old["flybys"] if f["craft"] not in names] + fixture["flybys"]
        json.dump({**fixture, "craft": old["craft"], "flybys": old["flybys"]}, open(path, "w"), indent=None, separators=(",", ":"))
        log(f"wrote {path}; {horizons.requests} requests")
    json.dump(report, open(os.path.join(cache or ".", "spacecraft-report.json"), "w"), indent=1)


def write_table(name, table, first, last, stats):
    segments = table["segments"]
    start_ms = round((table["jd0"] - UNIX_EPOCH_JD) * 86400000)
    lines = [
        f"// Made by scripts/make-spacecraft-data.py from JPL Horizons (https://ssd.jpl.nasa.gov/api/horizons.api): {name}, heliocentric, ecliptic and equinox J2000, in km, TDB (taken as terrestrial time).",
        f"// {len(segments)} Chebyshev segments over the whole of Horizons' record ({first:.5f} to {last:.5f} JD); the limit is {LIMIT_KM:.0f} km near a planet and {RELATIVE_LIMIT:g} of the distance from the Sun elsewhere; "
        f"measured on {stats['samples']} samples: worst {stats['held']:.0f} km on those held back from the fit, {stats['fresh']:.0f} km on fresh samples at random times. Do not edit by hand.",
        'import { registerCraft } from "../data/craft.ts";',
        "",
        f'registerCraft("{name}", {{ start: {start_ms}, worst: {max(stats["held"], stats["fresh"]):.0f}, edges: [{",".join(str(e) for e in table["edges"])}], segments: [',
    ]
    for coefficients in segments:
        lines.append("  [" + ",".join("[" + ",".join(str(c) for c in axis) + "]" for axis in coefficients) + "],")
    lines.append("] });")
    os.makedirs("src/craft", exist_ok=True)
    open(f"src/craft/{name}.ts", "w").write("\n".join(lines) + "\n")
    print(f"wrote src/craft/{name}.ts", flush=True)


if __name__ == "__main__":
    main()
