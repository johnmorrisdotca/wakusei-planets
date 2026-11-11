#!/usr/bin/env python3
"""Writes src/data/places-<body>.ts and src/places/<body>.ts for every body of /places beyond the Moon and Mars: the named surface features of 23 bodies and the sites a craft reached, crashed on or entered at 22 of them.

  Named features (Mercury, Venus, Io, Europa, Ganymede, Callisto, Titan, Enceladus, Mimas, Tethys, Dione, Rhea, Iapetus, Miranda, Ariel, Umbriel, Titania, Oberon, Triton, Pluto, Charon, Ceres, Vesta):
  the IAU Gazetteer of Planetary Nomenclature (USGS Astrogeology, public domain), the nightly centre-point shapefiles <https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/<BODY>_nomenclature_center_pts.zip>,
  read from --cache (download them there first, one request each; the script never fetches). The Gazetteer's own page says its shapefiles are "in east longitude, planetocentric latitude" (https://planetarynames.wr.usgs.gov/GIS_Downloads,
  read 2026-11-11). The cut: a body with up to MAX_FEATURES (400) features keeps all of them; a body with more keeps the 400 largest (by the Gazetteer's diameter or length) and every famous one. Fields: name, kind, size in
  kilometres (0 where the Gazetteer gives none), centre, and the origin of the name where the Gazetteer gives it (English).

  Sites (Venus, Mercury, Titan, Eros, Ryugu, Bennu, Dimorphos, Tempel 1, 67P, Jupiter, Saturn): written out below with the source of every position. Where GCAT (J. McDowell, planet4589.org/space/gcat, CC BY 4.0, credited) has the
  craft the dates, operators and countries are its, and so is the position unless a record below names a better one; where a better position is used GCAT's is kept in `gcatPosition` when it differs by more than 0.05 degree.
  Longitudes are east, -180 to 180 (Venus's, Titan's and the other sources' 0-360 east and west figures are converted here and the original is quoted in the record's `source.frame` where it matters).

Usage: python3 -I scripts/make-places-more-data.py --cache DIR [--gcat DIR]   (DIR holds gaz/<BODY>_nomenclature_center_pts.zip; --gcat holds landercat.tsv, default DIR/../2026-11-11-places-data)"""
import importlib.util, json, os, re, sys, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
spec = importlib.util.spec_from_file_location("base", os.path.join(HERE, "make-places-data.py"))
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

READ = "2026-11-11"
MAX_FEATURES = 400
# Venus's sizes are not comparable across types (a corona's width, a valley's length), so its cut is the 25 largest of each type, not the 400 largest of all; every other body with more than 400 keeps the 400 largest
PER_TYPE = {"venus": 25}
FEATURE_BODIES = ["mercury", "venus", "io", "europa", "ganymede", "callisto", "titan", "enceladus", "mimas", "tethys", "dione", "rhea", "iapetus", "miranda", "ariel", "umbriel", "titania", "oberon", "triton", "pluto", "charon", "ceres", "vesta"]
EN_NAME = {"mercury": "Mercury", "venus": "Venus", "io": "Io", "europa": "Europa", "ganymede": "Ganymede", "callisto": "Callisto", "titan": "Titan", "enceladus": "Enceladus", "mimas": "Mimas", "tethys": "Tethys", "dione": "Dione", "rhea": "Rhea",
           "iapetus": "Iapetus", "miranda": "Miranda", "ariel": "Ariel", "umbriel": "Umbriel", "titania": "Titania", "oberon": "Oberon", "triton": "Triton", "pluto": "Pluto", "charon": "Charon", "ceres": "Ceres", "vesta": "Vesta",
           "eros": "Eros", "ryugu": "Ryugu", "bennu": "Bennu", "dimorphos": "Dimorphos", "tempel-1": "Tempel 1", "67p": "67P/Churyumov-Gerasimenko", "jupiter": "Jupiter", "saturn": "Saturn"}
CONST = lambda body: "PLACES_" + body.upper().replace("-", "_")

