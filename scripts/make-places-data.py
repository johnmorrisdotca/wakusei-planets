#!/usr/bin/env python3
"""Writes src/data/places-moon.ts and src/data/places-mars.ts: the places on the Moon and Mars a page can mark, from two public sources.

  Named features: the IAU Gazetteer of Planetary Nomenclature (USGS Astrogeology, public domain), the nightly centre-point shapefiles
  <https://planetarynames.wr.usgs.gov/shapefiles/MOON_nomenclature_center_pts.zip> and MARS_..., read from --cache (download them there first, one request each;
  the script never fetches). The DBF inside each is read here (no library). Kept: the maria, every feature type but the small craters and satellite craters, and
  craters of at least the floor diameter, so a page is not buried in 9,000 names.

  Landing, crash and impact sites: GCAT's lander catalogue (J. McDowell, planet4589.org/space/gcat, CC BY 4.0, credited), landercat.tsv in --cache. Every row for
  the Moon ("Luna") and Mars that reached the surface: a landing (status L), an intended impact (I) or an impact after orbital decay (R); failures that never
  arrived (F, O) and cargo attached to a parent (second status letter C) are left out. Positions, dates, operators and site names are the catalogue's;
  the Japanese names are ours (a known mission's, else the English name as it is).

  Positions on the Moon: NASA's NSSDCA "Table of Anthropogenic Impacts and Spacecraft on the Moon" (https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html, a US government work), nssdca-lunar-artifacts.html in --cache.
  Where the table gives a position for a craft GCAT lists, the table's position is used (it is newer, from LRO images, and where the two disagree GCAT's is kept in `gcatPosition`); the rest of the record (operator, site, notes) stays GCAT's.
  A few rows only the table has (the Saturn upper stages that struck the Moon, a booster) are added from it. A record whose position is given to a degree or less carries `approximate: true`.
  Crewed landings (the six Apollo lunar modules) have the kind `crewed`. Every Mars place has planetocentric latitude and east longitude: the features' are the Gazetteer's, and each lander named in MARS_POSITIONS takes one source that is planetocentric or is converted (Phoenix, below); the other Mars sites are GCAT's, whose convention it does not state (`source.latitude`).

Usage: python3 -I scripts/make-places-data.py --cache DIR"""
import datetime, json, math, os, re, struct, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src", "data")
BODIES = {"moon": "MOON", "mars": "MARS"}
GCAT_WORLD = {"moon": "Luna", "mars": "Mars"}
# feature types kept: everything but these, and craters only from the floor up (km)
DROP_TYPES = {"Satellite Feature", "Albedo Feature"}
CRATER_FLOOR_KM = {"moon": 80.0, "mars": 80.0}
# the Gazetteer writes the Moon's longitude from -180 to 180 and Mars's from 0 to 360 east; both are kept as east longitude from -180 to 180
TYPE_WORDS = {
    "Albedo Feature": ("albedo feature", "アルベド模様"), "Catena, catenae": ("crater chain", "クレーター列"), "Cavus, cavi": ("hollow", "くぼ地"), "Chaos, chaoses": ("chaos", "カオス地形"),
    "Chasma, chasmata": ("chasm", "峡谷"), "Collis, colles": ("hills", "丘陵"), "Crater, craters": ("crater", "クレーター"), "Dorsum, dorsa": ("ridge", "尾根"), "Fluctus, fluctūs": ("flow", "流れ地形"),
    "Fossa, fossae": ("trough", "溝"), "Labes, labēs": ("landslide", "地すべり"), "Labyrinthus, labyrinthi": ("labyrinth", "迷路地形"), "Lacus, lacūs": ("lake", "湖"), "Landing site name": ("landing site", "着陸地点"),
    "Lingula, lingulae": ("lobe", "舌状地形"), "Mare, maria": ("sea", "海"), "Mensa, mensae": ("mesa", "台地"), "Mons, montes": ("mountain", "山"), "Oceanus, oceani": ("ocean", "大洋"),
    "Palus, paludes": ("marsh", "沼"), "Patera, paterae": ("patera", "パテラ"), "Planitia, planitiae": ("plain", "平原"), "Planum, plana": ("plateau", "高原"), "Promontorium, promontoria": ("cape", "岬"),
    "Rima, rimae": ("rille", "谷筋"), "Rupes, rupēs": ("scarp", "崖"), "Scopulus, scopuli": ("scarp", "崖"), "Serpens, serpentes": ("serpent", "蛇行地形"), "Sinus, sinūs": ("bay", "入り江"),
    "Sulcus, sulci": ("furrows", "溝状地形"), "Terra, terrae": ("land", "大陸"), "Tholus, tholi": ("dome", "ドーム"), "Undae, undae": ("dunes", "砂丘"), "Vallis, valles": ("valley", "谷"), "Vastitas, vastitates": ("lowland", "低地"),
}
# The names a page shows for GCAT's technical object names, from the catalogue's own comments, pieces and site names (the lunar module of Apollo 11 is "LM 5 DS" there); anything else keeps GCAT's name
DISPLAY = {
    "AMS E-1A No. 7 (Luna-2)": "Luna 2", "ALS Luna-9": "Luna 9", "Luna-13 ALS": "Luna 13", "Luna-16 KT (E-8-5 No. 406)": "Luna 16", "Luna-17 (E-8 No. 203)": "Luna 17", "Luna-20 KT (E-8-5 No. 408)": "Luna 20",
    "Luna-21 (E-8 No. 204)": "Luna 21", "Luna-23 KT (E-8-5M No. 410)": "Luna 23", "Luna-24 KT (E-8-5M No. 413)": "Luna 24", "Lunokhod-1": "Lunokhod 1", "Lunokhod-2": "Lunokhod 2",
    "LM 5 DS": "Apollo 11 lunar module", "LM 6 DS": "Apollo 12 lunar module", "LM 8 DS": "Apollo 14 lunar module", "LM 10 DS": "Apollo 15 lunar module", "LM 11 DS": "Apollo 16 lunar module", "LM 12": "Apollo 17 lunar module",
    "LRV-1": "Apollo 15 lunar rover", "LRV-2": "Apollo 16 lunar rover", "LRV-3": "Apollo 17 lunar rover",
    "Chang'e-3": "Chang'e 3", "Chang'e-4": "Chang'e 4", "Chang'e-5 Zhuolu Qi": "Chang'e 5 lander", "Chang'e-6 Zhuolu Qi": "Chang'e 6 lander", "Yutu": "Yutu", "Yutu-2": "Yutu-2",
    "Chandrayaan-3 Vikram Lander": "Chandrayaan-3 (Vikram)", "SLIM": "SLIM", "IM-1": "IM-1 Odysseus", "IM-2 Athena": "IM-2 Athena", "Blue Ghost": "Blue Ghost 1",
    "SA Marsa-3": "Mars 3 lander", "SA Marsa-6": "Mars 6 lander", "SA Marsa-2": "Mars 2 lander", "Viking Lander 1": "Viking 1", "Viking Lander 2": "Viking 2",
    "Sagan Memorial Station": "Mars Pathfinder", "Sojourner": "Sojourner", "Columbia Memorial Station": "Spirit's lander", "Spirit Rover": "Spirit", "Challenger Memorial Station": "Opportunity's lander", "Opportunity Rover": "Opportunity",
    "Phoenix": "Phoenix", "MSL Descent stage": "Curiosity's descent stage", "Curiosity": "Curiosity", "Mars InSight Lander": "InSight", "Mars 2020 Descent stage": "Perseverance's descent stage", "Perseverance": "Perseverance",
    "Tianwen-1 Lander": "Tianwen-1 lander", "Zhurong": "Zhurong",
}
# Japanese names of well-known missions (ours); anything else keeps its English name
JA_NAMES = {
    "Apollo 11 lunar module": "アポロ11号 月着陸船", "Apollo 12 lunar module": "アポロ12号 月着陸船", "Apollo 14 lunar module": "アポロ14号 月着陸船", "Apollo 15 lunar module": "アポロ15号 月着陸船", "Apollo 16 lunar module": "アポロ16号 月着陸船", "Apollo 17 lunar module": "アポロ17号 月着陸船",
    "Apollo 15 lunar rover": "アポロ15号 月面車", "Apollo 16 lunar rover": "アポロ16号 月面車", "Apollo 17 lunar rover": "アポロ17号 月面車",
    "Luna 2": "ルナ2号", "Luna 9": "ルナ9号", "Luna 13": "ルナ13号", "Luna 16": "ルナ16号", "Luna 17": "ルナ17号", "Luna 20": "ルナ20号", "Luna 21": "ルナ21号", "Luna 23": "ルナ23号", "Luna 24": "ルナ24号", "Lunokhod 1": "ルノホート1号", "Lunokhod 2": "ルノホート2号",
    "Surveyor 1": "サーベイヤー1号", "Surveyor 3": "サーベイヤー3号", "Surveyor 5": "サーベイヤー5号", "Surveyor 6": "サーベイヤー6号", "Surveyor 7": "サーベイヤー7号",
    "Chang'e 3": "嫦娥3号", "Chang'e 4": "嫦娥4号", "Chang'e 5 lander": "嫦娥5号 着陸機", "Chang'e 6 lander": "嫦娥6号 着陸機", "Yutu": "玉兎号", "Yutu-2": "玉兎2号", "Chandrayaan-3 (Vikram)": "チャンドラヤーン3号 (ヴィクラム)", "Pragyan": "プラギャン", "SLIM": "SLIM",
    "IM-1 Odysseus": "IM-1 オデュッセウス", "IM-2 Athena": "IM-2 アテナ", "Blue Ghost 1": "ブルーゴースト1号",
    "Mars 2 lander": "マルス2号 着陸機", "Mars 3 lander": "マルス3号 着陸機", "Mars 6 lander": "マルス6号 着陸機", "Viking 1": "バイキング1号", "Viking 2": "バイキング2号", "Mars Pathfinder": "マーズ・パスファインダー", "Sojourner": "ソジャーナ",
    "Spirit's lander": "スピリットの着陸機", "Spirit": "スピリット", "Opportunity's lander": "オポチュニティの着陸機", "Opportunity": "オポチュニティ", "Phoenix": "フェニックス",
    "Curiosity's descent stage": "キュリオシティの降下ステージ", "Curiosity": "キュリオシティ", "InSight": "インサイト", "Perseverance's descent stage": "パーサヴィアランスの降下ステージ", "Perseverance": "パーサヴィアランス",
    "Tianwen-1 lander": "天問1号 着陸機", "Zhurong": "祝融号",
}

