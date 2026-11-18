#!/usr/bin/env python3
"""Writes src/data/places-search-<body>.ts, src/data/places-search-types.ts and src/data/places-aliases.ts: the compact search list of every point of interest on every body, one list per body (the Moon in two), for `/places/search`.

  Features: every row of the IAU Gazetteer of Planetary Nomenclature (USGS Astrogeology, public domain), the nightly centre-point shapefiles <https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/<BODY>_nomenclature_center_pts.zip>,
  read from --cache/gaz (download them there first, one request each; the script never fetches), 50 targets and 16,128 names, with the lettered satellite craters of the Moon. A row with no position (the Gazetteer gives the centre 0 N, 0 E and no
  bounds) is left out and listed in the log. Each row keeps its Gazetteer feature id, which is the address of its page (https://planetarynames.wr.usgs.gov/Feature/<id>).
  Sites: the sites and planned landings of the full lists (`node scripts/dump-places.mjs`, --places) and the `hardware` rows of scripts/make-places-added-data.py (from --cache/landercat.tsv).
  Ids: every id of 0.66.0 stays (test/fixtures/places-ids-0.66.0.json, --frozen); a new feature takes `<body>/<slug of its clean name>`, and when that is taken `<body>/<slug>-<Gazetteer feature id>`, never a count. A frozen id whose feature the
  Gazetteer has since renamed becomes an alias of the new id (src/data/places-aliases.ts).
  Japanese: a feature's name is the full list's Japanese name where it has one, else its IAU name; a type's plain word is the package's own table (the four new ones are in TYPE_WORDS_NEW below).

Usage: node scripts/dump-places.mjs > places.json; python3 -I scripts/make-places-search-data.py --cache DIR --places places.json [--frozen test/fixtures/places-ids-0.66.0.json]
       (DIR holds landercat.tsv and gaz/<BODY>_nomenclature_center_pts.zip)"""
import importlib.util, json, os, re, sys, unicodedata, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "src", "data")


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, file))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


base = load("base", "make-places-data.py")
more = load("more", "make-places-more-data.py")
added = load("added", "make-places-added-data.py")

KIND_CODE = {"crewed": "c", "landing": "l", "rover": "r", "crash": "x", "impact": "i", "entry": "e", "planned": "p", "feature": "f", "hardware": "h"}
SOURCE_IDS = ["iau-gazetteer", "gcat-landercat", "nssdca", "pds-ode", "nasa-mars24", "agency", "nasa-ntrs", "pds-atmospheres", "paper", "announcement"]
# The four plain words the 0.67 lists need that the package's tables did not have (Saxum is the 0.66 table's; it is repeated in the check below): (English, Japanese)
TYPE_WORDS_NEW = {
    "Satellite Feature": ("satellite crater", "付随クレーター"),
    "Lobus, lobi": ("lobe", "ローブ"),
    "Collum, colli": ("neck", "くびれ"),
}
# Gazetteer target (file name) -> body id of the package. Everything else is the lower-case name.
BODY_OF = {"TITAN": "titan", "67P": "67p"}
MIN_SIZE_DECIMALS = 1


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def slug_name(text):
    """The slug the decoder derives from a name: accents taken off first (the Gazetteer's own clean names do the same for most letters)."""
    t = unicodedata.normalize("NFD", text)
    return slug("".join(c for c in t if not unicodedata.combining(c)))


def num(x, places):
    s = f"{x:.{places}f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def east180(lon):
    return ((float(lon) + 180) % 360) - 180