# Types the Moon's and Mars's script has no word for (English plain word, Japanese; ours, to be reviewed)
TYPE_WORDS_MORE = {
    "Regio, regiones": ("region", "領域"), "Corona, coronae": ("corona", "コロナ"), "Farrum, farra": ("pancake dome", "パンケーキ状ドーム"), "Linea, lineae": ("line", "線状地形"), "Tessera, tesserae": ("tessera", "テセラ"),
    "Flexus, flexūs": ("scalloped ridge", "波形の尾根"), "Facula, faculae": ("bright spot", "明るい斑点"), "Eruptive center": ("eruptive centre", "噴火中心"), "Insula, insulae": ("island", "島"), "Virga, virgae": ("streak", "筋状模様"),
    "Lacuna, lacunae": ("irregular lake", "不規則な湖"), "Flumen, flumina": ("river channel", "流路"), "Fretum, freta": ("strait", "海峡"), "Large ringed feature": ("large ringed feature", "大規模な環状地形"), "Plume, plumes": ("plume", "プルーム"),
    "Arcus, arcūs": ("arc", "弧状地形"), "Saxum, saxa": ("boulder", "岩塊"),
}

# Famous places for suggestions: the English names as the Gazetteer writes them (a feature) or as shown here (a site). Modest on purpose: the ones a reader has heard of.
FAMOUS = {
    "mercury": ["Caloris Planitia", "Tolstoj", "Rembrandt", "Beethoven", "Hokusai", "Kuiper", "Discovery Rupes", "Raditladi", "Rachmaninoff", "MESSENGER impact"],
    "venus": ["Maxwell Montes", "Maat Mons", "Ishtar Terra", "Aphrodite Terra", "Alpha Regio", "Beta Regio", "Artemis Chasma", "Baltis Vallis", "Sif Mons", "Lakshmi Planum", "Venera 7", "Venera 9", "Venera 13"],
    "io": ["Loki Patera", "Pele", "Prometheus", "Tvashtar Paterae", "Pillan Patera", "Boösaule Montes", "Amirani", "Masubi"],
    "europa": ["Pwyll", "Tyre", "Conamara Chaos", "Thera Macula", "Thrace Macula", "Agenor Linea", "Minos Linea", "Cadmus Linea", "Callanish"],
    "ganymede": ["Galileo Regio", "Marius Regio", "Perrine Regio", "Nicholson Regio", "Uruk Sulcus", "Gilgamesh", "Osiris", "Tros", "Memphis Facula"],
    "callisto": ["Valhalla", "Asgard", "Adlinda", "Heimdall"],
    "titan": ["Kraken Mare", "Ligeia Mare", "Punga Mare", "Ontario Lacus", "Xanadu", "Shangri-La", "Adiri", "Belet", "Menrva", "Selk", "Sotra Patera", "Doom Mons", "Mithrim Montes", "Hotei Regio", "Huygens"],
    "enceladus": ["Damascus Sulcus", "Baghdad Sulcus", "Cairo Sulcus", "Alexandria Sulcus", "Samarkand Sulci", "Sarandib Planitia", "Diyar Planitia"],
    "mimas": ["Herschel"], "tethys": ["Odysseus", "Ithaca Chasma"], "dione": ["Evander", "Janiculum Dorsa", "Aeneas"], "rhea": ["Mamaldi", "Inktomi", "Powehiwehi", "Tirawa"],
    "iapetus": ["Cassini Regio", "Roncevaux Terra", "Saragossa Terra", "Turgis", "Engelier"],
    "miranda": ["Verona Rupes", "Inverness Corona", "Arden Corona", "Elsinore Corona"], "ariel": ["Kachina Chasmata", "Kewpie Chasma", "Domovoy"], "umbriel": ["Wunda", "Skynd", "Vuver"],
    "titania": ["Messina Chasmata", "Gertrude", "Ursula"], "oberon": ["Hamlet", "Mommur Chasma", "Othello", "Macbeth"],
    "triton": ["Leviathan Patera", "Ruach Planitia", "Cipango Planum", "Kibu Patera", "Hili", "Mahilani", "Monad Regio"],
    "pluto": ["Sputnik Planitia", "Tombaugh Regio", "Wright Mons", "Piccard Mons", "Hillary Montes", "Tartarus Dorsa", "Virgil Fossae"],
    "charon": ["Caleuche Chasma", "Kubrick Mons", "Dorothy"],
    "ceres": ["Occator", "Ahuna Mons", "Kerwan", "Haulani", "Urvara", "Dantu", "Cerealia Facula", "Vinalia Faculae"],
    "vesta": ["Rheasilvia", "Veneneia", "Divalia Fossae", "Marcia", "Vestalia Terra"],
    "eros": ["NEAR Shoemaker"], "ryugu": ["Hayabusa2 first touchdown", "Hayabusa2 second touchdown"], "bennu": ["OSIRIS-REx"], "dimorphos": ["DART"], "tempel-1": ["Deep Impact impactor"], "67p": ["Philae at Abydos"],
    "jupiter": ["Galileo probe"], "saturn": ["Cassini"],
}

