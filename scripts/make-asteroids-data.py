#!/usr/bin/env python3
"""Writes src/data/asteroids.ts and test/data/asteroids-horizons.json: about a hundred asteroids and distant small bodies from JPL's Small-Body Database (SBDB), as osculating elements with their physical numbers,
the missions that visited them and the year each was found.

The records come from two services of the JPL Solar System Dynamics group (https://ssd-api.jpl.nasa.gov/doc/): the SBDB Query API (https://ssd-api.jpl.nasa.gov/sbdb_query.api) gives every body's elements, size,
spin, brightness, colour class, orbit class and hazard flag in a few list requests (a body is picked by its designation: `sb-cdata` takes a list of `pdes|EQ|<designation>` constraints, 2,048 characters at most, so the list
goes in chunks); the SBDB API (https://ssd-api.jpl.nasa.gov/sbdb.api, `discovery=1`) gives the discovery date, one body a request, because the list API does not carry it. The test fixture is JPL Horizons
(https://ssd.jpl.nasa.gov/api/horizons.api, VECTORS, centre the Sun 500@10, ecliptic and equinox J2000, km and km/s, TDB) for some bodies at three dates round each one's epoch, to measure what two-body motion from the
elements loses to the planets' pull. Every answer is cached in the folder given with --cache (never in the repository), so a stopped run resumes without asking again.

Fair use (the Solar System Dynamics API terms, https://ssd-api.jpl.nasa.gov/, read 2026-11-11): one request at a time, an application-specific User-Agent with a product name, a version and a contact, results cached,
back off on an error (this script stops on one, it does not retry).

Usage: python3 -I scripts/make-asteroids-data.py --cache DIR   (needs the network; DIR is outside the repository, for example ~/Projects/backups/wakusei-planets/2026-11-11-data-bodies/cache)"""
import hashlib, json, math, os, re, sys, time, unicodedata, urllib.parse, urllib.request

UA = "wakusei-planets-data-build/1.0 (john@johnmorris.ca)"
QUERY = "https://ssd-api.jpl.nasa.gov/sbdb_query.api"
SBDB = "https://ssd-api.jpl.nasa.gov/sbdb.api"
HORIZONS = "https://ssd.jpl.nasa.gov/api/horizons.api"
PAUSE = 1.5
PER_REQUEST = 20  # the list API answered a request of 70 designations with a 502, so the list goes in small parts
UNIX_EPOCH_JD = 2440587.5
FETCHED = "2026-11-11"
COMMON_EPOCH = 2461200.5  # 2026-06-09 00:00 TDB, the epoch nearly every SBDB solution has today

