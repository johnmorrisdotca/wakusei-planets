#!/usr/bin/env python3
"""Writes src/data/approaches.ts: the close approaches of near-Earth objects to the Earth from NASA/JPL's Close-Approach Data API (https://ssd-api.jpl.nasa.gov/cad.api), two list requests:
every approach within 0.05 au from 2026-01-01 to 2036-12-31 (predictions, and the weeks of 2026 already gone), and the notable ones within 0.002 au (about 0.8 lunar distances) from 1900-01-01 to 2025-12-31.
Each row is: designation, full name, Julian date (TDB), nominal distance (au), least and greatest distance (au, 3-sigma), speed relative to the Earth (km/s), the uncertainty of the moment in minutes (negative where
JPL gives only a bound, "< 00:01"), absolute magnitude H, measured diameter (km) and its 1-sigma (null where unknown).

Fair use (the Solar System Dynamics API terms, https://ssd-api.jpl.nasa.gov/, read 2026-11-11): one request at a time, an application-specific User-Agent with a product name, a version and a contact, results cached,
back off on an error (this script stops on one, it does not retry).

Usage: python3 -I scripts/make-approaches-data.py --cache DIR [--refresh]   (needs the network; DIR is outside the repository. The answers are cached there, so a rerun asks nothing;
--refresh asks JPL again and replaces the cached answers, which is how the table is brought up to date: the approaches are predictions and change as orbits are refined. The date fetched is written into the file.)"""
import hashlib, json, os, re, sys, time, urllib.parse, urllib.request

UA = "wakusei-planets-data-build/1.0 (john@johnmorris.ca)"
CAD = "https://ssd-api.jpl.nasa.gov/cad.api"
PAUSE = 1.5
FETCHED = time.strftime("%Y-%m-%d")
PARTS = [
    ("future", {"date-min": "2026-01-01", "date-max": "2036-12-31", "dist-max": "0.05"}),
    ("historic", {"date-min": "1900-01-01", "date-max": "2025-12-31", "dist-max": "0.002"}),
]


def ask(cache, params, refresh):
    params = dict(params, **{"diameter": "true", "fullname": "true", "sort": "date"})
    query = urllib.parse.urlencode(params)
    os.makedirs(cache, exist_ok=True)
    key = os.path.join(cache, "cad-" + hashlib.md5(query.encode()).hexdigest() + ".json")
    if os.path.exists(key) and not refresh:
        return json.load(open(key)), False
    try:
        text = urllib.request.urlopen(urllib.request.Request(CAD + "?" + query, headers={"User-Agent": UA}), timeout=300).read().decode()
    except urllib.error.HTTPError as error:
        raise SystemExit(f"cad.api refused: HTTP {error.code} {error.read()[:300]!r}; stopping, not retrying")
    open(key, "w").write(text)
    open(os.path.join(cache, "requests.log"), "a").write(f"{time.strftime('%F %T')} cad.api {query}\n")
    return json.loads(text), True


def sigma_minutes(text):
    """JPL's "< 00:01", "00:03" or "2_09:08" as minutes, negative where it is a bound."""
    m = re.fullmatch(r"\s*([<>~]?)\s*(?:(\d+)_)?(\d+):(\d+)\s*", text or "")
    if not m:
        raise SystemExit(f"a time uncertainty in a form this script does not know: {text!r}")
    minutes = int(m.group(2) or 0) * 1440 + int(m.group(3)) * 60 + int(m.group(4))
    if m.group(1) == ">":
        raise SystemExit(f"a lower bound on a time uncertainty ({text!r}): the table has no field for it")
    return -minutes if m.group(1) == "<" else minutes


def sig(x, digits=6):
    return float(f"{float(x):.{digits}g}")


def num(x):
    return None if x is None else float(x)


def main():
    args = sys.argv[1:]
    if "--cache" not in args:
        raise SystemExit("usage: make-approaches-data.py --cache DIR [--refresh]")
    cache = os.path.expanduser(args[args.index("--cache") + 1])
    refresh = "--refresh" in args
    rows, requests, seen = [], 0, set()
    for name, params in PARTS:
        d, fresh = ask(cache, params, refresh)
        requests += fresh
        if fresh:
            time.sleep(PAUSE)
        if d["signature"]["version"] != "1.5":
            raise SystemExit(f"the API's version is {d['signature']['version']}, not the 1.5 this script reads: read https://ssd-api.jpl.nasa.gov/doc/cad.html for what changed")
        fields = d["fields"]
        print(f"{name}: {d['count']} approaches")
        for r in (dict(zip(fields, row)) for row in d.get("data", [])):
            key = (r["des"], r["jd"])
            if key in seen:
                continue
            seen.add(key)
            rows.append([r["des"], r["fullname"].strip(), round(float(r["jd"]), 5), sig(r["dist"], 6), sig(r["dist_min"], 6), sig(r["dist_max"], 6), round(float(r["v_rel"]), 3), sigma_minutes(r["t_sigma_f"]), float(r["h"]),
                         num(r["diameter"]), num(r["diameter_sigma"])])
    rows.sort(key=lambda row: row[2])

    def js(v):
        return json.dumps(v, ensure_ascii=False, separators=(",", ":"))

    body = ",\n".join("  " + js(r) for r in rows)
    out = f"""// Made by scripts/make-approaches-data.py from NASA/JPL's Close-Approach Data API (https://ssd-api.jpl.nasa.gov/cad.api, version 1.5), fetched {FETCHED}: {len(rows)} approaches to the Earth. Predictions: they change as orbits are refined. Do not edit by hand.
// A row: designation, full name, Julian date (TDB), nominal distance (au), least and greatest distance (au, 3-sigma), speed relative to the Earth (km/s), the uncertainty of the moment in minutes (negative: under that many),
// absolute magnitude H, measured diameter (km) and its 1-sigma, or null.
export type ApproachRow = readonly [string, string, number, number, number, number, number, number, number, number | null, number | null];

/** The day the table was fetched. */
export const APPROACH_FETCHED = "{FETCHED}";
/** The two parts of the table, with the dates each covers and the greatest distance it holds, in astronomical units: every approach within 0.05 au from 2026 to 2036 (`wide`), and the close ones, within 0.002 au, since 1900 (`close`). */
export const APPROACH_COVERAGE = {{
  wide: {{ from: "2026-01-01", to: "2036-12-31", maxAu: 0.05 }},
  close: {{ from: "1900-01-01", to: "2025-12-31", maxAu: 0.002 }},
}} as const;
export const APPROACH_ROWS: readonly ApproachRow[] = [
{body},
];
"""
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    open(os.path.join(root, "src", "data", "approaches.ts"), "w").write(out)
    print(f"table: {len(rows)} rows, {len(out)} bytes; {requests} requests to cad.api this run")


main()
