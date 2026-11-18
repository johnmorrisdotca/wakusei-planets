#!/usr/bin/env python3
"""The sites added to the places in 0.67: two rovers destroyed at the Hakuto-R Mission 1 impact (full records, written to src/data/places-added.ts) and the `hardware` rows (equipment left on a surface and hardware that fell to it),
which are held in the search lists only (`hardware_rows()` below; scripts/make-places-search-data.py calls it). Every row's source is GCAT, J. McDowell's lander catalogue (planet4589.org/space/gcat, CC BY 4.0, credited), landercat.tsv in --cache.

  Rovers (kind `rover`): Rashid and SORA-Q, which rode down aboard Hakuto-R Mission 1 and were destroyed in its impact.
  Hardware (kind `hardware`): the Apollo experiment packages (EASEP of Apollo 11, the ALSEP of Apollo 12, 14, 15, 16 and 17), the Apollo 14 equipment cart, the cameras ejected from IM-1 (EagleCam), Chang'e 6 (Yidong Xiangji) and Tianwen-1 (Fenli),
  Hayabusa2's target markers A and B on Ryugu, and every piece GCAT lists for a Mars landing with a position of its own (cruise stages, heat shields, backshells, parachutes, aeroshells, balance masses, motors, covers).

  What is left out, and why: pieces GCAT lists with no position ("-"); spacesuits and backpacks; pieces attached to another record at the same place (an instrument unit on its rocket stage); the Venus, Titan and Moon pieces that sit at their lander's point (heat
  shields at the Venera landers' old positions, which the lander records have since moved); the Venus balloons (GCAT's position is where the signal ended, not where the balloon entered). A position GCAT gives to a degree or less is marked `approximate`.

Usage: python3 -I scripts/make-places-added-data.py --cache DIR     (DIR holds landercat.tsv)"""
import importlib.util, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
spec = importlib.util.spec_from_file_location("base", os.path.join(HERE, "make-places-data.py"))
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

GCAT_URL = "https://planet4589.org/space/gcat/tsv/cat/landercat.tsv"

# --- rows read from GCAT -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

def gcat_rows(cache):
    updated = ""
    rows = []
    for line in open(os.path.join(cache, "landercat.tsv"), encoding="utf-8"):
        if line.startswith("#"):
            m = re.search(r"Updated (\d{4}) ([A-Z][a-z]{2}) +(\d{1,2})", line)
            if m:
                updated = base.gcat_date(f"{m.group(1)} {m.group(2)} {m.group(3)}")
            continue
        p = [x.strip() for x in line.rstrip("\n").split("\t")]
        if len(p) >= 16:
            rows.append(dict(zip(["jcat", "piece", "name", "owner", "state", "world", "lon", "lat", "ltype", "status", "launch", "land", "off", "dur", "site", "comment"], p)))
    return rows, updated


def has_position(r):
    return r["lon"] not in ("", "-") and r["lat"] not in ("", "-")


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


# --- the rovers ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

ROVERS = {"Rashid": "ラシード", "SORA-Q": "SORA-Q"}


def added_places(cache):
    """The full records added to the Moon's list: Rashid and SORA-Q."""
    rows, updated = gcat_rows(cache)
    out = []
    for r in rows:
        if r["world"] != "Luna" or r["name"] not in ROVERS:
            continue
        lat, lon = r["lat"], r["lon"]
        place = {
            "id": f"moon/{slug(r['name'])}", "kind": "rover", "name": {"en": r["name"], "ja": ROVERS[r["name"]]}, "gcatName": r["name"],
            "lat": round(float(lat), 4), "lon": round(base.east180(lon), 4), "date": base.gcat_date(r["land"]),
            "mission": r["name"], "operator": r["owner"], "country": r["state"], "outcome": "hard",
            "source": {"id": "gcat-landercat", "read": updated},
        }
        if base.decimals_of(lon) <= 1 and base.decimals_of(lat) <= 1:
            place["approximate"] = True
        if r["comment"] not in ("", "-"):
            place["note"] = r["comment"][0].upper() + r["comment"][1:]
        out.append(place)
    out.sort(key=lambda p: (p["date"], p["name"]["en"]))
    return out


# --- the hardware ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

