#!/usr/bin/env python3
"""Cut the big public-domain maps of the bodies into a tile pyramid of 512 px WebP tiles (see NOTICE.md and docs/guides/close-zoom.md).

    python3 -I scripts/make-body-tiles.py build [--cache DIR] [--out DIR] [--bodies mars,moon]
    python3 -I scripts/make-body-tiles.py sharp [--bodies moon,mars]
    python3 -I scripts/make-body-tiles.py selftest

Needs Python 3, Pillow and numpy (python3 -m venv .cache/venv && .cache/venv/bin/pip install pillow numpy, then run the venv's python with -I).
`build` downloads each source once into the cache dir (default .cache/body-tiles, git-ignored; every file is checked against the SHA-256 below), and writes
OUT/<body>/<level>/<column>/<row>.webp and OUT/manifest.json (default OUT: .cache/body-tiles-out). The tiles are never committed and never in the npm package:
the Pages workflow builds them and serves them beside the demo, where `tiles/` is the address the elements look at.

Every map is 2:1 equirectangular (longitude -180 to 180 across, 0 in the middle and east to the right, latitude 90 down to -90), the same as textures/<body>-2048.webp.
Level L is 2048 * 2^L pixels wide, in 2^(L+2) columns and 2^(L+1) rows of 512 px tiles, so level 1 is 4096 across (8 x 4 tiles) and level 3 is 16384 (32 x 16 tiles). Level 0 is
the package's own 2048 picture and is not cut. Level 4 (32768 across) for the Moon and Mars is the `sharp` command. It does not download its sources unless `WAKUSEI_SHARP_TILES=1`. A body's top level is the largest one its source can fill without enlarging it.

The picture of a tile is the package's own 2048 picture, enlarged, with the source's fine detail added to it: the source is put on the same sphere the same way the 2048 picture
was (the same roll, strip projection and desaturation), and what it has beyond the 2048 picture is added to the enlarged picture, where the source really holds data (not the black
of a pole nobody imaged, nor the poles a strip does not reach). So colour, grade and filled poles are the package's picture's own at every level, and only sharpness is new.
Each level is made from the whole source in one go, never tile by tile, so neighbouring tiles agree along their shared edge and longitude 180 has no seam.
"""
import argparse
import contextlib
import hashlib
import io
import json
import math
import os
import shutil
import ssl
import sys
import urllib.request

import numpy as np
from PIL import Image, ImageFilter

Image.MAX_IMAGE_PIXELS = 600_000_000
TILE = 512
BASE = 2048
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
UA = {"User-Agent": "wakusei-planets-build/0.1 (https://github.com/johnmorrisdotca/wakusei-planets)"}
COMMONS = "https://upload.wikimedia.org/wikipedia/commons"
MAGELLAN = "https://pds-geosciences.wustl.edu/mgn/urn-nasa-pds-magellan_midr/data/cmidr"
# The first-cycle, left-looking C3 MIDR products. Each row gives its archive name, central meridian,
# hemisphere and raster hash. The projections and offsets are from the corresponding PDS4 labels.
VENUS_MIDRS = (
    ("c3midr_14n060_1", 60, 1, "48dadcc6a4b5fa6749cf463aa91690310e535002593863d5e38d9648024f738a"),
    ("c3midr_14n180_1", 180, 1, "5c031a6a9be7a603635351322002b3ddc761420e258c5357cfae7757513055db"),
    ("c3midr_14n300_1", 300, 1, "2b6efbcb4cf97f944a0a80b2cf9268dbe7b4d8303d33ce35dbe045ffd14d88e1"),
    ("c3midr_14s060_1", 60, -1, "3accd91dfe64e2ec23aa60d8dc58e687f687e888b8e45b5d0c4977e53351f7bc"),
    ("c3midr_14s180_1", 180, -1, "d6ba5c50f0c439134fcd4dde5f5e879785c5423ecc9bc71263a5e40a2c1d7d9e"),
    ("c3midr_14s300_1", 300, -1, "dad645c5c0a217f6e613a02623fb2f48ef6138e5e678d75aefe2b1c761a6b72d"),
)


def tls_context():
    """The TLS context every download uses: it always verifies the server's certificate and its name. The certificates it trusts are certifi's bundle (Mozilla's list, current as of the package's release) when certifi is installed, which the
    build's venv has, else the system's. A runner whose system store is older than a root a site has moved to (svs.gsfc.nasa.gov chains to Let's Encrypt's new root YR) therefore still verifies; nothing is ever downloaded unverified."""
    try:
        import certifi
    except ImportError:
        return ssl.create_default_context()
    return ssl.create_default_context(cafile=certifi.where())