# Japanese names (ours, typed as facts; to be reviewed) of the features a reader may know; every other feature keeps its IAU name as its Japanese name
JA_FEATURES_MORE = {
    "Caloris Planitia": "カロリス平原", "Tolstoj": "トルストイ", "Rembrandt": "レンブラント", "Beethoven": "ベートーヴェン", "Kuiper": "カイパー", "Discovery Rupes": "ディスカバリー崖",
    "Maxwell Montes": "マクスウェル山脈", "Maat Mons": "マート山", "Ishtar Terra": "イシュタル大陸", "Aphrodite Terra": "アフロディーテ大陸", "Alpha Regio": "アルファ領域", "Beta Regio": "ベータ領域", "Sif Mons": "シフ山",
    "Loki Patera": "ロキ・パテラ", "Pele": "ペレ", "Prometheus": "プロメテウス", "Tvashtar Paterae": "トヴァシュタル・パテラ群", "Pillan Patera": "ピラン・パテラ", "Amirani": "アミラニ", "Masubi": "マスビ",
    "Pwyll": "プウィル", "Tyre": "ティルス", "Conamara Chaos": "コナマラ・カオス", "Thera Macula": "テラ斑", "Thrace Macula": "トラキア斑",
    "Galileo Regio": "ガリレオ領域", "Marius Regio": "マリウス領域", "Gilgamesh": "ギルガメシュ", "Valhalla": "ヴァルハラ", "Asgard": "アスガルド",
    "Kraken Mare": "クラーケン海", "Ligeia Mare": "リジア海", "Punga Mare": "プンガ海", "Ontario Lacus": "オンタリオ湖", "Xanadu": "ザナドゥ", "Shangri-La": "シャングリラ", "Adiri": "アディリ", "Menrva": "メンルヴァ", "Selk": "セルク",
    "Damascus Sulcus": "ダマスカス溝", "Baghdad Sulcus": "バグダッド溝", "Cairo Sulcus": "カイロ溝", "Alexandria Sulcus": "アレクサンドリア溝", "Herschel": "ハーシェル", "Odysseus": "オデュッセウス", "Ithaca Chasma": "イタキ峡谷",
    "Verona Rupes": "ヴェローナ崖", "Sputnik Planitia": "スプートニク平原", "Tombaugh Regio": "トンボー領域", "Wright Mons": "ライト山", "Piccard Mons": "ピカール山", "Hillary Montes": "ヒラリー山脈",
    "Leviathan Patera": "リヴァイアサン・パテラ", "Occator": "オッカトル", "Ahuna Mons": "アフナ山", "Kerwan": "カーワン", "Rheasilvia": "レアシルウィア", "Veneneia": "ヴェネネイア", "Kubrick Mons": "キューブリック山",
}

BODY_NOTE = {"vesta": "Vesta's longitudes are in the Gazetteer's own coordinate system for the asteroid (its file has no projection).", }


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def gcat_rows(path):
    updated, rows = "", {}
    for line in open(path, encoding="utf-8"):
        if line.startswith("#"):
            m = re.search(r"Updated (\d{4}) ([A-Z][a-z]{2}) +(\d{1,2})", line)
            if m:
                updated = base.gcat_date(f"{m.group(1)} {m.group(2)} {m.group(3)}")
            continue
        p = [x.strip() for x in line.rstrip("\n").split("\t")]
        if len(p) < 16:
            continue
        jcat, piece, name, owner, state, world, lon, lat, ltype, status, launch, land, off, dur, site, comment = p[:16]
        rows.setdefault(name, []).append({"name": name, "owner": owner, "state": state, "world": world, "lon": lon, "lat": lat, "ltype": ltype, "status": status, "land": land, "off": off, "site": site, "comment": comment})
    return rows, updated