# (SBDB primary designation, Japanese name, [(mission, year, planned)], note)
# The Japanese is the usual katakana of the name (a body with no name keeps its designation); every one is for a Japanese reader to check.
# Missions are plain facts: the year is the year of the flyby, rendezvous or landing, or, where `planned` is true, the year it is planned for.
M = lambda name, year, planned=False: (name, year, planned)
BODIES = [
    # the largest main-belt asteroids after Ceres, Vesta and Pallas (which the package already has)
    ("10", "ヒギエア", [], ""), ("704", "インテラムニア", [], ""), ("52", "エウロペ", [], ""), ("511", "ダビダ", [], ""), ("31", "エウフロシュネ", [], ""),
    ("451", "パティエンティア", [], ""), ("87", "シルヴィア", [], ""), ("3", "ジュノー", [], ""), ("65", "キュベレ", [], ""), ("88", "ティスベ", [], ""),
    ("15", "エウノミア", [], ""), ("16", "プシケ", [M("Psyche", 2029, True)], ""), ("324", "バンベルガ", [], ""), ("48", "ドリス", [], ""), ("375", "ウルスラ", [], ""),
    ("107", "カミラ", [], ""), ("121", "ヘルミオネ", [], ""), ("117", "ロミア", [], ""), ("106", "ディオネ", [], ""), ("41", "ダフネ", [], ""),
    ("94", "アウロラ", [], ""), ("13", "エゲリア", [], ""), ("45", "ウジェニア", [], ""), ("19", "フォルトゥナ", [], ""), ("7", "イリス", [], ""),
    ("334", "シカゴ", [], ""), ("24", "テミス", [], ""),
    # visited by a spacecraft
    ("951", "ガスプラ", [M("Galileo", 1991)], ""), ("243", "イダ", [M("Galileo", 1993)], "The moon Dactyl orbits it."), ("253", "マティルド", [M("NEAR Shoemaker", 1997)], ""),
    ("21", "ルテティア", [M("Rosetta", 2010)], ""), ("2867", "シュテインス", [M("Rosetta", 2008)], ""), ("5535", "アンネフランク", [M("Stardust", 2002)], ""),
    ("9969", "ブライユ", [M("Deep Space 1", 1999)], ""), ("152830", "ディンキネシュ", [M("Lucy", 2023)], "The moon Selam orbits it."), ("52246", "ドナルドジョハンソン", [M("Lucy", 2025)], ""),
    ("2685", "マスルスキー", [M("Cassini", 2000)], ""), ("132524", "APL", [M("New Horizons", 2006)], ""),
    ("433", "エロス", [M("NEAR Shoemaker", 2000)], "NEAR Shoemaker went into orbit round it in 2000 and landed on it on 2001-02-12."),
    ("25143", "イトカワ", [M("Hayabusa", 2005)], ""), ("162173", "リュウグウ", [M("Hayabusa2", 2018)], ""), ("101955", "ベンヌ", [M("OSIRIS-REx", 2018)], ""),
    ("4179", "トータティス", [M("Chang'e 2", 2012)], ""),
    ("65803", "ディディモス", [M("DART", 2022), M("Hera", 2026, True)], "Dimorphos orbits it; DART struck Dimorphos on 2022-09-26."),
    ("486958", "アロコス", [M("New Horizons", 2019)], "A contact binary of the Kuiper belt."),
    ("99942", "アポフィス", [M("OSIRIS-APEX", 2029, True)], "It passes the Earth on 2029-04-13 at about 0.00025 au."),
    ("98943", "トリフネ", [M("Hayabusa2", 2026, True)], ""), ("1998 KY26", "1998 KY26", [M("Hayabusa2", 2031, True)], ""),
    # famous near-Earth asteroids
    ("2024 YR4", "2024 YR4", [], ""), ("3200", "ファエトン", [M("DESTINY+", 2030, True)], "The parent of the Geminid meteors."), ("1566", "イカルス", [], ""), ("1620", "ジオグラフォス", [], ""),
    ("1685", "トロ", [], ""), ("3753", "クルースン", [], ""), ("469219", "カモオアレワ", [M("Tianwen-2", 2026, True)], ""), ("29075", "1950 DA", [], ""), ("3122", "フローレンス", [], ""),
    ("1036", "ガニメデ", [], "The largest near-Earth asteroid."), ("1862", "アポロ", [], "The first of the Apollo group."), ("2062", "アテン", [], "The first of the Aten group."),
    ("1221", "アモール", [], "The first of the Amor group."), ("163693", "アティラ", [], "The first of the Atira group, whose orbits lie inside the Earth's."), ("69230", "ヘルメス", [], ""),
    ("4015", "ウィルソン・ハリントン", [], ""), ("367943", "ドゥエンデ", [], ""), ("4660", "ネレウス", [], ""), ("6489", "ゴレフカ", [], ""), ("2101", "アドニス", [], ""),
    # Jupiter's trojans: the four Lucy visits besides Donaldjohanson and Dinkinesh, and the famous ones
    ("3548", "エウリュバテス", [M("Lucy", 2027, True)], "The moon Queta orbits it."), ("15094", "ポリュメレ", [M("Lucy", 2027, True)], "The moon Shaun orbits it."), ("11351", "レウコス", [M("Lucy", 2028, True)], ""),
    ("21900", "オルス", [M("Lucy", 2028, True)], ""), ("617", "パトロクロス", [M("Lucy", 2033, True)], "A binary: Menoetius orbits it."),
    ("624", "ヘクトル", [], "The largest Jupiter trojan."), ("588", "アキレス", [], "The first Jupiter trojan found."), ("911", "アガメムノン", [], ""), ("659", "ネストル", [], ""),
    ("884", "プリアモス", [], ""), ("1437", "ディオメデス", [], ""), ("1143", "オデュッセウス", [], ""), ("1404", "アイアス", [], ""), ("1647", "メネラオス", [], ""),
    ("1172", "アエネアス", [], ""), ("1173", "アンキセス", [], ""),
    # centaurs besides Chiron and Pholus
    ("10199", "カリクロー", [], "The first small body found to have rings."), ("7066", "ネッソス", [], ""), ("8405", "アスボルス", [], ""), ("10370", "ヒュロノメ", [], ""),
    ("60558", "エケクルス", [], ""), ("54598", "ビエノル", [], ""), ("32532", "テレウス", [], ""),
    # trans-Neptunian objects and dwarf-planet candidates besides the dwarf planets the package has (Ceres, Orcus, Haumea, Quaoar, Makemake, Gonggong, Eris, Sedna)
    ("120347", "サラキア", [], ""), ("20000", "ヴァルナ", [], ""), ("28978", "イクシオン", [], ""), ("174567", "ヴァルダ", [], ""), ("307261", "2002 MS4", [], ""),
    ("2014 UZ224", "2014 UZ224", [], "Nicknamed DeeDee."), ("15760", "アルビオン", [], "The first Kuiper belt object found after Pluto and Charon."),
    ("2015 TG387", "レレアークーホヌア", [], "A distant object far beyond Neptune."), ("38628", "フヤ", [], ""), ("19521", "カオス", [], ""), ("42355", "テュポン", [], ""),
    ("2012 VP113", "2012 VP113", [], "A distant object like Sedna."), ("2018 AG37", "2018 AG37", [], "Nicknamed Farfarout."),
]