# Each source: where it is, its SHA-256 (a file with another hash is never used), how it lies on the sphere (the same steps scripts/make-textures.py takes for the 2048 picture) and the
# WebP quality of its tiles. `roll` is a turn east, in fractions of the width; `strip` is ("lat", degrees) for a strip of an equirectangular map or ("merc", degrees) for a Mercator
# strip, `crop` the box of the source that is the map, `keep` the colour kept by `desaturate`, `grey` takes the source's detail as brightness only, `night` marks black that was never imaged,
# `mask` limits detail to the white parts of an aligned footprint map, and `fade` is the number of 8-pixel cells over which the detail fades at the edge of its data (4 by default).
SOURCES = {
    "mercury": {
        "url": f"{COMMONS}/4/41/Mercury_MESSENGER_MDIS_Basemap_EnhancedColor_Mosaic_Global_32ppd.jpg",
        "sha256": "e9d394bfd4ab472aa1463878b389e7f84cb898ac072211d68cc5f457fe2f4fa0",
        "file": "Mercury MESSENGER MDIS Basemap EnhancedColor Mosaic Global 32ppd.jpg",
        "credit": "NASA / Johns Hopkins University Applied Physics Laboratory / Carnegie Institution of Washington (MESSENGER MDIS global basemap, enhanced colour, 32 pixels a degree)",
        "grey": True, "night": True, "quality": 74,
    },
    "venus": {
        "url": "https://pds-geosciences.wustl.edu/missions/magellan/midr_pds4/index.htm",
        "file": "Magellan C3 MIDR, cycle 1 left look (six PDS4 scenes)",
        "sha256": hashlib.sha256("\n".join(row[3] for row in VENUS_MIDRS).encode()).hexdigest(),
        "credit": "NASA / JPL Magellan radar, NASA Planetary Data System Geosciences Node",
        "grey": True, "night": True, "quality": 74,
    },
    "mars": {
        "url": f"{COMMONS}/1/1f/Mars_Viking_MDIM21_ClrMosaic_1km.jpg",
        "sha256": "fdfcd335559c3dc67052b7e8a9565d850e336ac0d1f3ea7f5eb7826ffb44ecb2",
        "file": "Mars Viking MDIM21 ClrMosaic 1km.jpg",
        "credit": "NASA / Jet Propulsion Laboratory / U.S. Geological Survey (Viking Mars Digital Image Mosaic 2.1, colour, 1 km a pixel)",
        "night": True, "quality": 78,
    },
    "moon": {
        "url": "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_16k.tif",
        "sha256": "dbff4356479764d89f9fd7722140043eddbc2cafbad4dec5950858e2df77ac54",
        "file": "lroc_color_poles_16k.tif",
        "credit": "NASA's Scientific Visualization Studio (Ernie Wright, Noah Petro), CGI Moon Kit: Lunar Reconnaissance Orbiter Camera colour map with the poles filled, 16384 pixels across",
        "quality": 78,
    },
    "earth": {
        "url": "https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/september/world.topo.bathy.200409.3x21600x10800.jpg",
        "sha256": "863036b622ba3dab4eb4ffb7149730b02cfa433ce49672e9b7267022051e04a2",
        "file": "world.topo.bathy.200409.3x21600x10800.jpg",
        "credit": "NASA Earth Observatory (Reto Stockli): Blue Marble Next Generation with topography and bathymetry, September 2004, 21600 pixels across",
        "quality": 80,
    },
    "pluto": {
        "url": f"{COMMONS}/a/ad/Pluto_color_mapmosaic.jpg",
        "sha256": "d63da5ee9eab8d0b98ebef3c0cdc3a92676d7c9b247b2383294fb5da5c67a71a",
        "file": "Pluto color mapmosaic.jpg",
        "credit": "NASA / Johns Hopkins University Applied Physics Laboratory / Southwest Research Institute (New Horizons global colour mosaic)",
        "roll": 0.5, "night": True, "fade": 14, "quality": 78,
    },
    "charon": {
        "url": f"{COMMONS}/3/39/Charon_map_iau1803c.jpg",
        "sha256": "a8c2ff578b810f3ec84a42751d3a00920fa4c610f5125e938e294aa4e0804405",
        "file": "Charon map iau1803c.jpg",
        "credit": "NASA / Johns Hopkins University Applied Physics Laboratory / Southwest Research Institute (New Horizons, IAU image iau1803c)",
        "night": True, "quality": 78,
    },
    "io": {
        "url": f"{COMMONS}/e/e4/Io_from_Galileo_and_Voyager_missions.jpg",
        "sha256": "e5523d1ea98d2ad03ca4dcb7c73aebb1a869b4fba6c941f7f77f0fba17c64dae",
        "file": "Io from Galileo and Voyager missions.jpg",
        "credit": "NASA / JPL (Galileo SSI and Voyager images)",
        "strip": ("lat", 57.3, 3), "roll": 0.5, "quality": 78,
    },
    "europa": {
        "url": "https://planetarymaps.usgs.gov/mosaic/Europa_Voyager_GalileoSSI_global_mosaic_500m.tif",
        "sha256": "a323f0c9ccb47d5af9902ea8297fe81f9a9708795645b80801f103c3f7c9a624",
        "file": "Europa_Voyager_GalileoSSI_global_mosaic_500m.tif",
        "credit": "NASA / JPL / U.S. Geological Survey Astrogeology (Voyager and Galileo SSI global mosaic, 500 m a pixel)",
        "roll": 0.5, "grey": True, "night": True, "mask": "europa.png", "quality": 74,
    },
    "ganymede": {
        "url": "https://planetarymaps.usgs.gov/mosaic/Ganymede_Voyager_GalileoSSI_global_mosaic_1km.tif",
        "sha256": "c2c8d9506b8cf8f7a0a90d823d9052e91c8d9885cf7267fdce8de8216f4df888",
        "file": "Ganymede_Voyager_GalileoSSI_global_mosaic_1km.tif",
        "credit": "NASA / JPL / U.S. Geological Survey Astrogeology (Voyager and Galileo SSI global mosaic, 1 km a pixel)",
        "roll": 0.5, "grey": True, "night": True, "mask": "ganymede.png", "quality": 74,
    },
    "callisto": {
        "url": f"{COMMONS}/a/a3/Callisto_equatorial.jpg",
        "sha256": "f262cd1f307a9d7adf05c39499ad6bcc636c45af102b5ab243df6585834b4f80",
        "file": "Callisto equatorial.jpg",
        "credit": "USGS (Callisto equatorial region map, I-2770, from Voyager and Galileo images)",
        "strip": ("merc", 57.0, 0), "quality": 74,
    },
    "rhea": {
        "url": f"{COMMONS}/2/21/Rhea_Color_Map.jpg",
        "sha256": "4a3f4c5cca6ec558a6dcd664ee818dd700df527fc07fe623d1c56d4e2ae81bc4",
        "file": "Rhea Color Map.jpg",
        "credit": "NASA / JPL-Caltech / Space Science Institute / Lunar and Planetary Institute (Cassini, PIA18438)",
        "roll": 0.5, "keep": 0.55, "quality": 68,
    },
    "enceladus": {
        "url": f"{COMMONS}/a/aa/Enceladus_Color_Map.jpg",
        "sha256": "5b60d0161efd659f6d95281559ad4b30826fd02ee72944dbb3f8b7679f65ed4d",
        "file": "Enceladus Color Map.jpg",
        "credit": "NASA / JPL-Caltech / Space Science Institute / Lunar and Planetary Institute (Cassini, PIA18435)",
        "roll": 0.5, "keep": 0.3, "quality": 68,
    },
    "tethys": {
        "url": f"{COMMONS}/4/40/Tethys_Color_Map.jpg",
        "sha256": "aa3c249de2432699157638dae11c6f5c5e22c3dda94dd803af8666269f1a3da4",
        "file": "Tethys Color Map.jpg",
        "credit": "NASA / JPL-Caltech / Space Science Institute / Lunar and Planetary Institute (Cassini, PIA18439)",
        "roll": 0.5, "keep": 0.55, "quality": 70,
    },
    "dione": {
        "url": f"{COMMONS}/1/18/Dione_Color_Map.jpg",
        "sha256": "5e885d0e3bac1e1ee36934063d5c9cdf609dc10ad44677cba31bc9e703b674ff",
        "file": "Dione Color Map.jpg",
        "credit": "NASA / JPL-Caltech / Space Science Institute / Lunar and Planetary Institute (Cassini, PIA18434)",
        "roll": 0.5, "keep": 0.55, "quality": 70,
    },
    "iapetus": {
        "url": f"{COMMONS}/5/53/Iapetus_Color_Map.jpg",
        "sha256": "6e0e1d17a50343d9176912d047392c4f7cd67c48bdb30789918a4ff24d9f683b",
        "file": "Iapetus Color Map.jpg",
        "credit": "NASA / JPL-Caltech / Space Science Institute / Lunar and Planetary Institute (Cassini, PIA18436)",
        "roll": 0.5, "keep": 0.7, "quality": 72,
    },
    "triton": {
        "url": f"{COMMONS}/6/61/Triton_map_no_grid.jpg",
        "sha256": "ff533af3163f53cc5560cd983cfe0f06b1c2cd0f3db36518d4c5cc5f5ddfeabb",
        "file": "Triton map no grid.jpg",
        "credit": "Paul Schenk, Lunar and Planetary Institute (Voyager 2 mosaic), NASA",
        "keep": 0.45, "night": True, "quality": 74,
    },
    "mimas": {
        "url": f"{COMMONS}/5/5a/Map_of_Mimas_2010-02_PIA12780.jpg",
        "sha256": "8dd786afff003466f196bdd5c9f4c63a6bffddbd0d384c04fac0706068602943",
        "file": "Map of Mimas 2010-02 PIA12780.jpg",
        "credit": "NASA / JPL / Space Science Institute (Cassini, PIA12780)",
        # the box the 2048 picture was cut from, in the 3840 pixel wide copy the script of the pictures used (x0, y0, x1, y1), and that copy's width
        "crop": (226, 183, 3718, 1926, 3840), "quality": 74,
    },
}
# The pole rows a strip does not reach and the margin kept off every edge of real data, in degrees.
EDGE_MARGIN = 2.0