MARS_MISSIONS = [  # (land date prefix as GCAT writes it, the name shown, its Japanese name)
    ("1971 Nov", "Mars 2", "マルス2号"), ("1971 Dec", "Mars 3", "マルス3号"), ("1974 Mar", "Mars 6", "マルス6号"), ("1976 Jul", "Viking 1", "バイキング1号"), ("1976 Sep", "Viking 2", "バイキング2号"),
    ("1997 Jul", "Mars Pathfinder", "マーズ・パスファインダー"), ("1999 Dec", "Mars Polar Lander", "マーズ・ポーラー・ランダー"), ("2003 Dec", "Beagle 2", "ビーグル2"),
    ("2004 Jan  4", "Spirit", "スピリット"), ("2004 Jan 25", "Opportunity", "オポチュニティ"), ("2008 May", "Phoenix", "フェニックス"), ("2012 Aug", "Curiosity", "キュリオシティ"),
    ("2016 Oct", "Schiaparelli", "スキアパレッリ"), ("2018 Nov", "InSight", "インサイト"), ("2021 Feb", "Perseverance", "パーシビアランス"), ("2021 Mar", "Perseverance", "パーシビアランス"), ("2021 May", "Tianwen-1", "天問1号"),
]
# GCAT's name of a piece -> (the name shown, its Japanese name). A numbered piece ("EBMD 3") keeps its number.
PIECES = [
    (r"^(TDU Marsa-\d)$", "motor (TDU)", "推進装置 (TDU)"), (r"^DMP$", "motor (DMP)", "推進装置 (DMP)"), (r"^Teplovoy Ekran$", "heat shield", "ヒートシールド"),
    (r"^(?:[\w-]+ )*Heat Shield$", "heat shield", "ヒートシールド"), (r"^(?:[\w-]+ )*Back ?[Ss]hell$", "backshell", "バックシェル"), (r"^(?:[\w-]+ )*Parachute$", "parachute", "パラシュート"),
    (r"^(?:[\w-]+ )*Cruise Stage$", "cruise stage", "巡航ステージ"), (r"^(?:[\w-]+ )*Aeroshell Cover$", "aeroshell cover", "エアロシェルのカバー"), (r"^(?:[\w-]+ )*Aeroshell(?: Base)?$", "aeroshell", "エアロシェル"),
    (r"^CBMD (\d)$", "cruise balance mass {0}", "巡航バランスウェイト{0}"), (r"^EBMD (\d)$", "entry balance mass {0}", "突入バランスウェイト{0}"), (r"^EXM-EDM Front Shield$", "front shield", "フロントシールド"),
    (r"^EXM-EDM Back Cover$", "back cover", "バックカバー"), (r"^Ejectable Belly Pan$", "ejectable belly pan", "投棄式ベリーパン"), (r"^MHDS Cover$", "helicopter delivery system cover", "ヘリコプター投下装置のカバー"),
]
# The Moon and Ryugu, by GCAT's name: (the name shown, its Japanese name)
MOON_HARDWARE = {
    "EASEP PSEP": ("Apollo 11 passive seismic experiment (EASEP)", "アポロ11号 受動地震計 (EASEP)"), "EASEP LRRR": ("Apollo 11 laser reflector (EASEP)", "アポロ11号 レーザー反射器 (EASEP)"),
    "Apollo 12 ALSEP": ("Apollo 12 experiment package (ALSEP)", "アポロ12号 月面科学実験装置群 (ALSEP)"), "Apollo 14 ALSEP": ("Apollo 14 experiment package (ALSEP)", "アポロ14号 月面科学実験装置群 (ALSEP)"),
    "MET": ("Apollo 14 equipment cart (MET)", "アポロ14号 機材運搬用手押し車 (MET)"), "Apollo 15 ALSEP": ("Apollo 15 experiment package (ALSEP)", "アポロ15号 月面科学実験装置群 (ALSEP)"),
    "Apollo 16 ALSEP": ("Apollo 16 experiment package (ALSEP)", "アポロ16号 月面科学実験装置群 (ALSEP)"), "Apollo 17 ALSEP": ("Apollo 17 experiment package (ALSEP)", "アポロ17号 月面科学実験装置群 (ALSEP)"),
    "EagleCam": ("EagleCam (IM-1)", "イーグルカム (IM-1)"), "Chang'e-6 Yidong Xiangji": ("Chang'e 6 ejected camera (Yidong Xiangji)", "嫦娥6号 分離カメラ"),
}
RYUGU_HARDWARE = {"Target Marker A": ("Hayabusa2 target marker A", "はやぶさ2 ターゲットマーカーA"), "Target Marker B": ("Hayabusa2 target marker B", "はやぶさ2 ターゲットマーカーB")}


