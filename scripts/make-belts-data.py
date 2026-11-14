#!/usr/bin/env python3
"""Writes src/belts/data.ts: a few thousand numbered small bodies from the NASA/JPL Small-Body Database (https://ssd-api.jpl.nasa.gov/sbdb_query.api), one list for each belt: the main belt, the Hildas, the Jupiter Trojans, the
Centaurs, and the Kuiper belt as classical, resonant and scattered objects. NASA/JPL data, not subject to copyright in the United States (credit: NASA/JPL-Caltech).
The brightest (lowest H, so the largest) numbered bodies of each group are kept, with their osculating elements at the epoch the database gives (). A few polite queries, each with this script's own User-Agent,
a second apart; the raw answers are written to SBDB_RAW (a folder outside the repository) and read from there when they are already there. The totals of each group (how many bodies the database holds) are counted at the same time.
The groups the database has no class for are cut by their elements: the Hildas (a from 3.9 to 4.1 au, e under 0.4), and the Kuiper belt's three kinds (resonant: the semi-major axis within 0.4 au of a resonance with Neptune and e over 0.05;
classical: a from 39.4 to 48.4 and e under 0.24; scattered: the rest with a perihelion beyond 30 au, which here includes the few detached ones). These are approximate: a true resonance is a matter of libration, not of a number.
Usage: python3 -I scripts/make-belts-data.py   (needs the network)"""
import json, os, time, urllib.parse, urllib.request

RAW = os.environ.get("SBDB_RAW", os.path.expanduser("~/Projects/backups/wakusei-planets/2026-11-10-sbdb"))
UA = {"User-Agent": "wakusei-planets-data-build/1.0 (john@johnmorris.ca; one-off belt data for an npm package)"}
FIELDS = "spkid,full_name,pdes,name,class,a,e,i,om,w,ma,epoch,H,q"
# group: (query, how many to keep)
QUERIES = {
    "main": ({"sb-class": "IMB,MBA", "sb-ns": "n", "sb-cdata": {"AND": ["H|LT|13", "a|RG|2.0|3.27"]}}, 1300),
    "hilda": ({"sb-class": "OMB", "sb-ns": "n", "sb-cdata": {"AND": ["H|LT|15", "a|RG|3.9|4.1", "e|LT|0.4"]}}, 220),
    "trojan": ({"sb-class": "TJN", "sb-ns": "n", "sb-cdata": {"AND": ["H|LT|15"]}}, 520),
    "centaur": ({"sb-class": "CEN", "sb-cdata": {"AND": ["H|LT|15"]}}, 200),
    "tno": ({"sb-class": "TNO"}, 900),
}
# what the database holds, for the counts a belt says it is a sample of
TOTALS = {"all": {"sb-kind": "a"}, "numbered": {"sb-kind": "a", "sb-ns": "n"}, "main": {"sb-class": "IMB,MBA"}, "trojan": {"sb-class": "TJN"}, "centaur": {"sb-class": "CEN"}, "tno": {"sb-class": "TNO"},
          "hilda": {"sb-class": "OMB", "sb-cdata": {"AND": ["a|RG|3.9|4.1", "e|LT|0.4"]}}}
# bodies the package draws as bodies of their own (Ceres, Vesta, Pallas, Chiron, Pholus, Pluto and the other dwarf planets) are not in a belt as well
OWN = {"1", "2", "4", "2060", "5145", "134340", "90482", "136108", "50000", "136472", "225088", "136199", "90377"}
RESONANCES = [(36.4, "4:3"), (39.4, "3:2"), (42.3, "5:3"), (43.7, "7:4"), (47.8, "2:1"), (55.4, "5:2"), (62.6, "3:1")]


def ask(params):
    q = {"sb-kind": "a", **params}
    if isinstance(q.get("sb-cdata"), dict):
        q["sb-cdata"] = json.dumps(q["sb-cdata"])
    url = "https://ssd-api.jpl.nasa.gov/sbdb_query.api?" + urllib.parse.urlencode(q)
    time.sleep(1.0)
    return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180))


def cached(name, params):
    os.makedirs(RAW, exist_ok=True)
    path = os.path.join(RAW, name + ".json")
    if os.path.exists(path):
        return json.load(open(path))
    answer = ask(params)
    json.dump(answer, open(path, "w"))
    return answer


def rows(answer):
    names = answer["fields"]
    return [dict(zip(names, r)) for r in answer["data"]]


def short(r):
    """The name the view shows: the number and name (588 Achilles), the number, or the provisional designation."""
    pdes, name = (r["pdes"] or "").strip(), (r["name"] or "").strip()
    return f"{pdes} {name}" if name and pdes.isdigit() else (name or pdes)


def kuiper_kind(r):
    a, e, q = float(r["a"]), float(r["e"]), float(r["q"])
    for ar, _ in RESONANCES:
        if abs(a - ar) <= 0.4 and e > 0.05:
            return "resonant"
    if 39.4 <= a <= 48.4 and e < 0.24:
        return "classical"
    if q > 30 and a > 30:
        return "scattered"
    return None