FIELDS = "spkid,pdes,full_name,name,prefix,neo,pha,class,epoch,a,e,i,om,w,ma,n,q,H,diameter,albedo,rot_per,spec_B,spec_T,orbit_id,moid,sats"
GROUPS = {"IEO": "Atira", "ATE": "Aten", "APO": "Apollo", "AMO": "Amor"}
KINDS = {"IMB": "main-belt", "MBA": "main-belt", "OMB": "main-belt", "MCA": "main-belt", "TJN": "trojan", "CEN": "centaur", "TNO": "trans-neptunian"}
# the bodies the Horizons fixture is made for, across every kind and group
FIXTURE = ["433", "99942", "3200", "25143", "101955", "163693", "3753", "16", "10", "624", "588", "10199", "7066", "120347", "486958", "2015 TG387"]
# five times round each body's epoch, in days: a year and half a year before, the epoch itself, half a year and a year after
OFFSETS = [-360.0, -180.0, 0.0, 180.0, 360.0]


class Service:
    def __init__(self, cache):
        self.cache = cache
        self.last = 0.0
        self.counts = {}

    def get(self, name, url, params):
        query = urllib.parse.urlencode(params)
        os.makedirs(self.cache, exist_ok=True)
        key = os.path.join(self.cache, hashlib.md5((url + "?" + query).encode()).hexdigest() + ".json")
        if os.path.exists(key):
            return json.load(open(key))
        wait = PAUSE - (time.time() - self.last)
        if wait > 0:
            time.sleep(wait)
        try:
            text = urllib.request.urlopen(urllib.request.Request(url + "?" + query, headers={"User-Agent": UA}), timeout=300).read().decode()
        except urllib.error.HTTPError as error:
            raise SystemExit(f"{name} refused: HTTP {error.code} {error.read()[:300]!r}; stopping, not retrying")
        self.last = time.time()
        self.counts[name] = self.counts.get(name, 0) + 1
        open(os.path.join(self.cache, "requests.log"), "a").write(f"{time.strftime('%F %T')} {name} {query[:140]}\n")
        open(key, "w").write(text)
        return json.loads(text)


def constraint(d):
    """A designation with a space is matched as a pattern (the equality constraint refuses the space); a number is matched as it is."""
    return f"pdes|RE|^{d}$" if " " in d else f"pdes|EQ|{d}"


def chunks(designations):
    out, current = [], []
    for d in designations:
        trial = current + [d]
        if len(trial) > PER_REQUEST or len(json.dumps({"OR": [constraint(x) for x in trial]}, separators=(",", ":"))) > 1100:
            out.append(current)
            current = [d]
        else:
            current = trial
    return out + [current]