DISPLAY.update({"ALS Luna-7": "Luna 7", "ALS Luna-8": "Luna 8", "E-6 No 10 SA (Luna-5)": "Luna 5", "Luna-15 KT (E-8-5 No. 401)": "Luna 15", "Luna-18 KT (E-8-5 No. 407)": "Luna 18", "Ranger Capsule 13": "Ranger 4", "Lunar Orbiter I": "Lunar Orbiter 1", "Luna-25": "Luna 25"})
# More Japanese names (ours) for the missions that have a usual one; the rest keep the English name
JA_NAMES.update({
    "Ranger 6": "レインジャー6号", "Ranger 7": "レインジャー7号", "Ranger 8": "レインジャー8号", "Ranger 9": "レインジャー9号", "Surveyor 2": "サーベイヤー2号", "Surveyor 4": "サーベイヤー4号",
    "Lunar Orbiter 1": "ルナ・オービター1号", "Ranger 4": "レインジャー4号", "Lunar Orbiter 2": "ルナ・オービター2号", "Lunar Orbiter 3": "ルナ・オービター3号", "Lunar Orbiter 4": "ルナ・オービター4号", "Lunar Orbiter 5": "ルナ・オービター5号",
    "Luna 5": "ルナ5号", "Luna 7": "ルナ7号", "Luna 8": "ルナ8号", "Luna 15": "ルナ15号", "Luna 18": "ルナ18号", "Luna 25": "ルナ25号",
    "Hiten": "ひてん", "Lunar Prospector": "ルナ・プロスペクター", "SMART-1": "スマート1号", "Chang'e-1": "嫦娥1号", "Okina": "おきな", "Kaguya": "かぐや", "B'reshit": "ベレシート", "Longjiang 2": "龍江2号",
    "Vikram": "ヴィクラム (チャンドラヤーン2号)", "Hakuto-R M1": "HAKUTO-R ミッション1", "Resilience": "レジリエンス", "Beagle 2": "ビーグル2", "Mars Polar Lander": "マーズ・ポーラー・ランダー",
    "DS2 Scott Probe": "ディープ・スペース2 (スコット)", "DS2 Amundsen Probe": "ディープ・スペース2 (アムンゼン)", "Schiaparelli": "スキアパレッリ", "PROP-M": "PROP-M",
})
# GCAT's pieces that duplicate another record's place (the three pieces of Luna 15 hit one spot)
DROP_NAMES = {"Luna-15 VA", "Luna-15 VS"}
# The names a place has in NASA's table of lunar impacts and landings (NSSDCA), where they are not the name shown
MOON_NSSDCA = {
    "Apollo 11 lunar module": "Apollo 11 LM descent stage", "Apollo 12 lunar module": "Apollo 12 LM descent stage", "Apollo 14 lunar module": "Apollo 14 LM descent stage",
    "Apollo 15 lunar module": "Apollo 15 LM descent stage", "Apollo 16 lunar module": "Apollo 16 LM descent stage", "Apollo 17 lunar module": "Apollo 17 LM descent stage",
    "Intrepid": "Apollo 12 LM ascent stage", "Antares": "Apollo 14 LM ascent stage", "Falcon": "Apollo 15 LM ascent stage", "Challenger": "Apollo 17 LM ascent stage",
    "Apollo 16 Subsatellite": "Apollo 16 subsatellite", "MIP": "Chandraya'an 1 MIP",
    "LCROSS EDUS": "LCROSS Centaur", "LCROSS Shepherding S/C": "LCROSS spacecraft", "Ebb": "GRAIL A", "Flow": "GRAIL B", "Yutu": "Yutu Rover", "Yutu-2": "Yutu 2", "B'reshit": "Beresheet",
    "Chang'e-5 Shangsheng Qi": "Chang'e 5 Ascent Craft", "Hakuto-R M1": "Hakuto-R Mission 1", "Chandrayaan-3 (Vikram)": "Chandrayaan 3", "IM-1 Odysseus": "Odysseus (IM-1)",
    "Chang'e-6 lander": "Chang'e 6", "Chang'e-5 lander": "Chang'e 5", "Resilience": "Hakuto-R Mission 2", "IM-2 Athena": "Intuitive Machines 2", "Chang'e-1": "Chang'e 1", "Chang'e 3": "Chang'e 3", "Chang'e 4": "Chang'e 4",
}
# Rows only NASA's table has that are places: the upper stages and the booster that struck the Moon (name in the table: operator, country, English name, Japanese name)
MOON_NSSDCA_ONLY = {
    "Apollo 13 S-IVB": ("NASA", "US", "Apollo 13 S-IVB stage", "アポロ13号 S-IVB段"), "Apollo 14 S-IVB": ("NASA", "US", "Apollo 14 S-IVB stage", "アポロ14号 S-IVB段"),
    "Apollo 15 S-IVB": ("NASA", "US", "Apollo 15 S-IVB stage", "アポロ15号 S-IVB段"), "Apollo 16 S-IVB": ("NASA", "US", "Apollo 16 S-IVB stage", "アポロ16号 S-IVB段"),
    "Apollo 17 S-IVB": ("NASA", "US", "Apollo 17 S-IVB stage", "アポロ17号 S-IVB段"), "Chang'e 5-T1 Booster": ("CASC", "CN", "Chang'e 5-T1 booster", "嫦娥5号T1 ロケット上段"),
}
# Positions the sources themselves doubt: Luna 9 comes from the first Soviet report and the lander is not found in LRO images at that spot, so the true site is at least 10 km away (NASA's table, note f)
DOUBTED = {"Luna 9"}
CREWED = {"Apollo 11 lunar module", "Apollo 12 lunar module", "Apollo 14 lunar module", "Apollo 15 lunar module", "Apollo 16 lunar module", "Apollo 17 lunar module"}
# Features below the crater floor that a page still wants: the famous small craters and the landing-site craters of Mars
KEEP_ALWAYS = {"moon": {"Aristarchus", "Kepler", "Eratosthenes", "Shackleton", "Linné", "Cabeus"}, "mars": {"Jezero", "Eberswalde", "Holden", "Endeavour", "Victoria", "Santa Maria", "Eagle", "Endurance"}}
# Mars: positions from NASA's own pages where GCAT's differs by more than a few hundredths of a degree and the page says which latitude it is (name shown: lat, lon east -180..180, source id, address)
# Mars: every place has planetocentric latitude and east longitude. Each lander below takes one source (name shown: lat, east longitude 0-360, source id, the source's address or name, how the latitude stands):
#   planetocentric: the source's own latitude is planetocentric (NSSDCA's Viking 1 page says so; ODE lists the radio-tracking solutions of the Mars Exploration Rovers and Folkner et al.'s Viking and Pathfinder positions, which are planetocentric)
#   converted: the source prints a planetographic latitude, turned into a planetocentric one with tan(phi_c) = (Rp/Re)^2 tan(phi_g), Re 3396.19 km and Rp 3376.2 km (IAU 2000)
#   not stated: the source does not say (GCAT's rows; NASA GISS's InSight figure)
ODE_URL = "https://ode.rsl.wustl.edu/mars/pagehelp/Content/Missions_Instruments/Landing_Sites.htm"
MARS_POSITIONS = {
    "Viking 1": (22.27, 312.05, "nssdca", "https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1975-075C", "planetocentric"),
    "Viking 2": (47.6673, 134.2809, "nssdca", "https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1975-083C", "planetocentric"),
    "Mars Pathfinder": (19.095, 326.747, "pds-ode", ODE_URL, "planetocentric"),
    "Sojourner": (19.095, 326.747, "pds-ode", ODE_URL, "planetocentric"),
    "Spirit's lander": (-14.571892, 175.47848, "pds-ode", ODE_URL, "planetocentric"),
    "Spirit": (-14.571892, 175.47848, "pds-ode", ODE_URL, "planetocentric"),
    "Opportunity's lander": (-1.9483, 354.47417, "pds-ode", ODE_URL, "planetocentric"),
    "Opportunity": (-1.9483, 354.47417, "pds-ode", ODE_URL, "planetocentric"),
    "Phoenix": (68.22, 234.25, "pds-ode", ODE_URL, "converted"),
    "InSight": (4.50, 135.62, "nasa-mars24", "https://www.giss.nasa.gov/tools/mars24/help/landers.html", "not stated"),
}
MARS_RATIO = (3376.2 / 3396.19) ** 2
NSSDCA_URL = "https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html"