totals = {k: cached("total-" + k, {**v, "limit": 1, "fields": "spkid"})["count"] for k, v in TOTALS.items()}
belts, epochs = {}, set()
for group, (query, keep) in QUERIES.items():
    # the brightest first: the database sorts by H; a body with no H is not asked for (the constraint holds H below a limit)
    answer = cached("rows-" + group, {**query, "fields": FIELDS, "sort": "H", "limit": 12000})
    allrows = rows(answer)
    got = [r for r in allrows if r["H"] is not None and (r["pdes"] or "").strip() not in OWN]
    got.sort(key=lambda r: float(r["H"]))
    if group == "tno":
        # how many of each kind the database holds (all of them are read, not only the brightest)
        for kind in ("classical", "resonant", "scattered"):
            totals[kind] = sum(1 for r in allrows if kuiper_kind(r) == kind)
    if group == "trojan":
        totals["trojan-read"] = len(allrows)
    if group == "tno":
        for kind in ("classical", "resonant", "scattered"):
            belts[kind] = [r for r in got if kuiper_kind(r) == kind][:keep // 3 + (200 if kind == "resonant" else 0)]
    else:
        belts[group] = got[:keep]
    print(f"{group}: {answer['count']} match, {len(got)} read, kept " + ", ".join(f"{k} {len(v)}" for k, v in belts.items() if group == 'tno' and k in ('classical', 'resonant', 'scattered')) if group == "tno" else f"{group}: {answer['count']} match, {len(got)} read, kept {len(belts[group])}")
EPOCH = 2461200.5
# every body has the epoch of its own solution: the mean anomaly is carried to one epoch with the two-body mean motion (exactly what the view's shader does with it), so a file needs one epoch and a row needs none
for items in belts.values():
    for r in items:
        n = 0.9856076686 / float(r["a"]) ** 1.5
        r["ma"] = (float(r["ma"]) + n * (EPOCH - float(r["epoch"]))) % 360.0


def fmt(x, digits):
    s = f"{float(x):.{digits}f}"
    s = s.rstrip("0").rstrip(".") if "." in s else s
    return "0" if s in ("-0", "") else s.replace("0.", ".", 1) if s.startswith("0.") else s


ORDER = ["main", "hilda", "trojan", "centaur", "classical", "resonant", "scattered"]
lines = [
    "// Made by scripts/make-belts-data.py from NASA/JPL's Small-Body Database (https://ssd-api.jpl.nasa.gov/sbdb_query.api, read 2026-11-10): the brightest numbered bodies of each belt, with their osculating elements at one epoch.",
    "// NASA/JPL data, not subject to copyright in the United States (credit: NASA/JPL-Caltech). A row is `name|a|e|i|node|peri|M0|H`: au, degrees. The Hildas and the three kinds of the Kuiper belt are cut by their elements; see the script. Do not edit by hand.",
    "/** The rows of each belt, brightest first, one body to a line. */",
    "export const BELT_ROWS: Readonly<Record<string, string>> = {",
]
for kind in ORDER:
    out = []
    for r in belts[kind]:
        out.append("|".join([short(r).replace("|", " "), fmt(r["a"], 4), fmt(r["e"], 3), fmt(r["i"], 1), fmt(r["om"], 1), fmt(r["w"], 1), fmt(r["ma"], 1), fmt(r["H"], 1)]))
    lines.append(f"  {json.dumps(kind)}: {json.dumps(chr(10).join(out), ensure_ascii=False)},")
lines.append("};")
os.makedirs("src/belts", exist_ok=True)
open("src/belts/data.ts", "w").write("\n".join(lines) + "\n")
sample = {k: len(belts[k]) for k in ORDER}
open("src/belts/totals.ts", "w").write("\n".join([
    "// Made by scripts/make-belts-data.py from NASA/JPL's Small-Body Database (https://ssd-api.jpl.nasa.gov/sbdb_query.api, read 2026-11-10). NASA/JPL data, not subject to copyright in the United States (credit: NASA/JPL-Caltech). Do not edit by hand.",
    "/**",
    " * The Julian date (TT) of the elements of every body in `data.ts`: each body's mean anomaly was carried to it with the two-body mean motion.",
    " *",
    " * @example",
    " * ```ts",
    ' * import { BELT_EPOCH } from "@johnmorrisdotca/wakusei-planets/belts";',
    " *",
    " * console.log(BELT_EPOCH);",
    " * ```",
    " */",
    f"export const BELT_EPOCH = {EPOCH};",
    "/**",
    " * What the database held on 2026-11-10: `all` counts every asteroid in the database, of every class (the near-Earth ones, the Mars-crossers and so on as well as the belts here, so it is more than the belts add up to), `numbered` the ones with a number, and each group below (the three kinds of the Kuiper belt are cut by their elements, see the script).",
    " *",
    " * @example",
    " * ```ts",
    ' * import { BELT_TOTALS } from "@johnmorrisdotca/wakusei-planets/belts";',
    " *",
    " * console.log(BELT_TOTALS.all > 1_500_000);",
    " * ```",
    " */",
    "export const BELT_TOTALS = " + json.dumps({k: totals[k] for k in ("all", "numbered", "main", "hilda", "trojan", "centaur", "tno", "classical", "resonant", "scattered")}) + " as const;",
    "/** How many bodies of each belt `data.ts` holds: the brightest numbered ones. */",
    "export const BELT_SAMPLE = " + json.dumps(sample) + " as const;",
]) + "\n")
print("totals", totals)
print("wrote src/belts/data.ts:", ", ".join(f"{k} {len(belts[k])}" for k in ORDER), "=", sum(len(belts[k]) for k in ORDER))
