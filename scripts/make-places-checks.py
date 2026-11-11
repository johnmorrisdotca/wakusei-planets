#!/usr/bin/env python3
"""Writes test/data/places-second-source.json: positions of a dozen places taken from sources other than the ones src/data/places-*.ts uses for them, for the test that holds the table to them.

  - NASA NSSDCA's Apollo 11 and Apollo 17 lunar module pages and Viking 1 lander page (nssdca-<id>.html in --second: https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1969-059C, 1972-096C, 1975-075C),
  - the IAU Gazetteer of Planetary Nomenclature (USGS) named landing sites "Statio ..." on the Moon, from the nightly centre-point file MOON_nomenclature_center_pts.zip in --cache,
  - NASA GISS's "Mars24 Sunclock: Mars Lander Missions" page (https://www.giss.nasa.gov/tools/mars24/help/landers.html, giss-mars24-landers.html in --cache), which gives the Mars landing sites to 0.01 degree in east longitude 0 to 360,
  - GCAT's lander catalogue (landercat.tsv in --cache) for Luna 2, Luna 9 and SLIM, which NASA's table (the table's source for them) is checked against.
Each row: the place's id in the table, the figure as the source prints it, the position as east longitude -180 to 180, and the source's address.

Usage: python3 -I scripts/make-places-checks.py --cache DIR --second DIR"""
import html, importlib.util, json, os, re, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("places_data", os.path.join(ROOT, "scripts", "make-places-data.py"))
places_data = importlib.util.module_from_spec(spec)
spec.loader.exec_module(places_data)


def text_of(path):
    t = open(path, encoding="utf-8", errors="replace").read()
    t = re.sub(r"<script.*?</script>|<style.*?</style>", "", t, flags=re.S)
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", t)))


def main():
    args = sys.argv[1:]
    cache = args[args.index("--cache") + 1]
    second = args[args.index("--second") + 1]
    rows = []
    nss = "https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id="
    t = text_of(os.path.join(second, "nssdca-1969-059C.html"))
    m = re.search(r"at ([\d.]+) degrees N latitude, ([\d.]+) degrees E longitude", t)
    rows.append({"id": "moon/apollo-11-lunar-module", "source": "NASA NSSDCA, Apollo 11 Lunar Module", "url": nss + "1969-059C", "figure": m.group(0), "lat": float(m.group(1)), "lon": float(m.group(2))})
    t = text_of(os.path.join(second, "nssdca-1972-096C.html"))
    m = re.search(r"at ([\d.]+) N latitude, ([\d.]+) E longitude \(as determined", t)
    rows.append({"id": "moon/apollo-17-lunar-module", "source": "NASA NSSDCA, Apollo 17 Lunar Module", "url": nss + "1972-096C", "figure": m.group(0), "lat": float(m.group(1)), "lon": float(m.group(2))})
    t = text_of(os.path.join(second, "nssdca-1975-075C.html"))
    m = re.search(r"at ([\d.]+) deg N latitude and ([\d.]+) deg E longitude \(planetocentric\)", t)
    rows.append({"id": "mars/viking-1", "source": "NASA NSSDCA, Viking 1 Lander", "url": nss + "1975-075C", "figure": m.group(0), "lat": float(m.group(1)), "lon": places_data.east180(m.group(2))})
    # the Gazetteer's named landing sites on the Moon
    feats, stamp, _ = places_data.features_of("moon", cache)
    by_name = {f["name"]["en"]: f for f in feats}
    for pid, name in [("moon/apollo-11-lunar-module", "Statio Tranquillitatis"), ("moon/chang-e-3", "Guang Han Gong"), ("moon/chang-e-4", "Statio Tianhe"), ("moon/chang-e-5-lander", "Statio Tianchuan"),
                      ("moon/chang-e-6-lander", "Statio Tianjiang"), ("moon/chandrayaan-3-vikram", "Statio Shiv Shakti")]:
        f = by_name[name]
        rows.append({"id": pid, "source": f"IAU Gazetteer of Planetary Nomenclature (USGS), {name}", "url": "https://planetarynames.wr.usgs.gov/shapefiles/MOON_nomenclature_center_pts.zip", "figure": f"{f['lat']}, {f['lon']} (file of {stamp})", "lat": f["lat"], "lon": f["lon"]})
    # GCAT for three
    gcat = {}
    for line in open(os.path.join(cache, "landercat.tsv"), encoding="utf-8"):
        p = [x.strip() for x in line.split("\t")]
        if len(p) > 9 and p[5] == "Luna" and p[2] in ("AMS E-1A No. 7 (Luna-2)", "ALS Luna-9", "SLIM"):
            gcat[p[2]] = p
    for pid, name in [("moon/luna-2", "AMS E-1A No. 7 (Luna-2)"), ("moon/luna-9", "ALS Luna-9"), ("moon/slim", "SLIM")]:
        p = gcat[name]
        rows.append({"id": pid, "source": f"GCAT lander catalogue, {name}", "url": "https://planet4589.org/space/gcat/tsv/cat/landercat.tsv", "figure": f"lon {p[6]}, lat {p[7]}", "lat": float(p[7]), "lon": places_data.east180(p[6])})
    # NASA GISS Mars24 landers page
    t = text_of(os.path.join(cache, "giss-mars24-landers.html"))
    for pid, abbr in [("mars/curiosity", "MSL"), ("mars/perseverance", "M20"), ("mars/viking-1", "VL1"), ("mars/viking-2", "VL2"), ("mars/mars-pathfinder", "MPF"), ("mars/spirit", "MERA"), ("mars/opportunity", "MERB"),
                      ("mars/phoenix", "PHX"), ("mars/insight", "NSYT"), ("mars/zhurong", "ZR")]:
        i = t.find(abbr + " = ")
        m = re.search(r"at ([\d.]+)°E (-?[\d.]+)°?([NS])?|at ([\d.]+)°E ([\d.]+)°([NS])", t[i:i + 900])
        lon_text = m.group(1) or m.group(4)
        lat_text = m.group(2) if m.group(1) else m.group(5)
        hemi = m.group(3) if m.group(1) else m.group(6)
        lat = float(lat_text) * (-1 if hemi == "S" else 1)
        rows.append({"id": pid, "source": "NASA GISS Mars24 Sunclock, Mars Lander Missions (list of 2023-12-09)", "url": "https://www.giss.nasa.gov/tools/mars24/help/landers.html", "figure": m.group(0), "lat": lat, "lon": places_data.east180(lon_text)})
    for r in rows:
        r["lat"], r["lon"] = round(r["lat"], 5), round(r["lon"], 5)
    out = {"read": "2026-11-11", "note": "Positions of places from sources other than the ones the table uses for them. Latitude north, longitude east, -180 to 180. Mars24's latitudes are planetographic or planetocentric as each mission's own team gave them; they can differ from the table's by up to half a degree.", "rows": rows}
    path = os.path.join(ROOT, "test", "data", "places-second-source.json")
    json.dump(out, open(path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"wrote {len(rows)} rows to {path}", file=sys.stderr)


if __name__ == "__main__":
    main()
