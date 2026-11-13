#!/usr/bin/env python3
"""Write src/surface/objects-apollo-17.ts: where things stand at the Apollo 17 site, from published coordinates (see NOTICE.md).

    python3 -I scripts/make-apollo17-objects.py [--out src/surface/objects-apollo-17.ts]

It reads two small files out of the 1.7 GB zip of the PDS Cartography and Imaging Sciences Node (USGS Astrogeology) that holds the map of Haase et al., "Coordinates and Maps of the Apollo 17 Landing Site",
Earth and Space Science 6 (2019), doi 10.1029/2018EA000408, by HTTP byte ranges (about 25 KB are fetched, never the zip):
  DATA/APOLLO17_CONTROLPOINTS_2018.TAB   the objects' positions, body-fixed X, Y, Z in metres (the lunar module, the ALSEP central station, the flag, ...)
  EXTRAS/GIS/APOLLO17_TRAVERSE_2018.SHP  the rover's traverses as nine polylines, Transverse Mercator on a sphere of 1,737.4 km, central meridian 30.7 degrees
Positions are turned into metres east and north of the package's site point (20.1911 N, 30.7723 E), on the same tangent plane as the height tiles (scripts/make-moon-terrain.py), and rounded to 0.1 m.
The rover's place is the last point of the last traverse (where the digitised path ends, near the lunar module), its heading the way the path was going: both are this package's reading of the line, not a
published position of the vehicle, and the page says so.
"""
import argparse
import io
import math
import os
import struct
import urllib.request
import zipfile

ZIP = "https://asc-astropedia.s3.us-west-2.amazonaws.com/Moon/Apollo/Traverse/Apollo17/ancillary/Apollo17_PDS_fullPackage_Haase.zip"
SIZE = 1717607481
INSIDE = "Apollo17_PDS_Hasse/"
UA = "wakusei-planets-data-build/1.0"
R = 1737400.0
SITE_LAT, SITE_LON = 20.1911, 30.7723

# what is wanted from the control points: name in the file, id, kind, English and Japanese names
WANTED = [
    ("LM", "lm", "lander", "Lunar module Challenger, descent stage", "月着陸船チャレンジャー（降下段）"),
    ("US flag", "flag", "flag", "The flag", "旗"),
    ("ALSEP C/S", "alsep", "station", "ALSEP central station", "ALSEP 中央局"),
    ("SEP transmitter", "sep", "instrument", "Surface electrical properties transmitter", "表面電気特性の送信機"),
]


class Ranged(io.RawIOBase):
    """A file that is a URL: each read is a byte range, so a zip can be listed and opened without being downloaded."""

    def __init__(self):
        self.pos = 0
        self.fetched = 0

    def seekable(self):
        return True

    def readable(self):
        return True

    def tell(self):
        return self.pos

    def seek(self, offset, whence=0):
        self.pos = offset if whence == 0 else (self.pos + offset if whence == 1 else SIZE + offset)
        return self.pos

    def readinto(self, b):
        n = len(b)
        if n == 0 or self.pos >= SIZE:
            return 0
        end = min(SIZE - 1, self.pos + n - 1)
        last = None
        for attempt in range(5):
            try:
                request = urllib.request.Request(ZIP, headers={"User-Agent": UA, "Range": f"bytes={self.pos}-{end}"})
                data = urllib.request.urlopen(request, timeout=60).read()
                break
            except OSError as error:
                last = error
                import time

                time.sleep(2**attempt)
        else:
            raise SystemExit(f"could not read {ZIP}: {last}")
        b[: len(data)] = data
        self.pos += len(data)
        self.fetched += len(data)
        return len(data)


def enu(lat, lon):
    """Metres east and north of the site point on the height tiles' tangent plane (the inverse of plane_to_lonlat in make-moon-terrain.py)."""
    dlat = math.radians(lat - SITE_LAT)
    north = R * dlat
    east = R * math.cos(math.radians(SITE_LAT) + dlat / 2) * math.radians(lon - SITE_LON)
    return east, north


def from_xyz(x, y, z):
    r = math.sqrt(x * x + y * y + z * z)
    return math.degrees(math.asin(z / r)), math.degrees(math.atan2(y, x))


def from_utm(e, n, lon0=30.7):
    """The traverse's projection: Transverse Mercator on a sphere, false easting 500,000 m, central meridian 30.7."""
    x = (e - 500000.0) / R
    d = n / R
    lon = lon0 + math.degrees(math.atan2(math.sinh(x), math.cos(d)))
    lat = math.degrees(math.asin(math.sin(d) / math.cosh(x)))
    return lat, lon


