#!/usr/bin/env python3
"""Writes src/data/discovery.ts: when, where, how and by whom each planet, dwarf planet and fully drawn moon was found, how it was first designated and numbered, and where its name comes from.

Every fact carries the source it was read from (SOURCES below). Nothing here is fetched when this runs: the records below were read on 2026-11-18 and are kept as they are, so a change to a fact is a change to this
file, with its source. The sources:
- "usgs": the IAU Working Group for Planetary System Nomenclature's Gazetteer of Planetary Nomenclature, hosted by the USGS Astrogeology Science Center (a US government work), "Planet and Satellite Names,
  Discoverers, and Themes" (https://planetarynames.wr.usgs.gov/Page/Planets): the date, the place and the discoverers, and the account of where each name comes from, which is told here in our own words.
- "jpl-sbdb": the discovery record of the JPL Small-Body Database API (https://ssd-api.jpl.nasa.gov/sbdb.api?discovery=1), which holds what the Minor Planet Center published: the first provisional designation,
  the date, the place and the discoverers of a numbered minor planet, and the batch of the Center's circulars that numbered it (`ref`) and named it (`cref`).
- "jpl-ssd-moons": JPL's Planetary Satellite Discovery Circumstances (https://ssd.jpl.nasa.gov/sats/discovery.html, the read of /moon-catalogue, 2026-11-11): a moon's provisional designation and the circular that announced it.
- "wikidata": Wikidata (CC0, https://www.wikidata.org/, read 2026-11-18) where the sources above give nothing: the four names credited with Neptune, and the day Vanth was found.
- "derived": worked out here from the place and the date of the same record (the instrument of the day), not a published field: the `method` of every record.
Where Wikidata gives a different day from the source used, the record says so in `notes`.

Usage: python3 -I scripts/make-discovery-data.py   (writes src/data/discovery.ts; no network)"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

U, S, M, W, D = "usgs", "jpl-sbdb", "jpl-ssd-moons", "wikidata", "derived"
ANCIENT_NOTE = "Known since before recorded history; the Gazetteer of Planetary Nomenclature gives no discovery for it."

# id: (kind, ancient, date, date source, place, place source, by, by source, method, designation, designation source, number, announced, named by, name origin, notes)
R = {}
def rec(id, kind, **kw):
    R[id] = {"id": id, "kind": kind, **kw}

# --- planets -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
# the planets known since before recorded history: Wikidata's "named after" says whose names they carry (Mercury: the Roman god Mercury and the Greek Hermes; Mars: Mars and Ares)
for pid, origin in [("mercury", "Named for the Roman god Mercury (the Greek Hermes)."), ("venus", "Named for the Roman goddess Venus."), ("earth", None),
                    ("mars", "Named for the Roman god Mars (the Greek Ares)."), ("jupiter", "Named for the Roman god Jupiter."), ("saturn", "Named for the Roman god Saturn.")]:
    rec(pid, "planet", ancient=True, date=None, place=None, by=None, method=("ancient", D), designation=None, number=None, announced=None, namedBy=None, nameOrigin=(origin, W) if origin else None,
        notes=[ANCIENT_NOTE if pid != "earth" else "The Earth has always been known, so there is no discovery. Its name is not that of a god, and Wikidata's \"named after\" for it is a list of words for ground and land, which is not given as a fact here."])
rec("uranus", "planet", ancient=False, date=("1781-03-13", U), place=("Bath", U), by=(["W. Herschel"], U), method=("visual", D), designation=None, number=None, announced=None, namedBy=None,
    nameOrigin=("Named for Uranus (Greek Ouranos), the god of the sky.", W),
    notes=["The Gazetteer gives no account of the name; the name is Wikidata's (named after: Uranus, the mythological figure)."])
rec("neptune", "planet", ancient=False, date=("1846-09-23", U), place=("Berlin", U), by=(["J.G. Galle"], U), method=("calculation", D), designation=None, number=None, announced=None, namedBy=None,
    nameOrigin=("Named for the Roman god Neptune.", W),
    notes=["The Gazetteer credits J.G. Galle, who found it at Berlin. Wikidata credits four people: Urbain Le Verrier and John Couch Adams, who each calculated where it should be, and Johann Galle and Heinrich d'Arrest, who found it (Wikidata Q332, discoverer)."])

# --- dwarf planets -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
rec("ceres", "dwarf-planet", ancient=False, date=("1801-01-01", U), place=("Palermo Astronomical Observatory", U), by=(["Giuseppe Piazzi"], U), method=("visual", D), designation=("A801 AA", S), number=("(1)", S), announced=None, namedBy=None,
    nameOrigin=("Named for the Roman goddess of corn and harvests.", U), notes=[])
rec("pluto", "dwarf-planet", ancient=False, date=("1930-01-23", U), place=("Flagstaff, Arizona (Lowell Observatory)", U), by=(["C.W. Tombaugh"], U), method=("photographic", D), designation=("1930 BM", S), number=("(134340)", S), announced=None, namedBy=None,
    nameOrigin=("Named for the Roman god of the underworld, who could make himself invisible.", U),
    notes=["The Gazetteer's date; Wikidata gives 18 February 1930.", "The Gazetteer says it was found at Lowell Observatory in a systematic search for the trans-Neptune planet that Percival Lowell and William Pickering had predicted."])
rec("haumea", "dwarf-planet", ancient=False, date=("2003-03-07", U), place=("Sierra Nevada Observatory, Spain", U), by=None, method=("electronic", D), designation=("2003 EL61", S), number=("(136108)", S), announced=None, namedBy=None,
    nameOrigin=("Named for the Hawaiian goddess of childbirth and fertility.", U),
    notes=["The Gazetteer and JPL (the Minor Planet Center's record) name the Sierra Nevada Observatory and no people, so none is given here.", "Wikidata lists Pablo Santos-Sanz, José Luis Ortiz Moreno and Michael E. Brown, and gives Cerro Tololo as a second site."])
rec("makemake", "dwarf-planet", ancient=False, date=("2005-03-31", U), place=("Palomar Observatory", U), by=(["M.E. Brown", "C.A. Trujillo", "D.L. Rabinowitz"], U), method=("electronic", D), designation=("2005 FY9", S), number=("(136472)", S), announced=None, namedBy=None,
    nameOrigin=("Named for the creator god of the Rapa Nui of Easter Island.", U), notes=[])
rec("eris", "dwarf-planet", ancient=False, date=("2003-10-21", U), place=("Palomar Observatory", U), by=(["M.E. Brown", "C.A. Trujillo", "D. Rabinowitz"], U), method=("electronic", D), designation=("2003 UB313", S), number=("(136199)", S), announced=None, namedBy=None,
    nameOrigin=("Named for the Greek goddess of discord and strife.", U), notes=["The Gazetteer's date."])
rec("orcus", "dwarf-planet", ancient=False, date=("2004-02-17", S), place=("Palomar Observatory", S), by=(["M. Brown", "C. Trujillo", "D. Rabinowitz"], S), method=("electronic", D), designation=("2004 DW", S), number=("(90482)", S), announced=None, namedBy=None,
    nameOrigin=("Named for the Roman god of death, the counterpart of the Greek Pluto.", S), notes=[])
rec("quaoar", "dwarf-planet", ancient=False, date=("2002-06-04", S), place=("Palomar Observatory", S), by=(["C.A. Trujillo", "M.E. Brown"], S), method=("electronic", D), designation=("2002 LM60", S), number=("(50000)", S), announced=None, namedBy=None,
    nameOrigin=("Named for a creator force of the Tongva people of the Los Angeles basin.", S), notes=[])
rec("gonggong", "dwarf-planet", ancient=False, date=("2007-07-17", S), place=("Palomar Observatory", S), by=(["M.E. Schwamb", "M.E. Brown", "D. Rabinowitz"], S), method=("electronic", D), designation=("2007 OR10", S), number=("(225088)", S), announced=None, namedBy=None,
    nameOrigin=("Named for Gonggong, a Chinese water god with red hair and a serpent's tail.", S), notes=[])
rec("sedna", "dwarf-planet", ancient=False, date=("2003-11-14", S), place=("Palomar Observatory", S), by=(["M.E. Brown", "C.A. Trujillo", "D. Rabinowitz"], S), method=("electronic", D), designation=("2003 VB12", S), number=("(90377)", S), announced=None, namedBy=None,
    nameOrigin=("Named for the Inuit goddess of the sea and its creatures.", S), notes=[])

# --- the Moon and the moons drawn in full ---------------------------------------------------------------------------------------------------------------------------------------------------------
rec("moon", "moon", ancient=True, date=None, place=None, by=None, method=("ancient", D), designation=None, number=("Earth I", U), announced=None, namedBy=None,
    nameOrigin=("Every language has its own name for it; English Moon, Latin Luna, French Lune, German Mond, Greek Selene.", U), notes=["Always known; the Gazetteer gives it no discovery."])
def moon(id, num, date, place, by, method, origin, named_by=None, des=None, ann=None, notes=(), date_src=U, place_src=U, by_src=U, des_src=M, origin_src=U):
    rec(id, "moon", ancient=False, date=(date, date_src) if date else None, place=(place, place_src) if place else None, by=(by, by_src) if by else None, method=(method, D) if method else None,
        designation=(des, des_src) if des else None, number=(num, M), announced=(ann, M) if ann else None, namedBy=(named_by, U) if named_by else None, nameOrigin=(origin, origin_src), notes=list(notes))
moon("phobos", "Mars I", "1877-08-17", "Washington", ["A. Hall"], "visual", "Named for one of the horses that drew the chariot of Mars; in Greek the word means flight.")
moon("deimos", "Mars II", "1877-08-11", "Washington", ["A. Hall"], "visual", "Named for the other horse that drew the chariot of Mars; in Greek the word means fear.")
moon("io", "Jupiter I", "1610-01-08", "Padua", ["Galileo"], "visual", "Named for Io, whom Jupiter changed into a cow to hide her from Hera's jealousy; a gadfly drove her wandering.",
     notes=["Simon Marius probably saw the Galilean moons at about the same time and may have sighted them up to a month earlier; the Gazetteer gives the priority to Galileo, who published first.", "Wikidata gives 7 January 1610."])
moon("europa", "Jupiter II", "1610-01-08", "Padua", ["Galileo"], "visual", "Named for the daughter of King Agenor of Tyre, whom Jupiter carried to Crete in the shape of a white bull.",
     notes=["The Gazetteer adds that Galileo evidently saw the combined image of Io and Europa the night before.", "Wikidata gives 7 January 1610."])
moon("ganymede", "Jupiter III", "1610-01-07", "Padua", ["Galileo"], "visual", "Named for the beautiful boy whom Jupiter, as an eagle, carried to Olympus to be the gods' cupbearer.")
moon("callisto", "Jupiter IV", "1610-01-07", "Padua", ["Galileo"], "visual", "Named for the daughter of Lycaon, whom Jupiter changed into a bear to shield her from Hera's jealousy.")
moon("mimas", "Saturn I", "1789-07-18", "Slough", ["W. Herschel"], "visual", "Named for a Giant of Greek myth, struck down in the war between the Titans and the Olympian gods.", named_by="John Herschel, William Herschel's son, in the early 19th century",
     notes=["Wikidata and Wikipedia give 17 September 1789."])
moon("enceladus", "Saturn II", "1789-08-28", "Slough", ["W. Herschel"], "visual", "Named for the Giant that Athene crushed under Sicily in the battle between the Olympian gods and the Titans.", named_by="John Herschel")
moon("tethys", "Saturn III", "1684-03-21", "Paris", ["G.D. Cassini"], "visual", "Named for the Titaness, wife of Oceanus and mother of the rivers and the sea nymphs.", named_by="John Herschel, in the early 19th century; Cassini had wished to name his four moons for Louis XIV",
     notes=["Wikidata gives 21 March 1684 as well as a bare year; Wikipedia's infobox gives 11 March 1684."])
moon("dione", "Saturn IV", "1684-03-21", "Paris", ["G.D. Cassini"], "visual", "Named for the Titaness, sister of Cronos and mother, by Zeus, of Aphrodite.", named_by="John Herschel, in the early 19th century")
moon("rhea", "Saturn V", "1672-12-23", "Paris", ["G.D. Cassini"], "visual", "Named for the Titaness who bore Zeus to Kronos.", named_by="John Herschel, in the early 19th century")
moon("titan", "Saturn VI", "1655-03-25", "The Hague", ["C. Huygens"], "visual", "Named for the Titans, the Giants of Greek myth overthrown by the Olympian gods; Huygens first called it Luna Saturni, the moon of Saturn.")
moon("iapetus", "Saturn VIII", "1671-10-25", "Paris", ["G.D. Cassini"], "visual", "Named for one of the Titans.", named_by="John Herschel")
moon("ariel", "Uranus I", "1851-10-24", "Liverpool", ["W. Lassell"], "visual", "Named for a sylph in Pope's poem The Rape of the Lock.", named_by="John Herschel")
moon("umbriel", "Uranus II", "1851-10-24", "Liverpool", ["W. Lassell"], "visual", "Named for a malevolent spirit in Pope's poem The Rape of the Lock.", named_by="John Herschel")
moon("titania", "Uranus III", "1787-01-11", "Slough", ["W. Herschel"], "visual", "Named for the queen of the fairies in Shakespeare's A Midsummer Night's Dream.", named_by="John Herschel, in the early 19th century")
moon("oberon", "Uranus IV", "1787-01-11", "Slough", ["W. Herschel"], "visual", "Named for the king of the fairies in Shakespeare's A Midsummer Night's Dream.", named_by="John Herschel, in the early 19th century")
moon("miranda", "Uranus V", "1948-02-16", "Fort Davis", ["G.P. Kuiper"], "photographic", "Named for the heroine of Shakespeare's The Tempest.", named_by="Gerard Kuiper")
moon("triton", "Neptune I", "1846-10-10", "Liverpool", ["W. Lassell"], "visual", "Named for the sea god, son of Poseidon (Neptune) and Amphitrite; the name is credited to the French astronomer Camille Flammarion.")
moon("nereid", "Neptune II", "1949-05-01", "Fort Davis (McDonald Observatory)", ["G.P. Kuiper"], "photographic", "Named for the Nereids, the fifty daughters of the sea god Nereus and Doris, who attended Poseidon (Neptune).")
moon("proteus", "Neptune VIII", "1989-06", "Voyager 2", ["Voyager Science Team"], "spacecraft", "Named for the Greek sea god, son of Oceanus and Tethys.", des="S/1989 N 1",
     notes=["The Gazetteer gives the month only. Wikidata gives 16 June 1989 and credits Stephen Synnott."])
moon("charon", "Pluto I", "1978-04-13", "Flagstaff", ["J.W. Christy"], "photographic", "Named for the Greek boatman who ferried souls across the river Styx to Pluto for judgement.", des="S/1978 P 1",
     notes=["The Gazetteer's date; Wikidata gives 22 June 1978 and the United States Naval Observatory Flagstaff Station as the place."])
NIXH = ["H.A. Weaver", "S.A. Stern", "M.J. Mutchler", "A.J. Steffl", "M.W. Buie", "W.J. Merline", "J.R. Spencer", "E.F. Young", "L.A. Young"]
moon("nix", "Pluto II", "2005-05-15", "Hubble Space Telescope", NIXH, "space-telescope", "Named for the goddess of darkness and night and mother of Charon; Nix is the Egyptian spelling of the Greek Nyx.", des="S/2005 P 2", ann="IAUC 8625")
moon("hydra", "Pluto III", "2005-05-15", "Hubble Space Telescope", NIXH, "space-telescope", "Named for the many-headed serpent monster of Greek myth that guarded the underworld.", des="S/2005 P 1", ann="IAUC 8625")
moon("vanth", "Orcus I", "2005-11-13", None, None, None, "Named for Vanth, a figure of Etruscan myth.", des="S/2005 (90482) 1", ann="IAUC 8812 (Brown and Suer, 2007)", date_src=W, origin_src=W,
     notes=["The day is Wikidata's; JPL gives the year only. Neither source names the place or the instrument, so they are left out here.", "The name is Wikidata's (named after: Vanth, the Etruscan figure); neither the Gazetteer nor JPL gives an account of it."])
moon("hiiaka", "Haumea I", "2005-01-26", "Keck Observatory, Mauna Kea", ["M.E. Brown and the adaptive-optics team"], "adaptive-optics", "Named for a daughter of Haumea, patron goddess of the island of Hawaii and of hula dancers.", des="S/2005 (136108) 1", ann="IAUC 8577")
moon("namaka", "Haumea II", "2005-11-07", "Keck Observatory, Mauna Kea", ["M.E. Brown and the adaptive-optics team"], "adaptive-optics", "Named for a daughter of Haumea, a water spirit of Hawaiian myth.", des="S/2005 (136108) 2", ann="IAUC 8636",
     notes=["Wikidata gives 30 June 2005."])
moon("dysnomia", "Eris I", "2005-09-10", "Keck Observatory, Mauna Kea", ["M.E. Brown and the adaptive-optics team"], "adaptive-optics", "Named for the daughter of Eris, the spirit of lawlessness.", des="S/2005 (136199) 1", ann="IAUC 8610")

# --- what the sources were --------------------------------------------------------------------------------------------------------------------------------------------------------------------------
SOURCES = {
    "usgs": ["IAU Working Group for Planetary System Nomenclature, Gazetteer of Planetary Nomenclature (USGS), Planet and Satellite Names, Discoverers, and Themes", "https://planetarynames.wr.usgs.gov/Page/Planets", "2026-11-18"],
    "jpl-sbdb": ["JPL Small-Body Database API, discovery record (what the Minor Planet Center published)", "https://ssd-api.jpl.nasa.gov/sbdb.api", "2026-11-18"],
    "jpl-ssd-moons": ["JPL Planetary Satellite Discovery Circumstances", "https://ssd.jpl.nasa.gov/sats/discovery.html", "2026-11-11"],
    "wikidata": ["Wikidata (CC0)", "https://www.wikidata.org/", "2026-11-18"],
    "derived": ["worked out here from the place and the date of the record (the instrument of the day); not a published field", "", "2026-11-18"],
}
ORDER = ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "ceres", "orcus", "haumea", "quaoar", "makemake", "gonggong", "eris", "sedna",
         "moon", "phobos", "deimos", "io", "europa", "ganymede", "callisto", "mimas", "enceladus", "tethys", "dione", "rhea", "titan", "iapetus", "miranda", "ariel", "umbriel", "titania", "oberon",
         "proteus", "triton", "nereid", "charon", "nix", "hydra", "vanth", "hiiaka", "namaka", "dysnomia"]

def fact(v):
    return "null" if v is None else "{ value: %s, source: %s }" % (json.dumps(v[0], ensure_ascii=False), json.dumps(v[1]))

def out(r):
    notes = json.dumps(r["notes"], ensure_ascii=False)
    lines = ["  {", f'    id: "{r["id"]}",', f'    kind: "{r["kind"]}",', f'    ancient: {"true" if r["ancient"] else "false"},']
    for key in ("date", "place", "by", "method", "designation", "number", "announced", "namedBy", "nameOrigin"):
        lines.append(f"    {key}: {fact(r.get(key))},")
    lines += [f"    notes: {notes},", "  },"]
    return "\n".join(lines)

HEADER = """// Made by scripts/make-discovery-data.py: when, where, how and by whom each planet, dwarf planet and fully drawn moon was found, how it was first designated, numbered and named, with the source of every fact
// (the Gazetteer of Planetary Nomenclature, the JPL Small-Body Database, JPL's moon discovery page and Wikidata, read on 2026-11-11 and 2026-11-18); do not edit by hand.
import type { Discovery } from "../discovery.ts";
"""

def write(path):
    body = [HEADER, "export const SOURCES: Readonly<Record<string, readonly [name: string, address: string, read: string]>> = " + json.dumps(SOURCES, ensure_ascii=False, indent=2) + ";", "",
            "export const RECORDS: readonly Discovery[] = ["]
    body += [out(R[i]) for i in ORDER]
    body += ["];", ""]
    open(path, "w").write("\n".join(body))

if __name__ == "__main__":
    assert set(R) == set(ORDER), set(R) ^ set(ORDER)
    write(os.path.join(ROOT, "src", "data", "discovery.ts"))
    print("wrote", len(R), "records")