def read_gazetteer(cache):
    rows_by_body = {}
    gaz = os.path.join(cache, "gaz")
    for f in sorted(os.listdir(gaz)):
        if not f.endswith("_nomenclature_center_pts.zip"):
            continue
        target = f.split("_")[0]
        z = zipfile.ZipFile(os.path.join(gaz, f))
        info = z.getinfo(f"{target}_nomenclature_center_pts.dbf")
        stamp = "%04d-%02d-%02d" % info.date_time[:3]
        rows, seen = [], set()
        for r in base.read_dbf(z.read(info.filename)):
            # a feature the shapefile holds in two parts (across the 0 and 360 meridian, say) has one row for each, with the same feature id: one row is kept, and the second part's id of 0.66.0 becomes an alias
            if r["link"] in seen:
                continue
            seen.add(r["link"])
            rows.append(r)
        rows_by_body[target] = (rows, stamp)
    return rows_by_body


def has_position(row):
    """The Gazetteer gives a few names no place at all: the centre 0 N, 0 E (or 360 E) and no bounds."""
    lat, lon = float(row["center_lat"] or 0), float(row["center_lon"] or 0) % 360
    def number(text):
        try:
            return float(text or 0)
        except ValueError:  # the shapefile writes "************" where a bound did not fit
            return 1.0
    bounds = [number(row[k]) for k in ("min_lon", "max_lon", "min_lat", "max_lat")]
    return not (lat == 0 and lon == 0 and all(b == 0 for b in bounds))