def sha256_of(path):
    digest = hashlib.sha256()
    with open(path, "rb") as file:
        for block in iter(lambda: file.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def fetch(name, cache, source=None):
    """The source's path in the cache, downloaded when missing; a file whose hash differs is never used."""
    if source is None:
        source = SOURCES[name]
    path = os.path.join(cache, name + os.path.splitext(source["url"])[1])
    if not os.path.exists(path):
        os.makedirs(cache, exist_ok=True)
        with urllib.request.urlopen(urllib.request.Request(source["url"], headers=UA), timeout=900, context=tls_context()) as response, open(path, "wb") as file:
            shutil.copyfileobj(response, file)
    digest = sha256_of(path)
    if digest != source["sha256"]:
        raise SystemExit(f"{path}: sha256 {digest} is not the expected {source['sha256']} (delete it to download again, or update SOURCES)")
    return path


def top_level(source_width, base=BASE):
    level = 0
    while base * 2 ** (level + 1) <= source_width:
        level += 1
    return level


def resize_f(array, width, height, resample=Image.LANCZOS):
    """Resize a float picture (height, width) or (height, width, channels), one channel at a time."""
    array = np.ascontiguousarray(array, dtype=np.float32) if array.ndim == 2 else array.astype(np.float32, copy=False)
    if array.ndim == 2:
        return np.asarray(Image.fromarray(array, "F").resize((width, height), resample), dtype=np.float32)
    return np.stack([resize_f(array[..., c], width, height, resample) for c in range(array.shape[2])], axis=2)


def resize_wrapped(array, width, height, resample=Image.LANCZOS):
    """Resize with the far edge of the picture standing beyond each side, so the antimeridian joins."""
    pad = math.ceil(3 * max(1.0, array.shape[1] / width)) + 2
    wide = np.concatenate([array[:, -pad:], array, array[:, :pad]], axis=1)
    scale = width / array.shape[1]
    out = resize_f(wide, round(wide.shape[1] * scale), height, resample)
    left = round(pad * scale)
    return out[:, left : left + width]


def desaturate(img, keep):
    grey = img.mean(axis=2, keepdims=True)
    return np.clip(grey + (img - grey) * keep, 0, 1)


def luminance(img):
    return img.mean(axis=2)


def load_source(path, source):
    image = Image.open(path).convert("RGB")
    if "crop" in source:
        x0, y0, x1, y1, ref = source["crop"]
        k = image.width / ref
        image = image.crop((round(x0 * k), round(y0 * k), round(x1 * k), round(y1 * k)))
    return image


def venus_mosaic(cache):
    """Reproject the six Magellan scenes to the tile grid, leaving 0 where the cycle has no radar returns."""
    files = []
    scenes = []
    for name, central_meridian, hemisphere, digest in VENUS_MIDRS:
        product = {"file": f"{name}.img", "url": f"{MAGELLAN}/{name}.img", "sha256": digest}
        data = np.memmap(fetch(name, cache, product), dtype=np.uint8, mode="r", shape=(7168, 8192))
        # Planetocentric, positive east. The north and south labels differ in their Y offset.
        corner_y = 8714588.0 if hemisphere > 0 else 5800612.5
        scenes.append((data, central_meridian, 14 * hemisphere, corner_y))
        files.append(product)

    radius, scale, corner_x = 6051000, 2025, -8295412.5
    width = BASE * 2 ** top_level(math.tau * radius / scale)
    height = width // 2
    longitude = (np.arange(width, dtype=np.float32) + 0.5) * (360 / width) - 180
    latitude = 90 - (np.arange(height, dtype=np.float32) + 0.5) * (180 / height)
    picture = np.zeros((height, width), dtype=np.uint8)
    for row in range(0, height, 96):
        lat = latitude[row : row + 96, None]
        radians = np.radians(lat)
        total = np.zeros((len(lat), width), dtype=np.float32)
        weights = np.zeros_like(total)
        for data, meridian, mid_lat, corner_y in scenes:
            delta = (longitude - meridian + 180) % 360 - 180
            x = (radius * np.radians(delta) * np.cos(radians) - corner_x) / scale
            y = (corner_y - radius * radians) / scale
            column = np.floor(x).astype(np.int32)
            line = np.floor(y).astype(np.int32)
            valid = (column >= 0) & (column < data.shape[1] - 1) & (line >= 0) & (line < data.shape[0] - 1)
            cx = column.clip(0, data.shape[1] - 2)
            cy = line.clip(0, data.shape[0] - 2)
            dx, dy = x - column, y - line
            tl, tr = data[cy, cx], data[cy, cx + 1]
            bl, br = data[cy + 1, cx], data[cy + 1, cx + 1]
            valid &= (tl > 0) & (tr > 0) & (bl > 0) & (br > 0)
            sample = (tl * (1 - dx) + tr * dx) * (1 - dy) + (bl * (1 - dx) + br * dx) * dy
            # The overlapping windows are from the same cycle. Prefer the centre of each scene.
            weight = np.exp(-(delta / 45) ** 2 - ((lat - mid_lat) / 40) ** 2) * valid
            total += sample * weight
            weights += weight
        picture[row : row + len(lat)] = np.rint(total / np.maximum(weights, 1e-12)).astype(np.uint8)
    return Image.fromarray(picture).convert("RGB"), files


def geometry(image, source, width):
    """The source as the equirectangular map `width` across the 2048 picture was made from, and where it holds real data (1) or not (0), both height `width / 2`."""
    height = width // 2
    strip = source.get("strip")
    lat = (90 - (np.arange(height) + 0.5) / height * 180)[:, None]
    if strip is not None and strip[0] == "lat":
        _, lat_max, trim = strip
        pic = image.crop((trim, 0, image.width - trim, image.height))
        rows = round(width * (2 * lat_max / 360))
        band = np.asarray(pic.resize((width, rows), Image.LANCZOS), dtype=np.float32) / 255.0
        out = np.zeros((height, width, 3), dtype=np.float32)
        pad = (height - rows) // 2
        out[pad : pad + rows] = band
        valid = (np.abs(lat) <= lat_max - EDGE_MARGIN) * np.ones((1, width), dtype=np.float32)
    elif strip is not None and strip[0] == "merc":
        lat_max = strip[1]
        scale = width / image.width
        resized = np.asarray(image.resize((width, max(2, round(image.height * scale))), Image.LANCZOS), dtype=np.float32) / 255.0
        rh = resized.shape[0]
        merc = lambda degrees: np.log(np.tan(np.pi / 4 + np.radians(degrees) / 2))
        ymax = merc(lat_max)
        inside = (np.abs(lat[:, 0]) <= lat_max)
        src = np.zeros(height)
        src[inside] = (ymax - merc(lat[inside, 0])) / (2 * ymax) * rh - 0.5
        src = np.clip(src, 0, rh - 1.001)
        y0 = np.floor(src).astype(int)
        f = (src - y0)[:, None, None]
        out = resized[y0] * (1 - f) + resized[y0 + 1] * f
        out[~inside] = 0
        valid = (np.abs(lat) <= lat_max - EDGE_MARGIN) * np.ones((1, width), dtype=np.float32)
    else:
        out = np.asarray(image.resize((width, height), Image.LANCZOS), dtype=np.float32) / 255.0
        valid = np.ones((height, width), dtype=np.float32)
    out = out.astype(np.float32, copy=False)
    if source.get("roll"):
        shift = int(round(source["roll"] * width))
        out, valid = np.roll(out, shift, axis=1), np.roll(valid, shift, axis=1)
    if "keep" in source:
        out = desaturate(out, source["keep"])
    if source.get("night"):
        # black that was never imaged (a pole in the polar night, a strip's missing rows): not data
        valid = valid * (luminance(out) > 0.04).astype(np.float32)
    if "mask" in source:
        # The footprint mask is aligned with the bundled map, after the source's turn.
        path = os.path.join(HERE, "body-tile-masks", source["mask"])
        with Image.open(path) as mask:
            valid *= np.asarray(mask.resize((width, height), Image.Resampling.NEAREST)) != 0
    return np.clip(out, 0, 1), valid.astype(np.float32)


def erode_feather(valid, cells):
    """`valid` (0 or 1) taken in by `cells` cells of 8 pixels, and softened over as many: where the detail of a source fades into the picture's own."""
    h, w = valid.shape
    small = valid.reshape(h // 8, 8, w // 8, 8).mean(axis=(1, 3))
    hard = (small > 0.97).astype(np.float32)
    for _ in range(cells):
        up, down = np.vstack([hard[:1], hard[:-1]]), np.vstack([hard[1:], hard[-1:]])
        left, right = np.roll(hard, 1, axis=1), np.roll(hard, -1, axis=1)
        hard = np.minimum.reduce([hard, up, down, left, right])
    soft = hard
    for _ in range(cells):
        up, down = np.vstack([soft[:1], soft[:-1]]), np.vstack([soft[1:], soft[-1:]])
        soft = (soft + up + down + np.roll(soft, 1, axis=1) + np.roll(soft, -1, axis=1)) / 5
    return resize_f(soft, w, h, Image.BILINEAR).clip(0, 1)


def register(base, seen, valid):
    """How well `seen` (the source on the sphere) lies on the package's picture: the correlation of their brightness at 512 across, for a turn of 0, a quarter, a half and three quarters."""
    size = 512
    a = luminance(np.asarray(Image.fromarray((base * 255).astype(np.uint8)).resize((size, size // 2), Image.BILINEAR), dtype=np.float32) / 255)
    b = luminance(resize_f(seen, size, size // 2, Image.BILINEAR))
    m = resize_f(valid, size, size // 2, Image.BILINEAR) > 0.99
    best = []
    for turn in (0, 0.25, 0.5, 0.75):
        r = np.roll(b, int(turn * size), axis=1)
        mm = np.roll(m, int(turn * size), axis=1)
        x, y = a[mm], r[mm]
        best.append((float(np.corrcoef(x, y)[0, 1]) if x.size > 100 else 0.0, turn))
    return best


def detail_level(name, source, base, image, width):
    """The level's picture: the package's 2048 picture enlarged to `width`, with the detail the source has beyond it. float32, (width / 2, width, 3), 0 to 1."""
    height = width // 2
    seen, valid = geometry(image, source, width)
    if source.get("grey"):
        # a map in false colour (MESSENGER's enhanced colour): only its brightness is detail
        lum = luminance(seen)
        seen = np.repeat(lum[..., None], 3, axis=2)
    weight = (valid > 0.5).astype(np.float32)
    # the source's own 2048 picture, where it has data (a normalised blur, so the edge of the data does not pull the picture dark)
    low_small = resize_wrapped(seen * weight[..., None], BASE, BASE // 2) / np.maximum(resize_wrapped(weight, BASE, BASE // 2), 1e-3)[..., None]
    low = resize_wrapped(low_small.astype(np.float32), width, height, Image.BICUBIC)
    up = resize_wrapped(base, width, height, Image.BICUBIC)
    # where the 2048 picture fades the detail of the map into a plain tone (Pluto's unseen south), the detail fades over as far here, or the tiles show crisp ground right up to the ragged edge of the map and a seam against the plain beyond it
    fade = erode_feather(valid, source.get("fade", 4))
    out = up + fade[..., None] * (seen - low)
    return np.clip(out, 0, 1).astype(np.float32)


def cut(picture, out, name, level, quality):
    """Write a level's tiles; the entry for the manifest."""
    height, width = picture.shape[:2]
    image = Image.fromarray((picture * 255 + 0.5).astype(np.uint8))
    columns, rows = width // TILE, height // TILE
    total = 0
    for column in range(columns):
        folder = os.path.join(out, name, str(level), str(column))
        os.makedirs(folder, exist_ok=True)
        for row in range(rows):
            path = os.path.join(folder, f"{row}.webp")
            image.crop((column * TILE, row * TILE, (column + 1) * TILE, (row + 1) * TILE)).save(path, "WEBP", quality=quality, method=5)
            total += os.path.getsize(path)
    return {"level": level, "width": width, "height": height, "columns": columns, "rows": rows, "tiles": columns * rows, "bytes": total}


def build_body(name, cache, out, textures):
    source = SOURCES[name]
    if name == "venus":
        image, files = venus_mosaic(cache)
    else:
        image = load_source(fetch(name, cache), source)
        files = None
    base = np.asarray(Image.open(os.path.join(textures, f"{name}-{BASE}.webp")).convert("RGB"), dtype=np.float32) / 255.0
    top = top_level(image.width)
    if top < 1:
        raise SystemExit(f"{name}: a source {image.width} pixels across cannot fill level 1 ({BASE * 2} across)")
    seen, valid = geometry(image, source, 1024)
    check = register(base, seen, valid)
    best = max(check)
    print(f"{name}: source {image.width} x {image.height}, top level {top}; correlation with the 2048 picture {best[0]:.3f} at a turn of {best[1]} (as built: {check[0][0]:.3f})", flush=True)
    if best[0] < 0.6 or best[1] != 0:
        raise SystemExit(f"{name}: the source does not lie on the 2048 picture (best correlation {best[0]:.3f} at a turn of {best[1]}): fix its roll or strip in SOURCES")
    levels = []
    for level in range(1, top + 1):
        width = BASE * 2**level
        picture = detail_level(name, source, base, image, width)
        entry = cut(picture, out, name, level, source["quality"])
        levels.append(entry)
        print(f"  level {level}: {width} x {width // 2}, {entry['tiles']} tiles, {entry['bytes'] / 1048576:.2f} MB", flush=True)
    provenance = {"file": source["file"], "url": source["url"], "sha256": source["sha256"], "credit": source["credit"], "width": image.width, "height": image.height}
    if files is not None:
        provenance["files"] = files
    return {"levels": levels, "tiles": sum(e["tiles"] for e in levels), "bytes": sum(e["bytes"] for e in levels), "source": provenance}


def write_manifest(out, bodies):
    manifest = {
        "version": 1,
        "tileSize": TILE,
        "base": BASE,
        "scheme": "equirectangular, longitude -180 to 180 across (0 in the middle, east to the right), latitude 90 down to -90; level L is 2048 * 2^L across, 2^(L+2) columns by 2^(L+1) rows; tile path <body>/<level>/<column>/<row>.webp, column 0 at -180, row 0 at 90; level 0 is textures/<body>-2048.webp and is not cut",
        "bodies": bodies,
    }
    with open(os.path.join(out, "manifest.json"), "w", encoding="utf8") as file:
        json.dump(manifest, file, indent=1)
        file.write("\n")


def park_sharp(out, name, previous):
    """Before a body's folder is replaced: take its level 4 (the sharp cut, made from a mosaic that is not downloaded again) aside, with its manifest entry. Returns what to give `restore_sharp`, or None when there is none."""
    if name not in SHARP or previous is None:
        return None
    level = SHARP[name]["level"]
    entry = next((one for one in previous.get("levels", []) if one.get("level") == level), None)
    folder = os.path.join(out, name, str(level))
    if entry is None or not os.path.isdir(folder):
        return None
    parked = os.path.join(out, f".sharp-{name}-{level}")
    shutil.rmtree(parked, ignore_errors=True)
    shutil.move(folder, parked)
    return {"parked": parked, "folder": folder, "entry": entry, "sharp": previous.get("sharp")}


def restore_sharp(kept, body):
    """Put a parked level 4 back, and its entry and credit in the body's manifest entry."""
    if kept is None:
        return body
    os.makedirs(os.path.dirname(kept["folder"]), exist_ok=True)
    shutil.move(kept["parked"], kept["folder"])
    levels = [one for one in body["levels"] if one.get("level") != kept["entry"]["level"]] + [kept["entry"]]
    levels.sort(key=lambda one: one["level"])
    body = {**body, "levels": levels, "tiles": sum(one["tiles"] for one in levels), "bytes": sum(one["bytes"] for one in levels)}
    if kept["sharp"] is not None:
        body["sharp"] = kept["sharp"]
    return body


def build(cache, out, names):
    textures = os.path.join(ROOT, "textures")
    os.makedirs(out, exist_ok=True)
    manifest_path = os.path.join(out, "manifest.json")
    previous = {}
    if os.path.exists(manifest_path):
        previous = json.load(open(manifest_path, encoding="utf8")).get("bodies", {})
    bodies = {}
    if previous and set(names) != set(SOURCES):
        bodies = dict(previous)
    for name in names:
        # a level 4 already made (`sharp`) is kept: the ordinary build does not make it and must not take it away
        kept = park_sharp(out, name, previous.get(name))
        shutil.rmtree(os.path.join(out, name), ignore_errors=True)
        bodies[name] = restore_sharp(kept, build_body(name, cache, out, textures))
    bodies = {name: bodies[name] for name in SOURCES if name in bodies}
    write_manifest(out, bodies)
    total = sum(b["bytes"] for b in bodies.values())
    print(f"{sum(b['tiles'] for b in bodies.values())} tiles, {total / 1048576:.1f} MB, in {out}")


def sharp_kept():
    """A level 4 that was made is still there after the ordinary build has replaced the body's folder (a fake level, no download)."""
    import tempfile

    with tempfile.TemporaryDirectory() as out:
        level = SHARP["moon"]["level"]
        folder = os.path.join(out, "moon", str(level), "0")
        os.makedirs(folder)
        open(os.path.join(folder, "0.webp"), "wb").write(b"fake")
        previous = {"levels": [{"level": 3, "tiles": 5, "bytes": 5}, {"level": level, "tiles": 2048, "bytes": 99}], "sharp": {"file": "x.tif"}}
        kept = park_sharp(out, "moon", previous)
        assert kept is not None, "a level 4 that was there was not found"
        shutil.rmtree(os.path.join(out, "moon"))
        assert not os.path.exists(folder)
        body = restore_sharp(kept, {"levels": [{"level": 1, "tiles": 32, "bytes": 1}, {"level": 3, "tiles": 5, "bytes": 5}], "tiles": 37, "bytes": 6})
        assert os.path.exists(os.path.join(folder, "0.webp")), "the level 4 tiles were lost"
        assert [one["level"] for one in body["levels"]] == [1, 3, level] and body["tiles"] == 32 + 5 + 2048 and body["sharp"] == {"file": "x.tif"}, body
        assert park_sharp(out, "mars", previous) is None and park_sharp(out, "moon", None) is None
        assert park_sharp(out, "jupiter", previous) is None


def selftest():
    """Make a level from a made-up source and base (a 256 pixel base, 64 pixel tiles), and check what a real build promises: the shape of the pyramid, that the level is the base's own colour at low
    frequencies and the source's detail at high ones, that no detail comes from where the source has none, that the tiles join into the picture, and that longitude 180 has no seam."""
    import tempfile

    global TILE, BASE
    saved = (TILE, BASE)
    TILE, BASE = 64, 256
    try:
        rng = np.random.default_rng(3)
        width = 1024
        # a source: a smooth picture with fine detail, and a black pole at the top (nothing was imaged there)
        smooth = np.linspace(0.2, 0.8, width // 2, dtype=np.float32)[:, None, None] * np.ones((1, width, 3), dtype=np.float32)
        fine = (rng.random((width // 2, width, 1)).astype(np.float32) - 0.5) * 0.2
        source = np.clip(smooth + fine, 0, 1)
        source[:40] = 0
        image = Image.fromarray((source * 255 + 0.5).astype(np.uint8))
        # the base is the source's own smaller picture, graded: a little brighter and redder
        base = np.clip(resize_f(source, BASE, BASE // 2) * 1.05 + np.array([0.04, 0, 0], dtype=np.float32), 0, 1)
        spec = {"night": True}
        picture = detail_level("fake", spec, base, image, width)
        assert picture.shape == (width // 2, width, 3), picture.shape
        # low frequencies are the base's: the level cut down to the base's size is the base
        down = resize_wrapped(picture, BASE, BASE // 2)
        assert np.abs(down - base).mean() < 0.012, f"the level's colour is not the base's: {np.abs(down - base).mean():.4f}"
        # high frequencies are the source's: the fine detail is there, where the source has data
        up = resize_wrapped(base, width, width // 2, Image.BICUBIC)
        added = (picture - up)[100:400]
        assert added.std() > 0.03, f"no detail was added: {added.std():.4f}"
        assert np.corrcoef(added[..., 0].ravel(), fine[100:400, :, 0].ravel())[0, 1] > 0.8, "the detail is not the source's"
        # where the source holds nothing (the black pole) no detail is added
        assert np.abs((picture - up)[:16]).mean() < 0.01, "detail came from where the source has none"
        # a source whose edge the picture fades into a plain tone (`fade`) has its detail fade as far: less of it just inside the edge, none of the crisp ground a seam is made of
        wide = detail_level("fake", {"night": True, "fade": 8}, base, image, width)
        assert np.abs((wide - up)[44:70]).mean() < 0.6 * np.abs((picture - up)[44:70]).mean(), "a wider fade did not take the detail from the edge"
        with tempfile.TemporaryDirectory() as folder:
            mask = Image.new("1", (128, 64), 1)
            mask.paste(0, (32, 0, 72, 64))
            path = os.path.join(folder, "footprints.png")
            mask.save(path)
            masked = detail_level("fake", {**spec, "mask": path}, base, image, width)
            assert np.array_equal(masked[100:400, 320:512], up[100:400, 320:512]), "detail came from the excluded swath"
            assert np.array_equal(masked[100:400, 80:160], picture[100:400, 80:160]), "the footprint mask removed measured detail"
        entry = cut(picture, tempfile.mkdtemp(), "fake", 2, 100)
        assert entry["columns"] == width // TILE and entry["rows"] == width // 2 // TILE, entry
        assert entry["tiles"] == entry["columns"] * entry["rows"]
        assert top_level(1024, 256) == 2 and top_level(1023, 256) == 1 and top_level(255, 256) == 0
        assert top_level(21339, 2048) == 3 and top_level(8191, 2048) == 1 and top_level(2047, 2048) == 0
        with tempfile.TemporaryDirectory() as folder:
            entry = cut(picture, folder, "fake", 2, 100)
            joined = np.zeros((width // 2, width, 3), dtype=np.uint8)
            for column in range(entry["columns"]):
                for row in range(entry["rows"]):
                    tile = np.asarray(Image.open(os.path.join(folder, "fake", "2", str(column), f"{row}.webp")).convert("RGB"))
                    joined[row * TILE : (row + 1) * TILE, column * TILE : (column + 1) * TILE] = tile
            assert np.abs(joined.astype(int) - (picture * 255 + 0.5).astype(np.uint8).astype(int)).max() <= 12, "the tiles do not join into the picture"
        # longitude 180 has no seam: a picture that is the same left and right of the edge stays the same across it
        flat = np.zeros((16, 64, 3), dtype=np.float32)
        flat[:, :8] = 1
        flat[:, -8:] = 1
        small = resize_wrapped(flat, 32, 8)
        assert abs(small[:, 0].mean() - small[:, -1].mean()) < 1e-3, "the antimeridian has a seam"
        # a feathered valid area is 1 well inside, 0 at the edge
        v = np.zeros((64, 128), dtype=np.float32)
        v[8:56, :] = 1
        e = erode_feather(v, 1)
        assert e[28, 64] > 0.99 and e[8, 64] < 0.5 and e[0, 64] == 0
    finally:
        TILE, BASE = saved
    print("selftest ok")


# Finer public-domain mosaics than the maps the ordinary build uses. They are not downloaded unless WAKUSEI_SHARP_TILES=1
# (the Pages workflow sets that only when the repository variable of the same name is 1). A file whose SHA-256 is not the one here is never cut.
# Read 2026-11-13. The Moon mosaic's access constraint on the USGS product page is "public domain". The Mars mosaic's is "Public domain".
SHARP = {
    "moon": {
        "url": "https://planetarymaps.usgs.gov/mosaic/Lunar_LRO_LROC-WAC_Mosaic_global_100m_June2013.tif",
        "sha256": "87159ead1888ae31bb647e957ec60943022b707ec804cb5353a304575936fd55",
        "file": "Lunar_LRO_LROC-WAC_Mosaic_global_100m_June2013.tif",
        "credit": "NASA / GSFC / Arizona State University (LROC WAC global morphology mosaic, 100 m a pixel, June 2013), USGS Astrogeology",
        "width": 109164,
        "height": 54582,
        "bands": 1,
        "level": 4,
        "quality": 78,
    },
    "mars": {
        "url": "https://planetarymaps.usgs.gov/mosaic/Mars_Viking_MDIM21_ClrMosaic_global_232m.tif",
        "sha256": "554f1170998b4cd00359defa48600307e52c49f921c282d842361ad45082aa31",
        "file": "Mars_Viking_MDIM21_ClrMosaic_global_232m.tif",
        "credit": "NASA / JPL / USGS (Viking MDIM 2.1 colour mosaic, 232 m a pixel, planetocentric, east of Airy-0)",
        "width": 92160,
        "height": 46080,
        "bands": 3,
        "level": 4,
        "quality": 78,
    },
}


def sharp(cache, out, names):
    """Cut level 4 (32768 pixels across) for the Moon and Mars from the big mosaics. Does not download unless WAKUSEI_SHARP_TILES=1."""
    if os.environ.get("WAKUSEI_SHARP_TILES") != "1":
        print("WAKUSEI_SHARP_TILES is not 1: the Moon and Mars sources are not downloaded")
        return
    unknown = [n for n in names if n not in SHARP]
    if unknown:
        sys.exit(f"no sharp mosaic for: {', '.join(unknown)} (moon, mars)")
    if shutil.which("gdal_translate") is None:
        sys.exit("gdal_translate is not on PATH (the big mosaic is scaled down with it, so it is never loaded whole)")
    os.makedirs(cache, exist_ok=True)
    os.makedirs(out, exist_ok=True)
    manifest_path = os.path.join(out, "manifest.json")
    bodies = {}
    if os.path.exists(manifest_path):
        bodies = json.load(open(manifest_path, encoding="utf8")).get("bodies", {})
    textures = os.path.join(ROOT, "textures")
    for name in names:
        source = SHARP[name]
        path = os.path.join(cache, source["file"])
        if not os.path.exists(path):
            print(f"downloading {source['file']}", flush=True)
            with urllib.request.urlopen(urllib.request.Request(source["url"], headers=UA), timeout=900, context=tls_context()) as response, open(path, "wb") as file:
                shutil.copyfileobj(response, file)
        digest = sha256_of(path)
        if source["sha256"] == "":
            raise SystemExit(f"{name}: sha256 {digest} (pin it in SHARP before the tiles are cut)")
        if digest != source["sha256"]:
            raise SystemExit(f"{path}: sha256 {digest} is not the expected {source['sha256']}")
        level = source["level"]
        width = BASE * 2**level
        height = width // 2
        if width > source["width"]:
            raise SystemExit(f"{name}: level {level} ({width} across) would enlarge a source {source['width']} across")
        raw = os.path.join(cache, f"{name}-{width}.raw")
        if not os.path.exists(raw):
            print(f"{name}: scaling to {width} x {height}", flush=True)
            interleave = ["-co", "INTERLEAVE=BIP"] if source["bands"] == 3 else []
            subprocess_check(["gdal_translate", "-q", "-outsize", str(width), str(height), "-ot", "Byte", "-of", "ENVI", *interleave, path, raw])
        base = np.asarray(Image.open(os.path.join(textures, f"{name}-{BASE}.webp")).convert("RGB"), dtype=np.float32) / 255.0
        shape = (height, width, 3) if source["bands"] == 3 else (height, width)
        src = np.memmap(raw, dtype=np.uint8, mode="r", shape=shape)
        entry = cut_sharp_strips(name, src, base, out, level, source["quality"])
        print(f"{name} level {level}: {width} x {height}, {entry['tiles']} tiles, {entry['bytes'] / 1048576:.2f} MB", flush=True)
        previous = bodies.get(name, {"levels": [], "tiles": 0, "bytes": 0})
        levels = [one for one in previous.get("levels", []) if one.get("level") != level]
        levels.append(entry)
        levels.sort(key=lambda one: one["level"])
        bodies[name] = {
            **previous,
            "levels": levels,
            "tiles": sum(one["tiles"] for one in levels),
            "bytes": sum(one["bytes"] for one in levels),
            "sharp": {"file": source["file"], "url": source["url"], "sha256": digest, "credit": source["credit"], "width": source["width"], "height": source["height"]},
        }
    write_manifest(out, bodies)


def subprocess_check(argv):
    import subprocess
    result = subprocess.run(argv)
    if result.returncode != 0:
        raise SystemExit(f"{' '.join(argv)} failed ({result.returncode})")


def cut_sharp_strips(name, src, base, out, level, quality):
    """Write one level from a memory-mapped picture, a strip at a time, so the whole map is never in memory. The colour is the 2048 picture's; the fine detail is the source's."""
    height, width = src.shape[0], src.shape[1]
    columns, rows = width // TILE, height // TILE
    total = 0
    grey = src.ndim == 2
    for row in range(rows):
        y0, y1 = row * TILE, (row + 1) * TILE
        strip = np.asarray(src[y0:y1], dtype=np.float32) / 255.0
        if grey:
            strip = np.repeat(strip[..., None], 3, axis=2)
        b0 = int(y0 * base.shape[0] / height)
        b1 = max(b0 + 1, int(y1 * base.shape[0] / height))
        band = np.asarray(Image.fromarray((base[b0:b1] * 255).astype(np.uint8)).resize((width, TILE), Image.BICUBIC), dtype=np.float32) / 255.0
        low = np.asarray(Image.fromarray((strip * 255).astype(np.uint8)).filter(ImageFilter.BoxBlur(8)), dtype=np.float32) / 255.0
        picture = np.clip(band + (strip - low), 0, 1)
        image = Image.fromarray((picture * 255 + 0.5).astype(np.uint8))
        for column in range(columns):
            folder = os.path.join(out, name, str(level), str(column))
            os.makedirs(folder, exist_ok=True)
            path = os.path.join(folder, f"{row}.webp")
            image.crop((column * TILE, 0, (column + 1) * TILE, TILE)).save(path, "WEBP", quality=quality, method=5)
            total += os.path.getsize(path)
    return {"level": level, "width": width, "height": height, "columns": columns, "rows": rows, "tiles": columns * rows, "bytes": total}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["build", "selftest", "sharp", "key"])
    parser.add_argument("--cache", default=os.path.join(ROOT, ".cache", "body-tiles"))
    parser.add_argument("--out", default=os.path.join(ROOT, ".cache", "body-tiles-out"))
    parser.add_argument("--bodies", default=",".join(SOURCES))
    args = parser.parse_args()
    if args.command == "key":
        # what the Pages workflow keys the cache of the downloaded sources on: the SHA-256 of each source, so the files are fetched again only when one of them is replaced in SOURCES
        print(hashlib.sha256("\n".join(f"{name}:{SOURCES[name]['sha256']}" for name in sorted(SOURCES)).encode()).hexdigest())
        return
    if args.command == "selftest":
        context = tls_context()
        if context.verify_mode != ssl.CERT_REQUIRED or not context.check_hostname:
            raise SystemExit("the download context does not verify certificates")
        selftest()
        saved = os.environ.pop("WAKUSEI_SHARP_TILES", None)
        gate = io.StringIO()
        with contextlib.redirect_stdout(gate):
            sharp(os.devnull, os.devnull, ["moon", "mars"])
        if saved is not None:
            os.environ["WAKUSEI_SHARP_TILES"] = saved
        if "not downloaded" not in gate.getvalue():
            raise SystemExit("the sharp cut ran with WAKUSEI_SHARP_TILES off")
        sharp_kept()
        print("sharp level kept ok")
        return
    elif args.command == "sharp":
        sharp(args.cache, args.out, [n for n in args.bodies.split(",") if n])
    else:
        names = [n for n in args.bodies.split(",") if n]
        unknown = [n for n in names if n not in SOURCES]
        if unknown:
            sys.exit(f"no such body: {', '.join(unknown)} (known: {', '.join(SOURCES)})")
        build(args.cache, args.out, names)


if __name__ == "__main__":
    main()