def mars_mission(land):
    best = None
    for prefix, en, ja in MARS_MISSIONS:
        if land.startswith(prefix.rstrip()) and (best is None or len(prefix) > len(best[0])):
            best = (prefix, en, ja)
    return best


def hardware_rows(cache):
    """The hardware rows, as dicts: body, id, name, kind `hardware`, lat, lon, date, operator, country, note, `approximate` where GCAT gives a degree or less, and the source (GCAT, the file's update date)."""
    rows, updated = gcat_rows(cache)
    out = []
    seen = set()
    for r in rows:
        if not has_position(r):
            continue
        world, name = r["world"], r["name"]
        shown = None
        if world == "Luna" and name in MOON_HARDWARE:
            body, (en, ja) = "moon", MOON_HARDWARE[name]
        elif world == "Ryugu" and name in RYUGU_HARDWARE:
            body, (en, ja) = "ryugu", RYUGU_HARDWARE[name]
        elif world == "Mars" and name == "Fenli xiangi":
            body, en, ja = "mars", "Tianwen-1 ejected camera (Fenli)", "天問1号 分離カメラ"
        elif world == "Mars" and r["ltype"] == "C" and r["status"] == "I":
            mission = mars_mission(r["land"])
            if mission is None:
                sys.exit(f"Mars piece {name} ({r['land']}) has no mission in MARS_MISSIONS")
            piece = None
            for pattern, pen, pja in PIECES:
                m = re.match(pattern, name)
                if m:
                    piece = (pen.format(*m.groups()) if "{0}" in pen else pen, pja.format(*m.groups()) if "{0}" in pja else pja)
                    break
            if piece is None:
                sys.exit(f"Mars piece {name} has no entry in PIECES")
            body, en, ja = "mars", f"{mission[1]} {piece[0]}", f"{mission[2]} {piece[1]}"
        else:
            continue
        key = (body, en, r["lat"], r["lon"])
        if key in seen:
            continue
        seen.add(key)
        row = {
            "id": f"{body}/{slug(en)}", "body": body, "kind": "hardware", "name": {"en": en, "ja": ja}, "gcatName": name,
            "lat": round(float(r["lat"]), 4), "lon": round(base.east180(r["lon"]), 4), "date": base.gcat_date(r["land"]),
            "operator": r["owner"], "country": r["state"], "source": {"id": "gcat-landercat", "read": updated},
        }
        if r["comment"] not in ("", "-"):
            row["note"] = r["comment"]
        if base.decimals_of(r["lon"]) <= 1 and base.decimals_of(r["lat"]) <= 1:
            row["approximate"] = True
        out.append(row)
    ids = {}
    for row in out:  # ids are unique: two pieces of one name at one landing get a count, in GCAT's order
        ids[row["id"]] = ids.get(row["id"], 0) + 1
        if ids[row["id"]] > 1:
            row["id"] = f"{row['id']}-{ids[row['id']]}"
    out.sort(key=lambda r: (r["body"], r["date"] or "", r["name"]["en"]))
    return out, updated


# --- output --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

def main():
    cache = sys.argv[sys.argv.index("--cache") + 1] if "--cache" in sys.argv else sys.exit(__doc__)
    places = added_places(cache)
    hardware, updated = hardware_rows(cache)
    head = (
        f"// Made by scripts/make-places-added-data.py. The places added to the Moon's list in 0.67: Rashid and SORA-Q, the two rovers destroyed in Hakuto-R Mission 1's impact. From GCAT, J. McDowell's lander catalogue "
        f"(planet4589.org/space/gcat, CC BY 4.0, credited), updated {updated}. Japanese names are ours. Do not edit by hand.\n"
        'import type { Place } from "../places.ts";\n\n'
    )
    body = "export const ADDED_MOON: readonly Place[] = " + json.dumps(places, ensure_ascii=False, separators=(",", ":")).replace("},{", "},\n{") + " as unknown as readonly Place[];\n"
    with open(os.path.join(ROOT, "src", "data", "places-added.ts"), "w", encoding="utf-8") as f:
        f.write(head + body)
    print(f"wrote src/data/places-added.ts: {len(places)} places; {len(hardware)} hardware rows (GCAT of {updated})", file=sys.stderr)
    for row in hardware:
        print(f"  {row['id']:60} {row['lat']:9} {row['lon']:9}  {'~' if row.get('approximate') else ' '} {row['name']['ja']}", file=sys.stderr)


if __name__ == "__main__":
    main()