def nssdca_moon(cache):
    """NASA's table of the Moon's landings and impacts: name -> {lat, lon (east, -180 to 180), type, date, decimals, figure}. Rows with an unknown position are left out."""
    path = os.path.join(cache, "nssdca-lunar-artifacts.html")
    text = open(path, encoding="utf-8", errors="replace").read()
    text = re.sub(r"<script.*?</script>|<style.*?</style>", "", text, flags=re.S)
    read = datetime.date.fromtimestamp(os.path.getmtime(path)).isoformat()
    out = {}
    for row in re.findall(r"<tr.*?</tr>", text, flags=re.S)[1:]:
        cells = [re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", c).replace("&nbsp;", " ")).strip() for c in re.findall(r"<t[dh].*?</t[dh]>", row, flags=re.S)]
        if len(cells) < 5 or cells[3].startswith("Unknown") or cells[0] == "Spacecraft":
            continue
        m = re.match(r"(-?[\d.]+)\.?, (-?[\d.]+)\.?$", cells[4])
        if not m:
            continue
        lat, lon = float(m.group(1)), east180(m.group(2))
        decimals = max(len(t.split(".")[1]) if "." in t else 0 for t in re.findall(r"[\d.]+", cells[3]))
        out[cells[0]] = {"lat": round(lat, 4), "lon": round(lon, 4), "type": cells[1], "date": cells[2], "decimals": decimals, "figure": cells[3], "read": read}
    return out


def decimals_of(text):
    text = text.strip()
    return len(text.split(".")[1]) if "." in text else 0


def read_dbf(raw):
    n = struct.unpack("<I", raw[4:8])[0]
    header_len = struct.unpack("<H", raw[8:10])[0]
    record_len = struct.unpack("<H", raw[10:12])[0]
    fields = []
    p = 32
    while raw[p] != 0x0D:
        name = raw[p : p + 11].split(b"\0")[0].decode()
        length = raw[p + 16]
        fields.append((name, length))
        p += 32
    rows = []
    p = header_len
    for _ in range(n):
        record = raw[p : p + record_len]
        p += record_len
        if record[:1] == b"*":
            continue
        row = {}
        q = 1
        for name, length in fields:
            row[name] = record[q : q + length].decode("utf-8", "replace").strip()
            q += length
        rows.append(row)
    return rows


def east180(lon):
    lon = float(lon)
    return ((lon + 180) % 360) - 180


def features_of(body, cache):
    path = os.path.join(cache, f"{BODIES[body]}_nomenclature_center_pts.zip")
    z = zipfile.ZipFile(path)
    info = z.getinfo(f"{BODIES[body]}_nomenclature_center_pts.dbf")
    stamp = "%04d-%02d-%02d" % info.date_time[:3]
    rows = read_dbf(z.read(info.filename))
    out = []
    for row in rows:
        kind = row["type"]
        if kind in DROP_TYPES:
            continue
        diameter = float(row["diameter"] or 0)
        if kind == "Crater, craters" and diameter < CRATER_FLOOR_KM[body] and row["clean_name"] not in KEEP_ALWAYS[body]:
            continue
        words = TYPE_WORDS.get(kind, (kind.split(",")[0].lower(), kind.split(",")[0]))
        out.append({
            "id": f"{body}/{re.sub(r'[^a-z0-9]+', '-', row['clean_name'].lower()).strip('-')}",
            "kind": "feature",
            "name": {"en": row["name"], "ja": row["name"]},
            "lat": round(float(row["center_lat"]), 4), "lon": round(east180(row["center_lon"]), 4),
            "feature": {"type": kind, "typeWord": {"en": words[0], "ja": words[1]}, "diameterKm": round(diameter, 2), "approved": row["approvaldt"][:10].replace("/", "-")},
            "source": {"id": "iau-gazetteer", "read": stamp},
        })
    out.sort(key=lambda f: (-f["feature"]["diameterKm"], f["name"]["en"]))
    return out, stamp, len(rows)


def gcat_date(text):
    text = text.strip()
    m = re.match(r"(\d{4}) ([A-Z][a-z]{2}) ?(\d{1,2})?(?: (\d{2})(\d{2})(?::(\d{2}))?)?", text)
    if not m:
        return None
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    year, month = int(m.group(1)), months.index(m.group(2)) + 1
    if m.group(3) is None:
        return f"{year:04d}-{month:02d}"
    day = int(m.group(3))
    if m.group(4) is None:
        return f"{year:04d}-{month:02d}-{day:02d}"
    return f"{year:04d}-{month:02d}-{day:02d}T{int(m.group(4)):02d}:{int(m.group(5)):02d}Z"


def sites_of(body, cache):
    path = os.path.join(cache, "landercat.tsv")
    updated = ""
    rows = []
    for line in open(path, encoding="utf-8"):
        if line.startswith("#"):
            m = re.search(r"Updated (\d{4}) ([A-Z][a-z]{2}) +(\d{1,2})", line)
            if m:
                updated = gcat_date(f"{m.group(1)} {m.group(2)} {m.group(3)}")
            continue
        parts = [p.strip() for p in line.rstrip("\n").split("\t")]
        if len(parts) < 16 or parts[5] != GCAT_WORLD[body]:
            continue
        rows.append(parts)
    out = []
    for jcat, piece, name, owner, state, world, lon, lat, ltype, status, launch, land, off, dur, site, comment in rows:
        if status in ("", "*") or status[0] in ("F", "O"):
            continue
        # cargo of a landed craft (the second status letter): a rover that rode down aboard its lander is a place of its own; a suit, an instrument or a rover destroyed in a crash is not
        cargo = len(status) > 1 and status[1] == "C"
        if cargo and not (ltype == "RO" and status[0] == "L"):
            continue
        # rocket stages, entry probes, craft not meant to land, and the secondary pieces of a mission (heat shields, parachutes, motors beside their lander) are left out
        if ltype in ("R", "P", "AX", "C", "H"):
            continue
        if lon in ("", "-") or lat in ("", "-"):
            continue
        first = status[0]
        kind = "rover" if ltype == "RO" else "landing" if first == "L" else "impact" if first == "I" and ltype == "I" else "crash"
        outcome = "soft" if first == "L" else "impact" if kind == "impact" else "hard"
        shown = DISPLAY.get(name, name)
        if name in DROP_NAMES:
            continue
        if shown in CREWED:
            kind, outcome = "crewed", "crewed"
        record = {
            "id": f"{body}/{re.sub(r'[^a-z0-9]+', '-', shown.lower()).strip('-')}",
            "kind": kind,
            "name": {"en": shown, "ja": JA_NAMES.get(shown, shown)},
            "gcatName": name,
            "lat": round(float(lat), 4), "lon": round(east180(lon), 4),
            "date": gcat_date(land) or gcat_date(launch),
            "mission": name, "operator": owner, "country": state, "outcome": outcome,
            "source": {"id": "gcat-landercat", "read": updated},
        }
        if decimals_of(lon) <= 1 and decimals_of(lat) <= 1:
            record["approximate"] = True
        if site and site != "-":
            record["site"] = site
        if comment and comment != "-":
            record["note"] = comment
        if off and off not in ("-", "*"):
            record["until"] = gcat_date(off)
        out.append(record)
    out.sort(key=lambda r: r["date"] or "")
    return out, updated


def main():
    args = sys.argv[1:]
    cache = args[args.index("--cache") + 1] if "--cache" in args else os.path.join(ROOT, ".cache", "places")
    for body in BODIES:
        features, stamp, total = features_of(body, cache)
        sites, updated = sites_of(body, cache)
        notes = []
        if body == "moon":
            table = nssdca_moon(cache)
            used = set()
            for place in sites:
                row = table.get(MOON_NSSDCA.get(place["name"]["en"], place["name"]["en"]))
                if row is None:
                    continue
                used.add(MOON_NSSDCA.get(place["name"]["en"], place["name"]["en"]))
                if abs(row["lat"] - place["lat"]) > 0.05 or abs(row["lon"] - place["lon"]) > 0.05:
                    place["gcatPosition"] = [place["lat"], place["lon"]]
                    notes.append(f"{place['name']['en']}: NASA {row['lat']}, {row['lon']} replaces GCAT {place['lat']}, {place['lon']}")
                place["lat"], place["lon"] = row["lat"], row["lon"]
                place["source"] = {"id": "nssdca", "read": row["read"]}
                if row["decimals"] <= 1 or place["name"]["en"] in DOUBTED:
                    place["approximate"] = True
                else:
                    place.pop("approximate", None)
            for name, (operator, country, en, ja) in MOON_NSSDCA_ONLY.items():
                row = table[name]
                date = datetime.datetime.strptime(row["date"], "%d %B %Y").strftime("%Y-%m-%d")
                sites.append({"id": f"moon/{re.sub(r'[^a-z0-9]+', '-', en.lower()).strip('-')}", "kind": "impact", "name": {"en": en, "ja": ja}, "lat": row["lat"], "lon": row["lon"], "date": date,
                              "mission": name, "operator": operator, "country": country, "outcome": "impact", "source": {"id": "nssdca", "read": row["read"]}, **({"approximate": True} if row["decimals"] <= 1 else {})})
            sites.sort(key=lambda r: r["date"] or "")
            print(f"moon: {len(used)} places take NASA's position; differences over 0.05 degrees:\n  " + "\n  ".join(notes), file=sys.stderr)
        else:
            moved = []
            for place in sites:
                name = place["name"]["en"]
                if name in MARS_POSITIONS:
                    lat, lon, src, where, how = MARS_POSITIONS[name]
                    if how == "converted":
                        lat = math.degrees(math.atan(MARS_RATIO * math.tan(math.radians(lat))))
                    before = (place["lat"], place["lon"])
                    lon = east180(lon)
                    km = math.degrees(math.acos(max(-1, min(1, math.sin(math.radians(before[0])) * math.sin(math.radians(lat)) + math.cos(math.radians(before[0])) * math.cos(math.radians(lat)) * math.cos(math.radians(before[1] - lon)))))) * math.pi / 180 * 3396.19
                    moved.append((name, round(km, 1)))
                    if km > 0.05:
                        place["gcatPosition"] = [before[0], before[1]]
                    place["lat"], place["lon"] = round(lat, 4), round(lon, 4)
                    place["source"] = {"id": src, "read": "2026-11-11", "latitude": how}
                    place.pop("approximate", None)
                else:
                    place["source"]["latitude"] = "not stated"
            print("mars: positions moved from GCAT's (km): " + ", ".join(f"{n} {k}" for n, k in moved), file=sys.stderr)
        kinds = {}
        for s in sites:
            kinds[s["kind"]] = kinds.get(s["kind"], 0) + 1
        # ids are unique: a second place with the same slug (two features with one name on the Gazetteer, two rovers called Pragyan) gets a count
        seen = {}
        for place in sites + features:
            base = place["id"]
            seen[base] = seen.get(base, 0) + 1
            if seen[base] > 1:
                place["id"] = f"{base}-{seen[base]}"
        print(f"{body}: {len(features)} of {total} Gazetteer features kept (file of {stamp}); {len(sites)} sites from GCAT ({kinds}, catalogue updated {updated})", file=sys.stderr)
        path = os.path.join(OUT, f"places-{body}.ts")
        with open(path, "w") as f:
            f.write(f"// Made by scripts/make-places-data.py. Named features from the IAU Gazetteer of Planetary Nomenclature (USGS Astrogeology, public domain; the nightly centre-point file of {stamp}),\n")
            f.write(f"// the maria and every type but the albedo features and the small and satellite craters (craters from {CRATER_FLOOR_KM[body]:.0f} km across). Landing, crash and impact sites from GCAT's lander catalogue (J. McDowell, planet4589.org/space/gcat, CC BY 4.0;\n")
            f.write(f"// updated {updated}): positions, dates, operators and site names are the catalogue's, the Japanese names are ours. Do not edit by hand.\n")
            f.write(f"export const PLACES_{body.upper()} = " + json.dumps(sites + features, ensure_ascii=False, separators=(",", ":")).replace("},{", "},\n{") + " as const;\n")
        print(f"wrote {path} ({os.path.getsize(path) // 1024} kB)", file=sys.stderr)


if __name__ == "__main__":
    main()
