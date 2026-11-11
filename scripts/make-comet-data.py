#!/usr/bin/env python3
"""Writes src/data/comets.ts: a set of well-known comets, each with the orbital elements of JPL's Small-Body Database (https://ssd-api.jpl.nasa.gov/sbdb.api, no key), read one request a comet.
The names (English and Japanese), the kind and the meteor shower a comet feeds are ours, below. With --horizons the script also writes test/data/comets-horizons.json: the Sun-centred position of a few comets
from JPL Horizons (https://ssd.jpl.nasa.gov/api/horizons.api, no key) at dates near each comet's epoch, for the test of src/comets.ts.

Usage: python3 -I scripts/make-comet-data.py CACHE_DIR [--horizons]
  CACHE_DIR is a folder outside the repository (for example ~/Projects/backups/wakusei-planets/2026-11-11-comets); every answer is kept in it, so a stopped run resumes and a rerun asks for nothing it has.
  One request at a time with a pause between them, stops on any error. Requests actually made are counted in CACHE_DIR/requests.log and printed at the end. A full run asks SBDB for one answer per comet
  (38) and, with --horizons, Horizons for one answer per test comet."""
import datetime, hashlib, json, math, os, re, sys, time, urllib.parse, urllib.request

SBDB = "https://ssd-api.jpl.nasa.gov/sbdb.api"
HORIZONS = "https://ssd.jpl.nasa.gov/api/horizons.api"
UA = {"User-Agent": "wakusei-planets-data-build (john@johnmorris.ca)"}
PAUSE = 1.5
UNIX_EPOCH_JD = 2440587.5

# The meteor showers a comet feeds, where that is well established: IAU code, English name, Japanese name.
SHOWERS = {
    "eta": ("ETA", "Eta Aquariids", "みずがめ座η流星群"),
    "ori": ("ORI", "Orionids", "オリオン座流星群"),
    "tau": ("TAU", "Taurids", "おうし座流星群"),
    "dra": ("DRA", "Draconids", "りゅう座流星群"),
    "leo": ("LEO", "Leonids", "しし座流星群"),
    "per": ("PER", "Perseids", "ペルセウス座流星群"),
    "urs": ("URS", "Ursids", "こぐま座流星群"),
}

# The interstellar visitors: their numbers (SBDB's full names for them begin with the provisional designation instead).
INTERSTELLAR = {"oumuamua": "1I", "borisov": "2I", "atlas-3i": "3I"}

# id, SBDB search string, English name, Japanese name, showers
COMETS = [
    ("halley", "1P", "Halley", "ハレー彗星", ["eta", "ori"]),
    ("encke", "2P", "Encke", "エンケ彗星", ["tau"]),
    ("pons-winnecke", "7P", "Pons-Winnecke", "ポンス・ウィンネッケ彗星", []),
    ("tuttle", "8P", "Tuttle", "タットル彗星", ["urs"]),
    ("tempel-1", "9P", "Tempel 1", "テンペル第1彗星", []),
    ("pons-brooks", "12P", "Pons-Brooks", "ポンス・ブルックス彗星", []),
    ("olbers", "13P", "Olbers", "オルバース彗星", []),
    ("holmes", "17P", "Holmes", "ホームズ彗星", []),
    ("borrelly", "19P", "Borrelly", "ボレリー彗星", []),
    ("giacobini-zinner", "21P", "Giacobini-Zinner", "ジャコビニ・ツィンナー彗星", ["dra"]),
    ("schwassmann-wachmann-1", "29P", "Schwassmann-Wachmann 1", "シュワスマン・ワハマン第1彗星", []),
    ("honda-mrkos-pajdusakova", "45P", "Honda-Mrkos-Pajdusakova", "ホンダ・ムルコス・パイドゥシャーコヴァー彗星", []),
    ("wirtanen", "46P", "Wirtanen", "ウィルタネン彗星", []),
    ("tempel-tuttle", "55P", "Tempel-Tuttle", "テンペル・タットル彗星", ["leo"]),
    ("churyumov-gerasimenko", "67P", "Churyumov-Gerasimenko", "チュリュモフ・ゲラシメンコ彗星", []),
    ("schwassmann-wachmann-3", "des=73P", "Schwassmann-Wachmann 3", "シュワスマン・ワハマン第3彗星", []),
    ("wild-2", "81P", "Wild 2", "ヴィルト第2彗星", []),
    ("machholz-1", "96P", "Machholz 1", "マックホルツ第1彗星", []),
    ("hartley-2", "103P", "Hartley 2", "ハートレー第2彗星", []),
    ("swift-tuttle", "109P", "Swift-Tuttle", "スイフト・タットル彗星", ["per"]),
    ("hale-bopp", "C/1995 O1", "Hale-Bopp", "ヘール・ボップ彗星", []),
    ("hyakutake", "C/1996 B2", "Hyakutake", "百武彗星", []),
    ("neowise", "C/2020 F3", "NEOWISE", "ネオワイズ彗星", []),
    ("mcnaught", "C/2006 P1", "McNaught", "マックノート彗星", []),
    ("lovejoy-2011", "C/2011 W3", "Lovejoy", "ラブジョイ彗星", []),
    ("ison", "C/2012 S1", "ISON", "アイソン彗星", []),
    ("ztf", "C/2022 E3", "ZTF", "ZTF彗星", []),
    ("tsuchinshan-atlas", "C/2023 A3", "Tsuchinshan-ATLAS", "紫金山・アトラス彗星", []),
    ("kohoutek", "C/1973 E1", "Kohoutek", "コホーテク彗星", []),
    ("west", "C/1975 V1", "West", "ウェスト彗星", []),
    ("leonard", "C/2021 A1", "Leonard", "レナード彗星", []),
    ("oumuamua", "1I", "'Oumuamua", "オウムアムア", []),
    ("borisov", "2I", "Borisov", "ボリソフ彗星", []),
    ("atlas-3i", "3I", "ATLAS", "アトラス彗星 (3I)", []),
]