def features(body, cache):
    path = os.path.join(cache, "gaz", f"{body.upper()}_nomenclature_center_pts.zip")
    z = zipfile.ZipFile(path)
    info = z.getinfo(f"{body.upper()}_nomenclature_center_pts.dbf")
    stamp = "%04d-%02d-%02d" % info.date_time[:3]
    rows = base.read_dbf(z.read(info.filename))
    out = []
    for row in rows:
        kind = row["type"]
        words = base.TYPE_WORDS.get(kind) or TYPE_WORDS_MORE.get(kind)
        if words is None:
            raise SystemExit(f"no plain word for the type {kind!r} ({body})")
        diameter = float(row["diameter"] or 0)
        name = row["name"]
        record = {
            "id": f"{body}/{slug(row['clean_name'])}", "kind": "feature",
            "name": {"en": name, "ja": JA_FEATURES_MORE.get(name, name)},
            "lat": round(float(row["center_lat"]), 4), "lon": round(base.east180(row["center_lon"]), 4),
            "feature": {"type": kind, "typeWord": {"en": words[0], "ja": words[1]}, "diameterKm": round(diameter, 2), "approved": row["approvaldt"][:10].replace("/", "-")},
        }
        if row["origin"]:
            record["origin"] = re.sub(r"\s+", " ", row["origin"]).strip()
        record["source"] = {"id": "iau-gazetteer", "read": stamp}
        out.append(record)
    total = len(out)
    famous = set(FAMOUS.get(body, [])) - {s["name"] for s in SITES.get(body, [])}
    found = {r["name"]["en"] for r in out}
    missing = famous - found
    if missing:
        raise SystemExit(f"{body}: famous names not in the Gazetteer: {sorted(missing)}")
    out.sort(key=lambda f: (-f["feature"]["diameterKm"], f["name"]["en"]))
    kept = out
    cut = 0.0
    if total > MAX_FEATURES and body in PER_TYPE:
        count = {}
        kept = []
        for f in out:
            count[f["feature"]["type"]] = count.get(f["feature"]["type"], 0) + 1
            if count[f["feature"]["type"]] <= PER_TYPE[body] or f["name"]["en"] in famous:
                kept.append(f)
        cut = PER_TYPE[body]
    elif total > MAX_FEATURES:
        kept = [f for i, f in enumerate(out) if i < MAX_FEATURES or f["name"]["en"] in famous]
        cut = out[MAX_FEATURES - 1]["feature"]["diameterKm"]
    for f in kept:
        if f["name"]["en"] in famous:
            f["famous"] = True
    return kept, stamp, total, cut


def decimals(text):
    return len(text.split(".")[1]) if "." in text else 0