def polylines(shp):
    out = []
    off = 100
    while off < len(shp):
        _, length = struct.unpack(">2i", shp[off : off + 8])
        off += 8
        parts, points = struct.unpack("<2i", shp[off + 36 : off + 44])
        p = off + 44 + 4 * parts
        out.append([struct.unpack("<2d", shp[p + 16 * i : p + 16 * i + 16]) for i in range(points)])
        off += length * 2
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "surface", "objects-apollo-17.ts"))
    args = parser.parse_args()
    source = Ranged()
    z = zipfile.ZipFile(io.BufferedReader(source, 65536))
    table = z.read(INSIDE + "DATA/APOLLO17_CONTROLPOINTS_2018.TAB").decode("latin1")
    lines = polylines(z.read(INSIDE + "EXTRAS/GIS/APOLLO17_TRAVERSE_2018.SHP"))
    points = {}
    for line in table.splitlines():
        if not line.strip():
            continue
        _, x, y, zc, name = line.split(",", 4)
        points[name.strip().strip('"').strip()] = (float(x), float(y), float(zc))

    objects = []
    for name, ident, kind, en, ja in WANTED:
        lat, lon = from_xyz(*points[name])
        east, north = enu(lat, lon)
        objects.append({"id": ident, "kind": kind, "en": en, "ja": ja, "east": round(east, 1), "north": round(north, 1), "lat": round(lat, 5), "lon": round(lon, 5)})
    legs = []
    for line in lines:
        flat = []
        for e, n in line:
            east, north = enu(*from_utm(e, n))
            flat += [round(east, 1), round(north, 1)]
        legs.append(flat)
    # the rover: where the last traverse ends, pointing the way the line was going
    last = legs[-1]
    x1, y1 = last[-2], last[-1]
    # the point of the path at least 10 m before its end: a heading from the line's last few vertices alone would follow the digitising's noise
    back = len(last) // 2 - 2
    while back > 0 and math.hypot(last[2 * back] - x1, last[2 * back + 1] - y1) < 10:
        back -= 1
    x0, y0 = last[2 * back], last[2 * back + 1]
    heading = round(math.degrees(math.atan2(x1 - x0, y1 - y0)) % 360, 0)
    objects.append({"id": "rover", "kind": "rover", "en": "Lunar rover, where its last traverse ends", "ja": "月面車（最後の走行の終点）", "east": x1, "north": y1, "heading": heading})

    def num(v):
        return f"{v:g}" if isinstance(v, float) else str(v)

    text = io.StringIO()
    text.write("// Generated by scripts/make-apollo17-objects.py from published coordinates; do not edit by hand. Where things stand at the Apollo 17 site, metres east and north of the site point, and the rover's traverses.\n")
    text.write("// Sources (NOTICE.md): the control points and the traverse of Haase, Wählisch, Gläser, Oberst and Robinson, \"Coordinates and Maps of the Apollo 17 Landing Site\", Earth and Space Science 6 (2019),\n")
    text.write("// doi 10.1029/2018EA000408, in the PDS Cartography and Imaging Sciences Node's archive of that map (USGS Astrogeology). The rover's place and heading are the end of the digitised line, read by this package.\n")
    text.write('import type { SiteObject } from "./objects.ts";\n\n')
    text.write("export const APOLLO_17_OBJECTS: readonly SiteObject[] = [\n")
    for o in objects:
        parts = [f'id: "{o["id"]}"', f'kind: "{o["kind"]}"', f'name: {{ en: "{o["en"]}", ja: "{o["ja"]}" }}', f'east: {num(o["east"])}', f'north: {num(o["north"])}']
        if "heading" in o:
            parts.append(f'heading: {num(o["heading"])}')
        if "lat" in o:
            parts.append(f'lat: {num(o["lat"])}')
            parts.append(f'lon: {num(o["lon"])}')
        text.write("  { " + ", ".join(parts) + " },\n")
    text.write("];\n\n")
    text.write("/** The rover's nine traverses, each as east, north, east, north, ... in metres from the site point. */\n")
    text.write("export const APOLLO_17_TRAVERSE: readonly (readonly number[])[] = [\n")
    for leg in legs:
        text.write("  [" + ",".join(num(v) for v in leg) + "],\n")
    text.write("];\n")
    with open(args.out, "w", encoding="utf8") as f:
        f.write(text.getvalue())
    print(f"{len(objects)} objects, {len(legs)} traverses, {sum(len(l) // 2 for l in legs)} points; {source.fetched / 1000:.0f} KB fetched; wrote {os.path.normpath(args.out)}")


if __name__ == "__main__":
    main()
