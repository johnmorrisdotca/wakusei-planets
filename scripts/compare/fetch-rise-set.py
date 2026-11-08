"""Optional network refresh of the checked-in JPL rise and set reference (scripts/compare/horizons-rise-set.json).

No library under comparison is used. JPL Horizons gives the apparent, airless, topocentric elevation of the
Sun's and the Moon's centres (and the Moon's angular diameter) every 5 minutes; the crossings are found on a
cubic through the four nearest samples (the interpolation error is far below a millisecond).
The definitions are the usual almanac ones, the same for every package:
  Sun: the centre 0.833 degrees below the airless horizon (34' of refraction plus a fixed 16' radius).
  Moon: the upper limb 34' below the airless horizon (the centre at -34' minus the topocentric radius).
"""
import json, pathlib, time, urllib.parse, urllib.request
from datetime import datetime, timedelta, timezone

root = pathlib.Path(__file__).resolve().parents[2]
SOURCE = 'https://ssd.jpl.nasa.gov/api/horizons.api'
SITES = {
    'london': (51.4779, -0.0015),
    'toronto': (43.6532, -79.3832),
    'tokyo': (35.6895, 139.6917),
    'quito': (-0.1807, -78.4678),
    'sydney': (-33.8688, 151.2093),
    'tromso': (69.6492, 18.9553),
}
DATES = ['2000-01-01', '2026-03-20', '2026-06-21', '2026-09-23', '2026-11-08', '2026-12-21', '2040-07-01']
STEP_MIN = 5
# the UTC window fetched around each date: wide enough for any package's day (solar or UTC) at any longitude
BEFORE_H, AFTER_H = 14, 38


def jd_to_iso(jd):
    ms = round((jd - 2440587.5) * 86400000)
    return datetime.fromtimestamp(ms / 1000, timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def fetch(code, lat, lon, start, stop):
    query = {
        'format': 'json', 'OBJ_DATA': "'NO'", 'MAKE_EPHEM': "'YES'", 'EPHEM_TYPE': "'OBSERVER'", 'TIME_TYPE': "'UT'",
        'CENTER': "'coord@399'", 'COORD_TYPE': "'GEODETIC'", 'SITE_COORD': f"'{lon},{lat},0'", 'QUANTITIES': "'4,13'",
        'APPARENT': "'AIRLESS'", 'ANG_FORMAT': "'DEG'", 'EXTRA_PREC': "'YES'", 'CSV_FORMAT': "'YES'", 'CAL_FORMAT': "'JD'",
        'START_TIME': f"'{start:%Y-%m-%d %H:%M}'", 'STOP_TIME': f"'{stop:%Y-%m-%d %H:%M}'", 'STEP_SIZE': f"'{STEP_MIN} m'",
        'COMMAND': f"'{code}'",
    }
    for attempt in range(4):
        try:
            data = json.load(urllib.request.urlopen(SOURCE + '?' + urllib.parse.urlencode(query), timeout=120))
            break
        except OSError:
            if attempt == 3: raise
            time.sleep(5 * (attempt + 1))
    text = data.get('result', '')
    if '$$SOE' not in text: raise RuntimeError(text[:1500])
    rows = []
    for line in text.split('$$SOE')[1].split('$$EOE')[0].strip().splitlines():
        f = [x.strip() for x in line.split(',')]
        # JD, solar presence, lunar presence, azimuth, elevation, angular diameter (arcsec), trailing empty
        rows.append((float(f[0]), float(f[4]), float(f[5])))
    return rows


def cubic_root(ts, ys):
    """The zero between ts[1] and ts[2] of the cubic through the four points (Lagrange), by bisection."""
    def p(t):
        s = 0.0
        for i in range(4):
            w = ys[i]
            for j in range(4):
                if i != j: w *= (t - ts[j]) / (ts[i] - ts[j])
            s += w
        return s
    a, b = ts[1], ts[2]
    fa = p(a)
    for _ in range(60):
        m = (a + b) / 2
        fm = p(m)
        if (fm > 0) == (fa > 0): a, fa = m, fm
        else: b = m
    return (a + b) / 2


def crossings(rows, level):
    out = []
    f = [level(r) for r in rows]
    for i in range(1, len(rows) - 2):
        if (f[i] > 0) != (f[i + 1] > 0):
            jd = cubic_root([rows[k][0] for k in range(i - 1, i + 3)], f[i - 1:i + 3])
            out.append({'kind': 'rise' if f[i + 1] > 0 else 'set', 'utc': jd_to_iso(jd)})
    return out


LEVELS = {
    'sun': ('10', lambda r: r[1] + 0.833),
    'moon': ('301', lambda r: r[1] + r[2] / 7200 + 34 / 60),
}
out = {
    'source': SOURCE, 'retrieved': datetime.now(timezone.utc).date().isoformat(),
    'definitions': {'sun': 'centre at -0.833 deg apparent airless topocentric elevation', 'moon': 'upper limb at -34 arcmin apparent airless topocentric elevation (centre plus topocentric radius from Horizons quantity 13)'},
    'parameters': {'QUANTITIES': '4,13', 'APPARENT': 'AIRLESS', 'TIME_TYPE': 'UT', 'COORD_TYPE': 'GEODETIC', 'heightM': 0, 'stepMinutes': STEP_MIN, 'windowHours': [-BEFORE_H, AFTER_H]},
    'sites': {k: {'latitude': v[0], 'longitude': v[1]} for k, v in SITES.items()},
    'dates': DATES, 'cases': [],
}
for site, (lat, lon) in SITES.items():
    for date in DATES:
        day = datetime.fromisoformat(date)
        start, stop = day - timedelta(hours=BEFORE_H), day + timedelta(hours=AFTER_H)
        case = {'site': site, 'date': date, 'window': [start.isoformat() + 'Z', stop.isoformat() + 'Z']}
        for body, (code, level) in LEVELS.items():
            rows = fetch(code, lat, lon, start, stop)
            if len(rows) != (BEFORE_H + AFTER_H) * 60 // STEP_MIN + 1: raise RuntimeError(f'{site} {date} {body}: {len(rows)} rows')
            case[body] = crossings(rows, level)
            time.sleep(1)
        out['cases'].append(case)
        print(site, date, len(case['sun']), len(case['moon']))
(root / 'scripts/compare/horizons-rise-set.json').write_text(json.dumps(out, indent=2) + '\n')
print('wrote scripts/compare/horizons-rise-set.json')