# Sites. gcat: the catalogue's object name (operator, country, mission and, unless given, date and position come from it). pos: "gcat" or (lat, lon east -180..180 or 0..360 as typed, how typed, source id, url, latitude convention).
# kind/outcome follow the Moon's and Mars's: landing/soft, crash/hard (a craft lost on the surface, an orbiter let fall), impact/impact (sent to hit it), entry/entry (a probe lost in an atmosphere).
NTRS = "https://ntrs.nasa.gov/citations/19930005108"
PDS_PV = "https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PIONEER_Venus/venus_cp.html"
SITES = {
    "venus": [
        dict(name="Venera 4", ja="ベネラ4号", gcat="Spuskaemiy apparat Veneri-4", kind="entry", outcome="entry", note="descent craft crushed in the atmosphere"),
        dict(name="Venera 5", ja="ベネラ5号", gcat="SA Veneri-5", kind="entry", outcome="entry", note="descent craft crushed in the atmosphere"),
        dict(name="Venera 6", ja="ベネラ6号", gcat="SA Veneri-6", kind="entry", outcome="entry", note="descent craft crushed in the atmosphere"),
        dict(name="Venera 7", ja="ベネラ7号", gcat="SA Veneri-7", kind="landing", outcome="soft", note="the first landing on another planet"),
        dict(name="Venera 8", ja="ベネラ8号", gcat="SA Veneri-8", kind="landing", outcome="soft", pos=(-10.70, 335.25, "south, east 0-360", "nasa-ntrs", NTRS, "not stated")),
        dict(name="Venera 9", ja="ベネラ9号", gcat="SA Veneri-9", kind="landing", outcome="soft", note="the first picture from the surface of another planet", pos=(31.01, 291.64, "north, east 0-360", "nasa-ntrs", NTRS, "not stated")),
        dict(name="Venera 10", ja="ベネラ10号", gcat="SA Veneri-10", kind="landing", outcome="soft", pos=(15.42, 291.51, "north, east 0-360", "nasa-ntrs", NTRS, "not stated")),
        dict(name="Venera 11", ja="ベネラ11号", gcat="SA Veneri-11", kind="landing", outcome="soft"),
        dict(name="Venera 12", ja="ベネラ12号", gcat="SA Veneri-12", kind="landing", outcome="soft"),
        dict(name="Venera 13", ja="ベネラ13号", gcat="SA Veneri-13", kind="landing", outcome="soft", note="the first colour pictures of the surface", pos=(-7.55, 303.69, "south, east 0-360", "nasa-ntrs", NTRS, "not stated")),
        dict(name="Venera 14", ja="ベネラ14号", gcat="SA Veneri-14", kind="landing", outcome="soft", pos=(-13.05, 310.19, "south, east 0-360", "nasa-ntrs", NTRS, "not stated")),
        dict(name="Vega 1 lander", ja="ベガ1号 着陸機", gcat="SA Vega-1", kind="landing", outcome="soft", pos=(8.10, 175.85, "north, east 0-360", "nasa-ntrs", NTRS, "not stated")),
        dict(name="Vega 2 lander", ja="ベガ2号 着陸機", gcat="SA Vega-2", kind="landing", outcome="soft", pos=(-7.14, 177.67, "south, east 0-360", "nasa-ntrs", NTRS, "not stated")),
        dict(name="Pioneer Venus Large Probe", ja="パイオニア・ヴィーナス 大型プローブ", gcat="Sounder Probe", kind="crash", outcome="hard", date="1978-12-09T19:39Z", pos=(4.4, 304.0, "north, east 0-360", "pds-atmospheres", PDS_PV, "not stated"), note="reached the surface; the signal ended at touchdown"),
        dict(name="Pioneer Venus North Probe", ja="パイオニア・ヴィーナス 北プローブ", gcat="North Probe", kind="crash", outcome="hard", date="1978-12-09T19:42Z", pos=(59.3, 4.8, "north, east 0-360", "pds-atmospheres", PDS_PV, "not stated"), note="reached the surface; the signal ended at touchdown"),
        dict(name="Pioneer Venus Day Probe", ja="パイオニア・ヴィーナス 昼側プローブ", gcat="Day Probe", kind="landing", outcome="soft", date="1978-12-09T19:47Z", pos=(-31.3, 317.0, "south, east 0-360", "pds-atmospheres", PDS_PV, "not stated"), note="kept sending for about an hour after touchdown"),
        dict(name="Pioneer Venus Night Probe", ja="パイオニア・ヴィーナス 夜側プローブ", gcat="Night Probe", kind="crash", outcome="hard", date="1978-12-09T19:52Z", pos=(-28.7, 56.7, "south, east 0-360", "pds-atmospheres", PDS_PV, "not stated"), note="reached the surface; the signal ended at touchdown"),
        dict(name="Pioneer Venus Bus", ja="パイオニア・ヴィーナス 母船", gcat="Pioneer Venus Multiprobe", kind="entry", outcome="entry", date="1978-12-09T20:22Z", pos=(-37.9, 290.9, "south, east 0-360", "pds-atmospheres", PDS_PV, "not stated"), note="the carrier burned up in the atmosphere; its signal ended at 110 km"),
    ],
    "mercury": [
        dict(name="MESSENGER impact", ja="メッセンジャー 衝突地点", gcat="Messenger", kind="crash", outcome="hard", mission="MESSENGER", note="the orbiter fell onto the surface at the end of its mission, at 3.9 km/s, making a crater about 16 m across",
             pos=(54.4398, 210.1205, "north, east 0-360", "agency", "https://science.nasa.gov/photojournal/best-determination-of-messengers-impact-location/", "not stated")),
    ],
    "titan": [
        dict(name="Huygens", ja="ホイヘンス", gcat="Huygens", kind="landing", outcome="soft", note="the only landing in the outer Solar System",
             pos=(-10.3, 167.7, "south, west 192.3", "agency", "https://photojournal.jpl.nasa.gov/catalog/PIA06437", "not stated")),
    ],
    "eros": [
        dict(name="NEAR Shoemaker", ja="ニア・シューメーカー", gcat="NEAR Shoemaker", kind="landing", outcome="soft", date="2001-02-12T20:01Z", note="an orbiter that was not designed to land; it touched down and went on working",
             pos=(-37.2, 81.6, "south, west 278.4", "agency", "https://sbn.psi.edu/pds/resource/near/NEAR_Coordinate_Systems.txt", "planetocentric"), unverified="the PDS file refused automated reading (HTTP 403); the figures are as a search extract quoted them"),
    ],
    "ryugu": [
        dict(name="Hayabusa2 first touchdown", ja="はやぶさ2 第1回タッチダウン", gcat=("Hayabusa-2", "2019 Feb 21"), kind="landing", outcome="soft", site="Tamatebako", note="touch-and-go sampling"),
        dict(name="SCI impact", ja="はやぶさ2 SCI 衝突地点", gcat="SCI", kind="impact", outcome="impact", note="the small carry-on impactor's artificial crater"),
        dict(name="Hayabusa2 second touchdown", ja="はやぶさ2 第2回タッチダウン", gcat=("Hayabusa-2", "2019 Jul 11"), kind="landing", outcome="soft", site="Uchide-no-kozuchi", note="touch-and-go sampling beside the artificial crater"),
        dict(name="MASCOT", ja="マスコット", gcat="MASCOT", kind="landing", outcome="soft", note="the German-French lander, which worked for about 17 hours"),
    ],
    "bennu": [
        dict(name="OSIRIS-REx", ja="オサイリス・レックス", gcat="OSIRIS-REx", kind="landing", outcome="soft", site="Nightingale", note="touch-and-go sampling"),
    ],
    "dimorphos": [
        dict(name="DART", ja="DART", gcat="DART", kind="impact", outcome="impact", note="the kinetic impactor, at 6.14 km/s",
             pos=(-8.84, 264.30, "south, east 0-360", "paper", "https://pmc.ncbi.nlm.nih.gov/articles/PMC10115643/", "not stated")),
    ],
    "tempel-1": [
        dict(name="Deep Impact impactor", ja="ディープ・インパクト インパクター", gcat="DI Impactor", kind="impact", outcome="impact", date="2005-07-04", approximate=True,
             pos=(-28.0, 16.0, "south, east", "paper", "https://arxiv.org/pdf/1406.3308", "not stated"), frame="the comet's shape-model frame of Thomas et al. 2013 (the position in the older model was 26 S, 15 E)", note="the impactor; its crater was found by Stardust-NExT in 2011"),
    ],
    "67p": [
        dict(name="Philae at Abydos", ja="フィラエ (アビドス)", gcat=("Philae", "Abydos"), kind="landing", outcome="soft", site="Abydos", approximate=True,
             pos=(-8.04, -1.60, "south, east", "paper", "https://arxiv.org/pdf/2008.03180", "not stated"), frame="the comet-fixed frame the paper uses, quoting Ulamec et al. 2017", note="the final place, after two bounces from Agilkia",
             unverified="the paper quotes Ulamec et al. 2017 and does not name the frame; ESA's own pages were read and give no coordinates"),
    ],
    "jupiter": [
        dict(name="Galileo probe", ja="ガリレオ 大気プローブ", gcat="Galileo Probe", kind="entry", outcome="entry", date="1995-12-07T22:04Z", note="entered the atmosphere; sent data for 58 minutes",
             pos=(6.5, -4.4, "north, west 4.4", "agency", "https://solarsystem.nasa.gov/missions/galileo-probe/in-depth", "not stated")),
        dict(name="Galileo orbiter", ja="ガリレオ 周回機", gcat="Galileo", kind="entry", outcome="entry", approximate=True, note="sent into the atmosphere at the end of its mission, to keep it from ever reaching Europa; NASA gives the entry point as about a quarter of a degree south of the equator (its longitude is the catalogue's)",
             unverified="the longitude is GCAT's and no NASA page was found that gives it"),
    ],
    "saturn": [
        dict(name="Cassini", ja="カッシーニ", gcat="Cassini", kind="entry", outcome="entry", approximate=True, note="plunged into the atmosphere at the end of its mission",
             pos=(9.4, -53.0, "north, west 53", "agency", "https://science.nasa.gov/photojournal/impact-site-infrared-image/", "not stated")),
    ],
}