def main():
    arg = lambda name: sys.argv[sys.argv.index(name) + 1] if name in sys.argv else None
    cache, places_path = arg("--cache"), arg("--places")
    frozen_path = arg("--frozen") or os.path.join(ROOT, "test", "fixtures", "places-ids-0.66.0.json")
    if not cache or not places_path:
        sys.exit(__doc__)
    full = json.load(open(places_path, encoding="utf-8"))
    frozen = json.load(open(frozen_path, encoding="utf-8"))  # id -> [name, lat, lon]
    gaz = read_gazetteer(cache)
    hardware, hw_read = added.hardware_rows(cache)

    # --- the plain words of the types
    words = {}
    for kind, w in {**more.TYPE_WORDS_MORE, **base.TYPE_WORDS, **TYPE_WORDS_NEW}.items():
        words[kind] = w
    types_used = []
    for _target, (rows, _stamp) in gaz.items():
        for r in rows:
            if r["type"] not in types_used:
                types_used.append(r["type"])
    missing = [t for t in types_used if t not in words]
    if missing:
        sys.exit(f"no plain word for the types {missing}")
    types_used.sort()

    ja_of = {}  # (body, id) -> Japanese name from the full lists
    for body, lst in full.items():
        for p in lst:
            ja_of[p["id"]] = p["name"]["ja"]

    # --- ids: match the frozen ones to Gazetteer rows
    claimed = {}  # id -> (body, fid)
    id_of = {}  # (target, fid) -> id
    alias = {}
    frozen_by_base = {}
    for fid_, (name, lat, lon) in frozen.items():
        frozen_by_base.setdefault(re.sub(r"-\d+$", "", fid_), []).append((fid_, name, lat, lon))
    site_ids = {p["id"] for lst in full.values() for p in lst if p["kind"] != "feature"}
    unmatched = []
    skipped = []
    log = []
    for target, (rows, stamp) in gaz.items():
        body = BODY_OF.get(target, target.lower())
        for r in sorted(rows, key=lambda r: int(r["link"].rsplit("/", 1)[1])):
            fid = int(r["link"].rsplit("/", 1)[1])
            if not has_position(r):
                skipped.append(f"{body}: {r['name']}")
                continue
            lat, lon = round(float(r["center_lat"]), 4), round(east180(r["center_lon"]), 4)
            b = f"{body}/{slug(r['clean_name'])}"
            near = [c for c in frozen_by_base.get(b, []) if c[0] not in site_ids and abs(c[2] - lat) < 0.0011 and abs(((c[3] - lon + 180) % 360) - 180) < 0.0011 and c[1] == r["name"]]
            if near and near[0][0] not in claimed:
                claimed[near[0][0]] = (body, fid)
                id_of[(target, fid)] = near[0][0]
    # a frozen feature id that no row claimed: the feature was renamed, moved or dropped
    feature_frozen = {i for i in frozen if i not in site_ids}
    all_rows = {}  # (body, name) -> [(lat, lon, target, fid)] over the rows kept
    for target, (rows, stamp) in gaz.items():
        for r in rows:
            if has_position(r):
                all_rows.setdefault((BODY_OF.get(target, target.lower()), r["name"]), []).append((round(float(r["center_lat"]), 4), round(east180(r["center_lon"]), 4), target, int(r["link"].rsplit("/", 1)[1])))
    pending_alias = {}
    for i in sorted(feature_frozen - set(claimed)):
        name, lat, lon = frozen[i]
        hit = [c for c in all_rows.get((i.split("/")[0], name), []) if abs(c[0] - lat) < 0.0011 and abs(((c[1] - lon + 180) % 360) - 180) < 0.0011]
        same = all_rows.get((i.split("/")[0], name), [])
        # the other part of a feature the shapefile holds twice: the one row of that name on the body (its centre is that of the first part)
        if not hit and len(same) == 1:
            hit = same
        if hit:
            pending_alias[i] = (hit[0][2], hit[0][3])
        else:
            unmatched.append(i)
    if unmatched:
        sys.exit(f"{len(unmatched)} ids of 0.66.0 match no Gazetteer row (renamed or dropped: add them to ALIASES by hand after checking): {unmatched[:20]}")

    taken = set(claimed) | site_ids | {h["id"] for h in hardware}
    for target, (rows, stamp) in gaz.items():
        body = BODY_OF.get(target, target.lower())
        for r in sorted(rows, key=lambda r: int(r["link"].rsplit("/", 1)[1])):
            fid = int(r["link"].rsplit("/", 1)[1])
            if (target, fid) in id_of or not has_position(r):
                continue
            b = f"{body}/{slug(r['clean_name'])}"
            new = b if b not in taken else f"{b}-{fid}"
            taken.add(new)
            id_of[(target, fid)] = new

    for old, key in pending_alias.items():
        current = id_of[key]
        if re.sub(r"-\d+$", "", current) == old:  # the row kept carries the count suffix: the plain id is the one that lives on, and the suffixed one is the alias
            id_of[key], old, current = old, current, old
        alias[old] = current
        log.append(f"alias {old} -> {current} (the same Gazetteer feature, held twice in its shapefile)")

    # --- the rows of each list
    lists = {}  # list name -> {"read": stamp, "rows": [...]}

    def push(name, row):
        lists.setdefault(name, {"read": "", "rows": []})["rows"].append(row)

    for target, (rows, stamp) in gaz.items():
        body = BODY_OF.get(target, target.lower())
        for r in rows:
            if not has_position(r):
                continue
            fid = int(r["link"].rsplit("/", 1)[1])
            pid = id_of[(target, fid)]
            d = float(r["diameter"] or 0)
            name = r["name"]
            ja = ja_of.get(pid, name)
            list_name = "moon-satellites" if body == "moon" and r["type"] == "Satellite Feature" else body
            lists.setdefault(list_name, {"read": stamp, "rows": []})["read"] = stamp
            push(list_name, {"id": pid, "kind": "feature", "en": name, "ja": ja, "type": r["type"], "lat": round(float(r["center_lat"]), 3), "lon": round(east180(r["center_lon"]), 3),
                             "d": round(d, 2) if d else 0, "ref": str(fid), "date": "", "flags": ""})
    sites = 0
    for body, lst in full.items():
        for p in lst:
            if p["kind"] == "feature":
                continue
            sites += 1
            push(body, {"id": p["id"], "kind": p["kind"], "en": p["name"]["en"], "ja": p["name"]["ja"], "type": "", "lat": p["lat"], "lon": p["lon"], "d": 0,
                        "ref": f"{SOURCE_IDS.index(p['source']['id'])}@{p['source']['read']}", "date": p.get("date", ""), "flags": "a" if p.get("approximate") else ""})
    for h in hardware:
        push(h["body"], {"id": h["id"], "kind": "hardware", "en": h["name"]["en"], "ja": h["name"]["ja"], "type": "", "lat": h["lat"], "lon": h["lon"], "d": 0,
                         "ref": f"{SOURCE_IDS.index(h['source']['id'])}@{h['source']['read']}", "date": h.get("date") or "", "flags": "a" if h.get("approximate") else ""})

    # --- write
    os.makedirs(OUT, exist_ok=True)
    type_index = {t: i for i, t in enumerate(types_used)}
    tag = "// Made by scripts/make-places-search-data.py. Do not edit by hand.\n"
    with open(os.path.join(OUT, "places-search-types.ts"), "w", encoding="utf-8") as f:
        f.write(tag + "// The Gazetteer's feature types, in the order the search lists number them: the Gazetteer's own name, a plain word in English and in Japanese.\n")
        f.write("export const SEARCH_TYPES: readonly (readonly [string, string, string])[] = " + json.dumps([[t, words[t][0], words[t][1]] for t in types_used], ensure_ascii=False, separators=(",", ":")).replace("],[", "],\n[") + ";\n")
    totals = {}
    for name, entry in sorted(lists.items()):
        rows = entry["rows"]
        order = {"feature": 1}
        # the sites first, by date; then the Gazetteer's features in the order of their feature ids, each id written as the step from the one before (the steps are small numbers and the list is a good deal smaller)
        rows.sort(key=lambda r: (order.get(r["kind"], 0), r["date"] == "", r["date"] if r["kind"] != "feature" else "", int(r["ref"]) if r["kind"] == "feature" else 0, r["en"]))
        lines = [entry["read"] or "2026-11-18"]
        last = 0
        for r in rows:
            if r["kind"] == "feature":
                step = int(r["ref"]) - last
                last = int(r["ref"])
                r = {**r, "ref": str(step)}
            derived = f"{r['id'].split('/')[0]}/{slug_name(r['en'])}"
            lines.append("\t".join([
                "" if r["id"] == derived else r["id"], KIND_CODE[r["kind"]], r["en"], "" if r["ja"] == r["en"] else r["ja"], str(type_index[r["type"]]) if r["type"] else "",
                num(r["lat"], 4 if r["kind"] != "feature" else 3), num(r["lon"], 4 if r["kind"] != "feature" else 3), num(r["d"], 2) if r["d"] else "", r["ref"], r["date"], r["flags"],
            ]).rstrip("\t"))
        totals[name] = len(rows)
        const = "SEARCH_" + name.upper().replace("-", "_")
        with open(os.path.join(OUT, f"places-search-{name}.ts"), "w", encoding="utf-8") as f:
            f.write(tag + f"// The search list of {name}: {len(rows)} rows. Columns: id (blank when it is the body and the slug of the name), kind, name, Japanese name (blank when it is the name), type, latitude, longitude, size in km, source (a feature's Gazetteer id as the step from the feature before it), date, flags.\n")
            f.write(f"export const {const} = {json.dumps(chr(10).join(lines), ensure_ascii=False)};\n")
    # the entry points `/places/search/<name>`, the list of bodies and the loaders
    entries = os.path.join(ROOT, "src", "places", "search")
    os.makedirs(entries, exist_ok=True)
    bodies = [b for b in full if b in lists] + sorted(n for n in lists if n not in full and n != "moon-satellites")
    for name in sorted(lists):
        const = name.upper().replace("-", "_")
        title = {"moon-satellites": "the Moon's lettered satellite craters", "67p": "comet 67P", "tempel-1": "comet Tempel 1"}.get(name, name.capitalize())
        feats = sum(1 for r in lists[name]["rows"] if r["kind"] == "feature")
        with open(os.path.join(entries, f"{name}.ts"), "w", encoding="utf-8") as f:
            f.write(f"""// The search list of {title}: one row for each point of interest, from the IAU Gazetteer of Planetary Nomenclature and the sites. See `/places/search` for the record's shape and the search.
import {{ SEARCH_{const} as DATA }} from "../../data/places-search-{name}.ts";
import {{ readPlaceHits, type PlaceHit }} from "../../place-search.ts";

/**
 * The search list of {title}: {len(lists[name]["rows"])} rows ({feats} named features, the rest sites), the sites first by date, then the features in the order of their Gazetteer ids. Read from a compact table when the entry is first imported.
 *
 * @example
 * ```ts
 * import {{ PLACE_HITS_{const} }} from "@johnmorrisdotca/wakusei-planets/places/search/{name}";
 *
 * console.log(PLACE_HITS_{const}.length, "rows;", PLACE_HITS_{const}[0]?.name.en);
 * ```
 */
export const PLACE_HITS_{const}: readonly PlaceHit[] = readPlaceHits("{name.split('-')[0] if name == 'moon-satellites' else name}", DATA);
""")
    with open(os.path.join(OUT, "places-search-bodies.ts"), "w", encoding="utf-8") as f:
        f.write(tag + "// The bodies that have a search list, and how each list is fetched (a chunk of its own for a bundler). Used by `/places/search`.\n")
        f.write("""
/**
 * The bodies that have a search list, in the order a picker shows them: the 33 bodies of `PLACE_BODIES`, then the small bodies (Phobos, Deimos, Amalthea, Thebe, Janus, Epimetheus, Hyperion, Phoebe, Proteus, Gaspra, Ida, Dactyl, Mathilde, Lutetia,
 * Steins, Itokawa, Donaldjohanson, Didymos and Dinkinesh) the Gazetteer names features on. Puck and Nix have none: every name the Gazetteer has for them is without a position.
 *
 * @example
 * ```ts
 * import { PLACE_SEARCH_BODIES } from "@johnmorrisdotca/wakusei-planets/places/search";
 *
 * console.log(PLACE_SEARCH_BODIES.length, "bodies:", PLACE_SEARCH_BODIES.slice(0, 5).join(", "));
 * ```
 */
""")
        f.write("export const PLACE_SEARCH_BODIES = [\n" + ",\n".join(f'  "{b}"' for b in bodies) + ",\n] as const;\n\n")
        f.write("""/**
 * A body with a search list.
 *
 * @example
 * ```ts
 * import type { PlaceSearchBody } from "@johnmorrisdotca/wakusei-planets/places/search";
 *
 * const body: PlaceSearchBody = "phobos";
 * console.log(body);
 * ```
 */
""")
        f.write("export type PlaceSearchBody = (typeof PLACE_SEARCH_BODIES)[number];\n\n")
        f.write("export async function readSearchTable(body: PlaceSearchBody | \"moon-satellites\"): Promise<readonly import(\"../place-search.ts\").PlaceHit[]> {\n  switch (body) {\n")
        for name in sorted(lists):
            const = name.upper().replace("-", "_")
            f.write(f'    case "{name}": return (await import("../places/search/{name}.ts")).PLACE_HITS_{const};\n')
        f.write("    default: throw new RangeError(`no search list for ${String(body)}`);\n  }\n}\n")
    with open(os.path.join(OUT, "places-aliases.ts"), "w", encoding="utf-8") as f:
        f.write(tag + "// An id that a place had in an earlier release and has not now (the IAU renamed the feature): old id -> current id. Empty while no name has changed since 0.66.0.\n")
        f.write("export const PLACE_ID_ALIASES: Readonly<Record<string, string>> = " + json.dumps(alias, ensure_ascii=False, indent=1) + ";\n")
    print(f"{len(lists)} lists, {sum(totals.values())} rows ({sites} sites, {len(hardware)} hardware, the rest Gazetteer features)", file=sys.stderr)
    print("left out for want of a position:", "; ".join(skipped), file=sys.stderr)
    print("\n".join(log), file=sys.stderr)
    for name, n in sorted(totals.items()):
        print(f"  {name}: {n}", file=sys.stderr)


if __name__ == "__main__":
    main()