def slug(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower().replace("`", "").replace("'", "")
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


def number(text):
    return None if text in (None, "") else float(text)


def to_jd(text):
    import datetime
    when = datetime.datetime.strptime(text, "%Y-%m-%d %H:%M").replace(tzinfo=datetime.timezone.utc)
    return (when - datetime.datetime(1970, 1, 1, tzinfo=datetime.timezone.utc)).total_seconds() / 86400 + UNIX_EPOCH_JD


def horizons_command(rec):
    return "'" + (f"{rec['number']};" if rec.get("number") else f"DES={rec['spkid']};") + "'"


def elements_at(svc, rec, jd):
    """Horizons' own osculating elements of a body at a Julian date (TDB), for a body whose SBDB epoch is not the common one, so every body is run from an epoch in the same year."""
    query = {"format": "json", "COMMAND": horizons_command(rec), "OBJ_DATA": "'NO'", "MAKE_EPHEM": "'YES'", "EPHEM_TYPE": "'ELEMENTS'", "CENTER": "'500@10'", "REF_PLANE": "'ECLIPTIC'", "REF_SYSTEM": "'ICRF'",
             "OUT_UNITS": "'AU-D'", "CSV_FORMAT": "'YES'", "TIME_TYPE": "'TDB'", "TLIST_TYPE": "'JD'", "TLIST": f"'{jd:.7f}'"}
    text = svc.get("horizons", HORIZONS, query).get("result", "")
    if "$$SOE" not in text:
        raise SystemExit(f"Horizons gave no elements for {rec['id']}: {text.strip()[:300]}")
    p = [v.strip() for v in text.split("$$SOE")[1].split("$$EOE")[0].strip().split("\n")[0].split(",")]
    # JDTDB, calendar, EC, QR, IN, OM, W, Tp, N, MA, TA, A, AD, PR
    return {"epochJd": float(p[0]), "a": float(p[11]), "e": float(p[2]), "i": float(p[4]), "node": float(p[5]), "peri": float(p[6]), "ma": float(p[9]), "n": float(p[8]), "q": float(p[3])}


def js(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def main():
    args = sys.argv[1:]
    if "--cache" not in args:
        raise SystemExit("usage: make-asteroids-data.py --cache DIR")
    cache = os.path.expanduser(args[args.index("--cache") + 1])
    svc = Service(cache)
    wanted = [b[0] for b in BODIES]
    assert len(set(wanted)) == len(wanted), "a designation is listed twice"

    found = {}

    def ask(designations):
        for part in chunks(designations):
            cdata = json.dumps({"OR": [constraint(d) for d in part]}, separators=(",", ":"))
            d = svc.get("sbdb_query", QUERY, {"fields": FIELDS, "sb-cdata": cdata, "full-prec": "1"})
            names = d["fields"]
            for row in d["data"]:
                r = dict(zip(names, row))
                found[r["pdes"]] = r

    ask(wanted)
    # a provisional designation that has since been numbered is found by its number: the SBDB API resolves it
    alias = {}
    for d in [d for d in wanted if d not in found]:
        resolved = svc.get("sbdb", SBDB, {"sstr": d}).get("object", {}).get("des")
        if resolved and resolved != d:
            alias[d] = resolved
    if alias:
        print("numbered since:", alias)
        ask(list(alias.values()))
        for old, new in alias.items():
            if new in found:
                found[old] = found[new]
    missing = [d for d in wanted if d not in found]
    if missing:
        print("not found in the SBDB:", missing)

    records, lost = [], []
    for pdes, ja, missions, note in BODIES:
        r = found.get(pdes)
        if r is None:
            lost.append(pdes)
            continue
        klass = r["class"]
        kind = "near-earth" if klass in GROUPS else KINDS.get(klass)
        if kind is None:
            lost.append(f"{pdes} (class {klass})")
            continue
        full = r["full_name"].strip()
        numbered = re.match(r"(\d+) ", full)
        provisional = re.search(r"\(([^)]+)\)\s*$", full)
        name_en = r["name"] or (provisional.group(1) if provisional else full)
        d = svc.get("sbdb", SBDB, {"des": alias.get(pdes, pdes), "discovery": "1"})
        disc = (d.get("discovery") or {}).get("date")
        year = int(disc[:4]) if disc else None
        source = f"JPL SBDB orbit {r['orbit_id']}"
        if year is None:
            # the SBDB has no discovery record for some bodies: the year of the provisional designation is the year of the first observation that found them
            m = re.match(r"(\d{4}) [A-Z]", provisional.group(1) if provisional else "")
            if m:
                year = int(m.group(1))
                source += "; year of discovery from the designation"
        record = {
            "id": slug(name_en),
            "number": int(numbered.group(1)) if numbered else None,
            "designation": provisional.group(1) if provisional else full,
            "name": {"en": name_en, "ja": ja},
            "kind": kind,
            "orbitClass": klass,
            "hazardous": r["pha"] == "Y",
            "spkid": int(r["spkid"]),
            "elements": {"epochJd": float(r["epoch"]), "a": float(r["a"]), "e": float(r["e"]), "i": float(r["i"]), "node": float(r["om"]), "peri": float(r["w"]), "ma": float(r["ma"]), "n": float(r["n"]), "q": float(r["q"])},
            "H": number(r["H"]),
            "diameterKm": number(r["diameter"]),
            "albedo": number(r["albedo"]),
            "rotationHours": number(r["rot_per"]),
            "spectral": r["spec_B"] or r["spec_T"] or None,
            "moidAu": number(r["moid"]),
            "satellites": int(r["sats"]) if r["sats"] else 0,
            "discoveryYear": year,
            "missions": [{"name": m, "year": y, "planned": p} for m, y, p in missions],
            "note": note,
            "source": source,
        }
        if abs(record["elements"]["epochJd"] - COMMON_EPOCH) > 1:
            record["elements"] = elements_at(svc, record, COMMON_EPOCH)
            record["source"] = f"JPL Horizons osculating elements at JD {COMMON_EPOCH} (the SBDB solution's own epoch is {r['epoch']})" + ("; year of discovery from the designation" if "designation" in source else "")
        if kind == "near-earth":
            record["group"] = GROUPS[klass]
        records.append(record)
    ids = [r["id"] for r in records]
    assert len(set(ids)) == len(ids), f"duplicate ids: {[i for i in ids if ids.count(i) > 1]}"
    print(f"{len(records)} records; left out: {lost}")

    def clean(r):
        out = {}
        for k, v in r.items():
            if v is None or v == "" or (k == "satellites" and v == 0):
                continue
            if k == "missions":
                v = [{kk: vv for kk, vv in m.items() if not (kk == "planned" and vv is False)} for m in v]
            out[k] = v
        return out

    kinds = {}
    for r in records:
        kinds[r["kind"]] = kinds.get(r["kind"], 0) + 1
    body = ",\n".join("  " + js(clean(r)) for r in records)
    out = f"""// Made by scripts/make-asteroids-data.py from JPL's Small-Body Database (SBDB Query API https://ssd-api.jpl.nasa.gov/sbdb_query.api for the orbits and physical numbers, SBDB API https://ssd-api.jpl.nasa.gov/sbdb.api for the
// year of discovery), fetched {FETCHED}. {len(records)} bodies: {', '.join(f'{n} {k}' for k, n in sorted(kinds.items()))}. Orbital elements are osculating, heliocentric, ecliptic and equinox J2000, at the epoch given (a Julian date in TDB; a in au, angles in degrees,
// n in degrees a day). Do not edit by hand.
import type {{ AsteroidRecord }} from "../asteroids.ts";

export const ASTEROID_FETCHED = "{FETCHED}";
export const ASTEROID_TABLE: readonly AsteroidRecord[] = [
{body},
];
"""
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    open(os.path.join(root, "src", "data", "asteroids.ts"), "w").write(out)
    print(f"table: {len(out)} bytes")

    # the fixture: Horizons' own vectors at three times round the epoch of some of the bodies, and the epochs themselves
    fixture = {"fetched": FETCHED, "bodies": []}
    for pdes in FIXTURE:
        rec = next((r for r in records if (str(r["number"]) == pdes or r["designation"] == pdes)), None)
        if rec is None:
            print("fixture body not in the table:", pdes)
            continue
        epoch = rec["elements"]["epochJd"]
        times = [epoch + o for o in OFFSETS]
        query = {"format": "json", "COMMAND": horizons_command(rec), "OBJ_DATA": "'NO'", "MAKE_EPHEM": "'YES'", "EPHEM_TYPE": "'VECTORS'", "CENTER": "'500@10'", "REF_PLANE": "'ECLIPTIC'", "REF_SYSTEM": "'ICRF'",
                 "OUT_UNITS": "'KM-S'", "VEC_TABLE": "'2'", "CSV_FORMAT": "'YES'", "TIME_TYPE": "'TDB'", "TLIST_TYPE": "'JD'", "TLIST": "'" + "' '".join(f"{t:.7f}" for t in times) + "'"}
        d = svc.get("horizons", HORIZONS, query)
        text = d.get("result", "")
        if "$$SOE" not in text:
            raise SystemExit(f"Horizons gave no rows for {rec['id']}: {text.strip()[:300]}")
        rows = []
        for line in text.split("$$SOE")[1].split("$$EOE")[0].strip().split("\n"):
            p = [v.strip() for v in line.split(",")]
            rows.append([float(p[0])] + [float(v) for v in p[2:8]])
        fixture["bodies"].append({"id": rec["id"], "kind": rec["kind"], "rows": rows})
    json.dump(fixture, open(os.path.join(root, "test", "data", "asteroids-horizons.json"), "w"), separators=(",", ":"))
    print("requests this run:", svc.counts)


main()
