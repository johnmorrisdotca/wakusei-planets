#!/usr/bin/env python3
"""Writes scripts/moon-catalogue-magnitudes.json: the absolute magnitude of each irregular moon of /moon-catalogue that has no size, read from English Wikipedia's four tables of the moons of Jupiter, Saturn, Uranus and Neptune.

Why Wikipedia (MODULES-1090): the Minor Planet Center's discovery circulars, the first choice, are closed to automated reading (its robots.txt disallows /iau/mpec/K00/ to /K25/ and /iau/iauc/, 2026-11-18). The tables say, in a note on their
column, that "absolute magnitudes of irregular satellites were taken from the Minor Planet Center's Natural Satellites Ephemeris Service". Only that one number per moon is taken: a single measured value is a fact. The diameters in the
tables are not kept anywhere; they are read here only to check our own size against, and the moons where ours differs by more than a factor of 2 are printed. The regular and inner moons are left out: their magnitudes in the tables are
worked out from their diameters, which would be going in a circle.

English Wikipedia text is CC BY-SA 4.0; the page names, the day they were read and the licence are in the file and in NOTICE.md. Fetching is polite: one request for each of the four pages, kept in the folder given with --cache (outside the
repository), never repeated while the file is there.

Usage: python3 -I scripts/make-moon-magnitudes.py --cache DIR      (needs the network the first time; DIR is outside the repository; writes scripts/moon-catalogue-magnitudes.json and prints the cross-check)"""
import json, math, os, re, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = {"jupiter": "Moons_of_Jupiter", "saturn": "Moons_of_Saturn", "uranus": "Moons_of_Uranus", "neptune": "Moons_of_Neptune"}
READ = "2026-11-18"
UA = "wakusei-moon-magnitudes/1.0 (one request for each of four pages)"
ALBEDO = 0.04
REGULAR = {"regular", "inner", "none"}


def page(cache, name):
    path = os.path.join(cache, name + ".wikitext")
    if not os.path.exists(path):
        os.makedirs(cache, exist_ok=True)
        url = "https://en.wikipedia.org/w/index.php?" + urllib.parse.urlencode({"title": name, "action": "raw"})
        text = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=120).read().decode()
        open(path, "w").write(text)
        time.sleep(2)
    return open(path).read()


def number(cell):
    """The first plain number in a table cell (a sort key in a template is skipped); None for a dash or nothing."""
    cell = re.sub(r"\{\{(?:sort|dsv)\|[^}]*\}\}\|?", "", cell)
    cell = re.sub(r"\{\{val\|([^}|]+)[^}]*\}\}", r"\1", cell)
    m = re.search(r"-?\d+(?:\.\d+)?", cell.replace("−", "-").replace(",", ""))
    return float(m.group(0)) if m else None


def rows(text):
    """The table rows that carry a moon: its names (every [[link]] text and bare designation of the name cell), the magnitude and the diameter."""
    out = []
    for raw in re.split(r"\n\|-", text):
        body = raw.strip()
        if "black" not in body:
            continue
        cells = [c.strip() for c in re.split(r"\|\||\n\|", body) if c.strip() != ""]
        eye = next((i for i, c in enumerate(cells) if "black" in c), None)
        if eye is None or eye + 2 >= len(cells) or eye < 1:
            continue
        names = set()
        for cell in cells[: eye]:
            for link in re.findall(r"\[\[([^\]]+)\]\]", cell):
                names.add(link.split("|")[-1].strip())
            for des in re.findall(r"S/\d{4}\s[JSUN]\s\d+", cell):
                names.add(des)
        h, d = number(cells[eye + 1]), number(cells[eye + 2])
        if h is not None and names:
            out.append((names, h, d))
    return out


def catalogue():
    """The rows of src/data/moon-catalogue.ts that have no radius: id, name, designation, host, group."""
    moons = []
    for line in open(os.path.join(ROOT, "src", "data", "moon-catalogue.ts")):
        line = line.strip()
        if not line.startswith('["'):
            continue
        row = json.loads(line.rstrip(","))
        moons.append({"id": row[0], "name": row[1], "designation": row[2], "host": row[4], "radius": row[10], "magnitude": row[14], "group": row[18]})
    return moons


def main():
    args = sys.argv[1:]
    if "--cache" not in args:
        raise SystemExit("usage: make-moon-magnitudes.py --cache DIR")
    cache = os.path.expanduser(args[args.index("--cache") + 1])
    tables = {host: rows(page(cache, name)) for host, name in PAGES.items()}
    found, missing, differ = {}, [], []
    for m in catalogue():
        if m["radius"] is not None or m["magnitude"] is not None or m["group"] in REGULAR or m["host"] not in tables:
            continue
        hit = next(((h, d) for names, h, d in tables[m["host"]] if (m["name"] in names) or (m["designation"] in names)), None)
        if hit is None:
            missing.append(m["id"])
            continue
        found[m["id"]] = {"h": hit[0], "page": PAGES[m["host"]].replace("_", " ")}
        ours = 10 ** (3.1236 - 0.5 * math.log10(ALBEDO) - 0.2 * hit[0])
        if hit[1] is not None and (ours / hit[1] > 2 or hit[1] / ours > 2):
            differ.append((m["id"], hit[0], round(ours, 1), hit[1]))
    doc = {"read": READ, "licence": "CC BY-SA 4.0", "albedo": ALBEDO,
           "pages": {h: f"https://en.wikipedia.org/wiki/{p}" for h, p in PAGES.items()},
           "note": "Absolute magnitudes of irregular satellites, which the tables take from the Minor Planet Center's Natural Satellites Ephemeris Service. One number a moon; the diameters of the tables are not kept.",
           "moons": dict(sorted(found.items()))}
    open(os.path.join(ROOT, "scripts", "moon-catalogue-magnitudes.json"), "w").write(json.dumps(doc, ensure_ascii=False, indent=1) + "\n")
    print(f"{len(found)} magnitudes; {len(missing)} irregular moons without a row: {missing}")
    print(f"{len(differ)} where our diameter (albedo {ALBEDO}) differs from the table's by more than a factor of 2 (id, H, ours km, table km): {differ}")


if __name__ == "__main__":
    main()