# The comets whose position is compared with Horizons (the test fixture): id -> (Horizons command, dates to ask, as JD TDB offsets in days from the epoch).
HORIZONS_DATES_DAYS = [-300, -120, -30, 0, 45, 150, 330]


class Fetch:
    def __init__(self, cache):
        self.cache = cache
        self.last = 0.0
        self.count = {"sbdb": 0, "horizons": 0}
        os.makedirs(cache, exist_ok=True)

    def get(self, service, url, query):
        key = os.path.join(self.cache, service + "-" + hashlib.md5((url + "?" + query).encode()).hexdigest() + ".json")
        if os.path.exists(key):
            return json.load(open(key))
        wait = PAUSE - (time.time() - self.last)
        if wait > 0:
            time.sleep(wait)
        try:
            text = urllib.request.urlopen(urllib.request.Request(url + "?" + query, headers=UA), timeout=300).read().decode()
        except urllib.error.HTTPError as error:
            if error.code != 300:  # 300 is SBDB's "several objects match": the answer lists them
                raise
            text = error.read().decode()
        self.last = time.time()
        self.count[service] += 1
        open(os.path.join(self.cache, "requests.log"), "a").write(f"{datetime.datetime.now(datetime.timezone.utc).isoformat()} {service} {url}?{query}\n")
        data = json.loads(text)
        open(key, "w").write(text)
        return data

    def sbdb(self, sstr):
        key, _, value = sstr.partition("=") if sstr.startswith("des=") else ("sstr", "", sstr)  # "des=73P": the exact designation, for a comet with fragments
        return self.get("sbdb", SBDB, urllib.parse.urlencode({key: value, "phys-par": "1", "full-prec": "1"}))


def number(text):
    try:
        return float(text)
    except (TypeError, ValueError):
        return None


def kind_of(designation, e, period_years):
    if re.match(r"^\d+I", designation):
        return "interstellar"
    if e < 1 and period_years is not None and period_years < 200 and re.match(r"^\d+P", designation):
        return "periodic"
    return "long-period"


def record(fetch, row):
    cid, sstr, en, ja, showers = row
    data = fetch.sbdb(sstr)
    if "orbit" not in data:
        print(sstr, json.dumps(data)[:1500])
        raise SystemExit(f"SBDB gave no orbit for {sstr}: {json.dumps(data)[:300]}")
    elements = {el["name"]: number(el["value"]) for el in data["orbit"]["elements"]}
    orbit = data["orbit"]
    obj = data["object"]
    e = elements["e"]
    period_days = elements.get("per")
    period_years = period_days / 365.25 if period_days else None
    phys = {p["name"]: p for p in data.get("phys_par", [])}
    diameter = number(phys["diameter"]["value"]) if "diameter" in phys else None
    extent = phys["extent"]["value"] if "extent" in phys else None
    full = obj["fullname"].strip()
    numbered = re.match(r"^(\d+[PI])/", full)  # "1P/Halley", "1I/'Oumuamua (A/2017 U1)": the number and letter; "C/1995 O1 (Hale-Bopp)": the text before the name
    designation = INTERSTELLAR.get(cid) or (numbered.group(1) if numbered else full.split(" (")[0])
    out = {
        "id": cid,
        "designation": designation,
        "fullName": obj["fullname"].strip(),
        "name": {"en": en, "ja": ja},
        "kind": kind_of(designation, e, period_years),
        "e": e,
        "q": elements["q"],
        "i": elements["i"],
        "node": elements["om"],
        "w": elements["w"],
        "tp": elements["tp"],
        "epoch": number(orbit["epoch"]),
        "a": elements.get("a") if e < 1 else None,
        "periodYears": round(period_years, 6) if e < 1 and period_years else None,
        "condition": int(orbit["condition_code"]) if orbit.get("condition_code") not in (None, "") else None,
        "observations": orbit.get("n_obs_used"),
        "arcDays": int(orbit["data_arc"]) if orbit.get("data_arc") else None,
        "solution": (orbit.get("soln_date") or "")[:10] or None,
        "nucleusKm": diameter,
        "nucleusExtentKm": extent,
        "showers": [{"code": SHOWERS[s][0], "en": SHOWERS[s][1], "ja": SHOWERS[s][2]} for s in showers],
        "spkid": obj.get("spkid"),
    }
    return out