def site_records(body, gcat_path):
    rows, updated = gcat_rows(gcat_path)
    out = []
    for spec_ in SITES[body]:
        key = spec_["gcat"]
        if isinstance(key, tuple):
            candidates = [r for r in rows[key[0]] if key[1] in r["land"] or key[1] in r["site"]]
        else:
            candidates = rows[key]
        row = candidates[0]
        date = spec_.get("date") or base.gcat_date(row["land"].replace("?", "") if "?" not in row["land"] else re.sub(r" \d{4}.*", "", row["land"]))
        gc_lat, gc_lon = (float(row["lat"].rstrip("?")), base.east180(row["lon"].rstrip("?"))) if row["lat"] not in ("-", "") and row["lon"] not in ("-", "") else (None, None)
        if spec_.get("pos") is None:
            lat, lon = gc_lat, gc_lon
            if lat is None:
                raise SystemExit(f"{spec_['name']}: GCAT has no position and none is given")
            src = {"id": "gcat-landercat", "read": updated, "latitude": "not stated"}
            approx = decimals(row["lat"].rstrip("?")) <= 1 and decimals(row["lon"].rstrip("?")) <= 1 or "?" in row["lat"] + row["lon"]
        else:
            lat, lon, how, sid, url, convention = spec_["pos"]
            typed_lon = lon
            lon = round(base.east180(lon), 4)
            src = {"id": sid, "read": READ, "url": url, "latitude": convention}
            approx = decimals(str(lat)) <= 1 and decimals(str(typed_lon)) <= 1
        if spec_.get("approximate"):
            approx = True
        record = {
            "id": f"{body}/{slug(spec_['name'])}", "kind": spec_["kind"], "name": {"en": spec_["name"], "ja": spec_["ja"]},
            "lat": round(lat, 4), "lon": round(lon, 4), "date": date, "mission": spec_.get("mission", row["name"]), "operator": row["owner"], "country": row["state"], "outcome": spec_["outcome"],
            "source": src,
        }
        if gc_lat is not None and spec_.get("pos") is not None and (abs(gc_lat - lat) > 0.05 or abs(base.east180(gc_lon) - lon) > 0.05):
            record["gcatPosition"] = [round(gc_lat, 4), round(gc_lon, 4)]
        if approx:
            record["approximate"] = True
        site = spec_.get("site") or (row["site"] if row["site"] not in ("-", "") else None)
        if site:
            record["site"] = site
        if spec_.get("note"):
            record["note"] = spec_["note"]
        if spec_.get("frame"):
            record["source"]["frame"] = spec_["frame"]
        if row["off"] not in ("-", "*", "") and spec_["kind"] == "landing":
            until = base.gcat_date(row["off"])
            if until and until != date:
                record["until"] = until
        if spec_["name"] in FAMOUS.get(body, []):
            record["famous"] = True
        out.append(record)
        if spec_.get("unverified"):
            print(f"  unverified: {body} {spec_['name']}: {spec_['unverified']}", file=sys.stderr)
    out.sort(key=lambda r: r["date"] or "")
    return out, updated


def entry_file(body):
    const = CONST(body)
    en = EN_NAME[body]
    return (f"// The places on {en}: a single list. See `/places` for the record's shape and the lookups.\n"
            f"import {{ {const} as DATA }} from \"../data/places-{body}.ts\";\n"
            f"import type {{ Place }} from \"../places.ts\";\n\n"
            "/**\n"
            f" * Every place on {en} the package knows: the sites first, by date, then the named features by size (a feature's `diameterKm` is 0 where the Gazetteer gives no size). A place's `kind` says what it is\n"
            " * (`placesOfKind` from `/places` picks by it); `famous` marks the ones a page can suggest.\n"
            " *\n"
            " * @example\n"
            " * ```ts\n"
            f" * import {{ {const} }} from \"@johnmorrisdotca/wakusei-planets/places/{body}\";\n"
            " *\n"
            f" * console.log({const}.length, \"places;\", {const}.filter((place) => place.famous).map((place) => place.name.en).slice(0, 3).join(\", \"));\n"
            " * ```\n"
            " */\n"
            f"export const {const}: readonly Place[] = DATA as unknown as readonly Place[];\n")


def main():
    args = sys.argv[1:]
    cache = args[args.index("--cache") + 1] if "--cache" in args else os.path.expanduser("~/Projects/backups/wakusei-planets/2026-11-11-data-places-more")
    gcat = args[args.index("--gcat") + 1] if "--gcat" in args else os.path.expanduser("~/Projects/backups/wakusei-planets/2026-11-11-places-data")
    gcat_path = os.path.join(gcat, "landercat.tsv")
    bodies = sorted(set(FEATURE_BODIES) | set(SITES), key=lambda b: ([*FEATURE_BODIES, *SITES].index(b)))
    summary = {}
    for body in bodies:
        sites, updated = ([], "")
        if body in SITES:
            sites, updated = site_records(body, gcat_path)
        feats, stamp, total, cut = ([], "", 0, 0.0)
        if body in FEATURE_BODIES:
            feats, stamp, total, cut = features(body, cache)
        places = sites + feats
        # ids are unique: a second place with the same slug (two features with one name on the Gazetteer) gets a count
        seen = {}
        for place in places:
            seen[place["id"]] = seen.get(place["id"], 0) + 1
            if seen[place["id"]] > 1:
                place["id"] = f"{place['id']}-{seen[place['id']]}"
        header = f"// Made by scripts/make-places-more-data.py. "
        if feats:
            header += (f"Named features from the IAU Gazetteer of Planetary Nomenclature (USGS Astrogeology, public domain; the nightly centre-point file of {stamp}; east longitude, planetocentric latitude): "
                       + (f"all {total}" if total <= MAX_FEATURES else f"the {int(cut)} largest of each type, of {total}, and the famous ones" if body in PER_TYPE else f"the {MAX_FEATURES} largest of {total} (from {cut:g} km) and the famous ones") + ". ")
        if sites:
            header += f"Sites from GCAT's lander catalogue (J. McDowell, planet4589.org/space/gcat, CC BY 4.0; updated {updated}) and the sources each record names. "
        header += "Japanese names are ours. Do not edit by hand.\n"
        path = os.path.join(ROOT, "src", "data", f"places-{body}.ts")
        with open(path, "w") as f:
            f.write(header)
            f.write(f"export const {CONST(body)} = " + json.dumps(places, ensure_ascii=False, separators=(",", ":")).replace("},{", "},\n{") + " as const;\n")
        with open(os.path.join(ROOT, "src", "places", f"{body}.ts"), "w") as f:
            f.write(entry_file(body))
        kinds = {}
        for p in places:
            kinds[p["kind"]] = kinds.get(p["kind"], 0) + 1
        summary[body] = {"sites": len(sites), "features": len(feats), "of": total, "cut": cut, "famous": sum(1 for p in places if p.get("famous")), "kb": os.path.getsize(path) // 1024}
        print(f"{body}: {len(sites)} sites, {len(feats)} of {total} features (cut {cut:g} km), {summary[body]['famous']} famous, {kinds}, {summary[body]['kb']} kB", file=sys.stderr)
    json.dump(summary, open(os.path.join(cache, "summary.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