def ts_value(v):
    return json.dumps(v, ensure_ascii=False)


def write_table(records, path, stamp):
    lines = [
        "// Made by scripts/make-comet-data.py from the NASA/JPL Small-Body Database API (https://ssd-api.jpl.nasa.gov/sbdb.api), read " + stamp + ": the orbital elements of each comet's current solution, heliocentric,",
        "// ecliptic and equinox J2000, as osculating elements of that solution's epoch (a in au, angles in degrees, tp and epoch as Julian dates in TDB). Only src/comets.ts imports this file.",
        'import type { CometRecord } from "../comets.ts";',
        "",
        "export const COMET_TABLE: readonly CometRecord[] = [",
    ]
    for r in records:
        lines.append("  " + ts_value(r).replace('"showers":', '"showers":') + ",")
    lines.append("];")
    lines.append("")
    open(path, "w").write("\n".join(lines))


def horizons_vectors(fetch, rec, jds):
    """The Sun-centred position of a comet at the Julian dates (TDB). Horizons keeps a comet's apparitions as separate records; the answer to the plain designation is a list, and the record
    whose epoch year is the year of the SBDB elements' epoch is the same solution, so it is the one asked for."""
    def ask(command):
        query = urllib.parse.urlencode({"format": "json", "COMMAND": f"'{command}'", "OBJ_DATA": "'NO'", "MAKE_EPHEM": "'YES'", "EPHEM_TYPE": "'VECTORS'", "CENTER": "'500@10'", "REF_PLANE": "'ECLIPTIC'",
                                        "REF_SYSTEM": "'ICRF'", "OUT_UNITS": "'AU-D'", "VEC_TABLE": "'1'", "CSV_FORMAT": "'YES'", "TIME_TYPE": "'TDB'", "TLIST_TYPE": "'JD'",
                                        "TLIST": "'" + "' '".join(f"{t:.6f}" for t in jds) + "'"})
        return fetch.get("horizons", HORIZONS, query).get("result", "")
    command = f"DES={rec['designation']};"
    text = ask(command)
    if "$$SOE" not in text:
        year = (datetime.datetime(1970, 1, 1) + datetime.timedelta(days=rec["epoch"] - UNIX_EPOCH_JD)).year
        found = [(int(m.group(1)), int(m.group(2))) for m in re.finditer(r"^\s+(9\d{7})\s+(\d{4})\s", text, re.M)]
        match = [number for number, epoch_year in found if epoch_year == year]
        if len(match) != 1:
            raise SystemExit(f"Horizons gave no single record for {command} with epoch year {year}: {found[-5:]}")
        command = str(match[0])
        text = ask(command)
    if "$$SOE" not in text:
        raise SystemExit(f"Horizons gave no rows for {command}: {text.strip()[:600]}")
    rows = []
    for line in text.split("$$SOE")[1].split("$$EOE")[0].strip().split("\n"):
        p = [v.strip() for v in line.split(",")]
        rows.append({"jd": float(p[0]), "x": float(p[2]), "y": float(p[3]), "z": float(p[4])})
    return command, rows


def main():
    args = sys.argv[1:]
    if not args:
        raise SystemExit(__doc__)
    fetch = Fetch(os.path.expanduser(args[0]))
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(here)
    stamp = datetime.date.today().isoformat()
    records = [record(fetch, row) for row in COMETS]
    write_table(records, os.path.join(root, "src", "data", "comets.ts"), stamp)
    print(f"wrote {len(records)} comets; SBDB requests made this run: {fetch.count['sbdb']}")
    if "--horizons" in args:
        ids = sys.argv[sys.argv.index("--horizons") + 1:]
        ids = [i for i in ids if not i.startswith("--")]
        picked = [r for r in records if r["id"] in ids]
        fixture = {"source": HORIZONS, "centre": "500@10 (the Sun), ecliptic and equinox J2000, au, TDB", "read": stamp, "comets": {}}
        for r in picked:
            jds = [r["epoch"] + d for d in HORIZONS_DATES_DAYS]
            if r["id"] in ("halley", "hale-bopp"):
                jds += [r["tp"]]  # the perihelion the comet is best known for
            command, rows = horizons_vectors(fetch, r, jds)
            fixture["comets"][r["id"]] = {"command": command, "rows": rows}
        json.dump(fixture, open(os.path.join(root, "test", "data", "comets-horizons.json"), "w"), indent=1)
        print(f"wrote test/data/comets-horizons.json for {len(picked)} comets; Horizons requests made this run: {fetch.count['horizons']}")


if __name__ == "__main__":
    main()
