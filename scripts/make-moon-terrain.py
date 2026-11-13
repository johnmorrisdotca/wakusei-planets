#!/usr/bin/env python3
"""Cut the Moon's measured heights at a landing site into a pyramid of 256 px height tiles (see NOTICE.md and docs/guides/surface.md).

    python3 -I scripts/make-moon-terrain.py build [--sources DIR] [--out DIR] [--site apollo-17]
    python3 -I scripts/make-moon-terrain.py selftest

Needs Python 3, Pillow and numpy (python3 -m venv .cache/venv && .cache/venv/bin/pip install pillow numpy, then run the venv's python with -I).
`build` reads the source files from DIR (default ~/Projects/backups/wakusei-planets/2026-11-13-moon-terrain-sources: the files are never in the checkout) and writes
OUT/moon/<site>/terrain/<level>/<column>/<row>.png and OUT/moon/<site>/manifest.json (default OUT: .cache/moon-terrain-out). The tiles are never committed and never in the
npm package: the Pages workflow builds them and serves them beside the demo, next to the body tiles.

The sources (NOTICE.md says where each comes from and what it asks for):
  NAC_DTM_APOLLO17.TIF   LROC narrow angle camera height model, 5 m a pixel, 32 bit floats, heights in metres from a sphere of radius 1737.4 km.
  ldem_64_window_*.u16le LOLA's global height map at 64 pixels a degree (474 m), 16 bit, a window of it cut by byte ranges: height = value * 0.5 m, from the same sphere.

The site's own plane: x to the east, y to the north, in metres from the landing point, on the tangent plane (a sphere's drop is the viewer's to add: d * d / 2R). A level is a square of
SIZE x SIZE samples cut into 256 sample tiles; its heights are stored as 16 bits, high byte in red and low byte in green, over the manifest's `height.min` and `height.range`, so a
height is exact to range / 65535 m (0.122 m for the 8,000 m of the sites made so far). A browser cannot read a 16 bit PNG whole, which is why the two bytes are two colours.
Where the model has no data (its edge) the coarse map's heights fill the gap, so every level is complete. Each level is made from its finer neighbour by the mean of 2 x 2 samples, and
the coarse level (`far`) is the global map resampled onto the plane, bilinear.
"""
import argparse
import json
import math
import os
import struct
import sys

import numpy as np
from PIL import Image

TILE = 256
R_MOON = 1737400.0
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
DEFAULT_SOURCES = os.path.expanduser("~/Projects/backups/wakusei-planets/2026-11-13-moon-terrain-sources")
HEIGHT_MIN = -4000.0
HEIGHT_RANGE = 8000.0

# Each site: where the viewer stands (planetocentric degrees, the package's own place list for the Apollo 17 lunar module), the source files and the levels to cut.
SITES = {
    "apollo-17": {
        "name": {"en": "Apollo 17, Taurus-Littrow", "ja": "アポロ17号、タウルス・リットロー"},
        "lat": 20.1911,
        "lon": 30.7723,
        "dtm": "NAC_DTM_APOLLO17.TIF",
        # the model's projection: equirectangular about latitude 20, longitude 180; the top left corner of its first pixel
        "dtm_center_lat": 20.0,
        "dtm_center_lon": 180.0,
        "dtm_x0": -4276880.0,
        "dtm_y0": 645990.0,
        "dtm_res": 5.0,
        # the ground picture: a low-Sun mosaic of the narrow angle camera, 5 m a pixel, 8 bits; its projection is equirectangular about latitude 20 and longitude 30.2
        "ortho": "NAC_ROI_APOLLO17LOC_E205N0306_5M.TIF",
        "ortho_center_lon": 30.2,
        "ortho_x0": -8020.0,
        "ortho_y0": 657200.0,
        "ortho_res": 5.0,
        "far": "ldem_64_window_lat0-45_lon0-70.u16le",
        "far_lat_top": 45.0,
        "far_lon_west": 0.0,
        "far_ppd": 64,
        # name, metres a sample, tiles across (the level is centred on the site)
        "levels": [("h5", 5.0, 8), ("h20", 20.0, 8), ("h80", 80.0, 8)],
        "far_level": ("far", 480.0, 4),
        "heights_credit": "NASA/GSFC/Arizona State University (LROC), LOLA Team (NASA/GSFC)",
        "ground_credit": "NASA/GSFC/Arizona State University (LROC)",
        "accuracy": "about 1 m vertical, about 10 m horizontal, to LOLA's own uncertainty (Henriksen et al. 2017); one point every 5 m",
    },
}


def read_dtm(path, site):
    """The height model as a float32 array (rows north to south), NaN where it has no data."""
    with open(path, "rb") as f:
        head = f.read(8)
        assert head[:2] == b"II" and struct.unpack("<H", head[2:4])[0] == 42, "a little-endian classic TIFF"
        (ifd,) = struct.unpack("<I", head[4:8])
        f.seek(ifd)
        (n,) = struct.unpack("<H", f.read(2))
        tags = {}
        for _ in range(n):
            tag, typ, cnt, val = struct.unpack("<HHII", f.read(12))
            tags[tag] = (typ, cnt, val)
        width, height = tags[256][2], tags[257][2]
        assert tags[258][2] == 32 and tags[259][2] == 1 and tags[339][2] == 3, "32 bit floats, uncompressed"
        f.seek(tags[273][2])
        offsets = np.frombuffer(f.read(4 * tags[273][1]), dtype="<u4").astype(np.int64)
    assert np.all(np.diff(offsets) == width * 4), "rows follow each other"
    data = np.memmap(path, dtype="<f4", mode="r", offset=int(offsets[0]), shape=(height, width))
    out = np.array(data, dtype=np.float32)
    out[out < -1e30] = np.nan
    return out


def read_tiff_rows(path, dtype, crop=None):
    """An uncompressed single band strip TIFF of one row a strip as an array (rows north to south): the whole image, or `crop` = (row0, row1, col0, col1)."""
    with open(path, "rb") as f:
        head = f.read(8)
        assert head[:2] == b"II" and struct.unpack("<H", head[2:4])[0] == 42
        (ifd,) = struct.unpack("<I", head[4:8])
        f.seek(ifd)
        (n,) = struct.unpack("<H", f.read(2))
        tags = {}
        for _ in range(n):
            tag, typ, cnt, val = struct.unpack("<HHII", f.read(12))
            tags[tag] = (typ, cnt, val)
        width, height = tags[256][2], tags[257][2]
        f.seek(tags[273][2])
        offsets = np.frombuffer(f.read(4 * tags[273][1]), dtype="<u4").astype(np.int64)
    itemsize = np.dtype(dtype).itemsize
    assert np.all(np.diff(offsets) == width * itemsize), "rows follow each other"
    data = np.memmap(path, dtype=dtype, mode="r", offset=int(offsets[0]), shape=(height, width))
    if crop is not None:
        r0, r1, c0, c1 = crop
        return np.array(data[r0:r1, c0:c1])
    return np.array(data)


def shade_of(height, res, azimuth, elevation):
    """Lommel-Seeliger shading of a height grid (rows north to south, `res` metres a sample) for a Sun at `azimuth` (degrees clockwise from north) and `elevation`, seen from straight above: mu0 / (mu0 + mu), 0 where the slope faces away."""
    dz_drow, dz_dcol = np.gradient(height.astype(np.float64), res)
    nx, ny, nz = -dz_dcol, dz_drow, np.ones_like(dz_dcol)  # east, north (rows go south), up
    norm = np.sqrt(nx * nx + ny * ny + nz * nz)
    a, e = math.radians(azimuth), math.radians(elevation)
    mu0 = (nx * math.sin(a) * math.cos(e) + ny * math.cos(a) * math.cos(e) + nz * math.sin(e)) / norm
    mu = nz / norm
    return np.where(mu0 > 0, mu0 / (mu0 + mu), 0.0)


def fit_sun(height, image, res, stride=9):
    """The Sun a mosaic was lit by, fitted to the heights it covers: the azimuth and elevation whose shading of the heights correlates best with the picture (a grid, then a finer one)."""
    h = height[::stride, ::stride]
    im = image[::stride, ::stride].astype(np.float64)
    ok = np.isfinite(h) & (im > 4)
    hh = np.where(np.isfinite(h), h, np.nanmean(h))
    best = (-2.0, 0.0, 0.0)

    def score(az, el):
        sh = shade_of(hh, res * stride, az, el)
        a, b = sh[ok], im[ok]
        return float(np.corrcoef(a, b)[0, 1]) if a.std() > 0 and b.std() > 0 else -1.0

    for az in range(0, 360, 10):
        for el in range(4, 50, 6):
            c = score(az, el)
            if c > best[0]:
                best = (c, float(az), float(el))
    c0, az0, el0 = best
    for az in np.arange(az0 - 10, az0 + 10.1, 2.0):
        for el in np.arange(max(1.0, el0 - 6), el0 + 6.1, 1.0):
            c = score(float(az), float(el))
            if c > best[0]:
                best = (c, float(az) % 360, float(el))
    return best


def albedo_of(height, image, res, azimuth, elevation):
    """The ground's own brightness: the picture divided by the shading of the heights it was lit by (and a small constant, so that a flat patch of a low Sun's picture is not divided by nearly nothing), 0 to 1 with its middle at 0.5. Where the picture is far darker than the shading says (a shadow the heights cast on the picture) it is the middle."""
    sh = shade_of(height, res, azimuth, elevation)
    im = image.astype(np.float64)
    ratio = im / (sh + 0.06)
    valid = im > 3
    mid = float(np.median(ratio[valid]))
    ratio = np.where(valid, ratio, mid)
    ratio = np.where(ratio < 0.45 * mid, mid, ratio)
    return np.clip(ratio / (2.0 * mid), 0.0, 1.0).astype(np.float32)


def site_xy(lat, lon, site):
    """A latitude and longitude as metres in the model's projection."""
    x = R_MOON * math.cos(math.radians(site["dtm_center_lat"])) * math.radians(lon - site["dtm_center_lon"])
    y = R_MOON * math.radians(lat)
    return x, y


def plane_to_lonlat(x, y, site):
    """Metres east and north of the site on its tangent plane to the latitude and longitude (a sphere of the Moon's radius), arrays in, arrays out."""
    lat = site["lat"] + np.degrees(y / R_MOON)
    lon = site["lon"] + np.degrees(x / (R_MOON * np.cos(np.radians(site["lat"] + np.degrees(y / R_MOON) * 0.5))))
    return lat, lon


def mean2(a):
    """The mean of each 2 x 2 block, ignoring NaN; NaN where all four are."""
    h, w = a.shape[0] // 2 * 2, a.shape[1] // 2 * 2
    b = a[:h, :w].reshape(h // 2, 2, w // 2, 2)
    ok = ~np.isnan(b)
    n = ok.sum(axis=(1, 3))
    s = np.where(ok, b, 0).sum(axis=(1, 3))
    with np.errstate(invalid="ignore", divide="ignore"):
        return np.where(n > 0, s / np.maximum(n, 1), np.nan).astype(np.float32)


def bilinear(grid, rows, cols):
    """`grid` sampled at fractional (row, col) arrays, edge samples held."""
    h, w = grid.shape
    r = np.clip(rows, 0, h - 1.001)
    c = np.clip(cols, 0, w - 1.001)
    r0 = np.floor(r).astype(np.int64)
    c0 = np.floor(c).astype(np.int64)
    fr, fc = r - r0, c - c0
    a = grid[r0, c0]
    b = grid[r0, c0 + 1]
    d = grid[r0 + 1, c0]
    e = grid[r0 + 1, c0 + 1]
    return (a * (1 - fc) + b * fc) * (1 - fr) + (d * (1 - fc) + e * fc) * fr


def bilinear_valid(grid, rows, cols):
    """`grid` (NaN where there is no data) sampled at fractional (row, col) arrays: the value, and NaN wherever any of the four samples round the point has no data."""
    value = bilinear(np.nan_to_num(grid, nan=0.0), rows, cols)
    ok = bilinear(np.isfinite(grid).astype(np.float32), rows, cols) > 0.9999
    return np.where(ok, value, np.nan).astype(np.float32)


def encode(heights):
    """Heights in metres to an RGB array: 16 bits over HEIGHT_MIN and HEIGHT_RANGE, high byte red, low byte green."""
    v = np.clip(np.rint((heights - HEIGHT_MIN) / HEIGHT_RANGE * 65535.0), 0, 65535).astype(np.uint16)
    rgb = np.zeros(v.shape + (3,), dtype=np.uint8)
    rgb[..., 0] = v >> 8
    rgb[..., 1] = v & 255
    return rgb


def decode(rgb):
    """The inverse of `encode`, for the self test and for anything that reads the tiles back."""
    v = (rgb[..., 0].astype(np.uint16) << 8) | rgb[..., 1].astype(np.uint16)
    return v.astype(np.float64) / 65535.0 * HEIGHT_RANGE + HEIGHT_MIN


def write_level(out_dir, level_id, grid):
    """Cut `grid` (tiles x TILE square) into PNG tiles. Returns the bytes written."""
    total = 0
    n = grid.shape[0] // TILE
    for col in range(n):
        folder = os.path.join(out_dir, level_id, str(col))
        os.makedirs(folder, exist_ok=True)
        for row in range(n):
            tile = grid[row * TILE : (row + 1) * TILE, col * TILE : (col + 1) * TILE]
            path = os.path.join(folder, f"{row}.png")
            Image.fromarray(encode(tile), "RGB").save(path, optimize=True)
            total += os.path.getsize(path)
    return total


def build_levels(site, dtm, far_grid):
    """The site-centred grids, finest first. `dtm` is the model (rows north to south), `far_grid` a function from (lat, lon) arrays to the coarse map's heights."""
    x_site, y_site = site_xy(site["lat"], site["lon"], site)
    res = site["dtm_res"]
    levels = {}
    # the finest level: every sample of its square at 5 m, from the model, the coarse map where the model has nothing
    first_id, first_res, first_tiles = site["levels"][0]
    size = first_tiles * TILE
    half = size * first_res / 2
    xs = (np.arange(size) + 0.5) * first_res - half
    ys = half - (np.arange(size) + 0.5) * first_res
    col = ((x_site + xs) - site["dtm_x0"]) / res - 0.5
    row = (site["dtm_y0"] - (y_site + ys)) / res - 0.5
    cc, rr = np.meshgrid(col, row)
    inside = (cc >= 0) & (cc <= dtm.shape[1] - 1.001) & (rr >= 0) & (rr <= dtm.shape[0] - 1.001)
    height = bilinear_valid(dtm, np.where(inside, rr, 0), np.where(inside, cc, 0))
    height[~inside] = np.nan
    gx, gy = np.meshgrid(xs, ys)
    lat, lon = plane_to_lonlat(gx, gy, site)
    coarse = far_grid(lat, lon)
    hole = np.isnan(height)
    height[hole] = coarse[hole]
    levels[first_id] = height
    # the next levels: a block mean of the model at their own spacing, sampled at their points
    for level_id, level_res, tiles in site["levels"][1:]:
        size = tiles * TILE
        half = size * level_res / 2
        xs = (np.arange(size) + 0.5) * level_res - half
        ys = half - (np.arange(size) + 0.5) * level_res
        # a block mean of the model at this spacing, then sampled at the sample points
        k = int(round(level_res / res))
        block = dtm
        for _ in range(int(round(math.log2(k)))):
            block = mean2(block)
        bres = res * k
        col = ((x_site + xs) - site["dtm_x0"]) / bres - 0.5
        row = (site["dtm_y0"] - (y_site + ys)) / bres - 0.5
        cc, rr = np.meshgrid(col, row)
        inside = (cc >= 0) & (cc <= block.shape[1] - 1.001) & (rr >= 0) & (rr <= block.shape[0] - 1.001)
        height = bilinear_valid(block, np.where(inside, rr, 0), np.where(inside, cc, 0))
        height[~inside] = np.nan
        gx, gy = np.meshgrid(xs, ys)
        lat, lon = plane_to_lonlat(gx, gy, site)
        coarse = far_grid(lat, lon)
        hole = np.isnan(height)
        height[hole] = coarse[hole]
        levels[level_id] = height
    # the coarse level, from the global map alone
    far_id, far_res, far_tiles = site["far_level"]
    size = far_tiles * TILE
    half = size * far_res / 2
    xs = (np.arange(size) + 0.5) * far_res - half
    ys = half - (np.arange(size) + 0.5) * far_res
    gx, gy = np.meshgrid(xs, ys)
    lat, lon = plane_to_lonlat(gx, gy, site)
    levels[far_id] = far_grid(lat, lon).astype(np.float32)
    return levels


def far_sampler(site, path):
    """A function (lat, lon) -> height from the coarse window file."""
    raw = np.fromfile(path, dtype="<i2").astype(np.float32) * 0.5
    ppd = site["far_ppd"]
    # the window is `rows` rows of `cols` columns; the label of the file's name says the degrees: lat0-45 lon0-70
    name = os.path.basename(path)
    parts = name.replace(".u16le", "").split("_")
    lat_lo, lat_hi = [float(x) for x in parts[3].replace("lat", "").split("-")]
    lon_lo, lon_hi = [float(x) for x in parts[4].replace("lon", "").split("-")]
    rows, cols = int(round((lat_hi - lat_lo) * ppd)), int(round((lon_hi - lon_lo) * ppd))
    assert raw.size == rows * cols, f"{raw.size} samples, not {rows} x {cols}"
    grid = raw.reshape(rows, cols)

    def sample(lat, lon):
        r = (lat_hi - lat) * ppd - 0.5
        c = (lon - lon_lo) * ppd - 0.5
        return bilinear(grid, r, c)

    return sample


def build_ground(args, site, dtm, out):
    """The ground picture: the mosaic with the shading of the heights divided out, as 8 bit tiles on the same grids as the first three height levels. Returns what goes in the manifest."""
    src = os.path.expanduser(args.sources)
    print("reading the ground picture ...", flush=True)
    ortho = read_tiff_rows(os.path.join(src, site["ortho"]), "u1")
    x_site, y_site = site_xy(site["lat"], site["lon"], site)
    res = site["dtm_res"]
    # the site's pixel in the height model, and a square of 8192 x 8192 samples round it (20 km each way), where the two pictures are put on one grid
    col_s = (x_site - site["dtm_x0"]) / res - 0.5
    row_s = (site["dtm_y0"] - y_site) / res - 0.5
    half = 4096
    c0, r0 = int(round(col_s)) - half, int(round(row_s)) - half
    crop = dtm[r0 : r0 + 2 * half, c0 : c0 + 2 * half]
    cols = c0 + np.arange(2 * half)
    rows = r0 + np.arange(2 * half)
    # the model's pixel centre to the mosaic's pixel: the same projection about another longitude, so only a shift across
    shift = R_MOON * math.cos(math.radians(site["dtm_center_lat"])) * math.radians(site["dtm_center_lon"] - site["ortho_center_lon"])
    ocol = ((site["dtm_x0"] + (cols + 0.5) * res) + shift - site["ortho_x0"]) / site["ortho_res"] - 0.5
    orow = (site["ortho_y0"] - (site["dtm_y0"] - (rows + 0.5) * res)) / site["ortho_res"] - 0.5
    cc, rr = np.meshgrid(ocol, orow)
    inside = (cc >= 0) & (cc <= ortho.shape[1] - 1.001) & (rr >= 0) & (rr <= ortho.shape[0] - 1.001)
    image = bilinear(ortho.astype(np.float32), np.where(inside, rr, 0), np.where(inside, cc, 0))
    image[~inside] = 0
    del cc, rr
    filled = np.where(np.isfinite(crop), crop, np.nanmean(crop))
    print("fitting the Sun the picture was lit by ...", flush=True)
    score, az, el = fit_sun(np.where(np.isfinite(crop), crop, np.nan), image, res)
    print(f"  azimuth {az:.0f}, elevation {el:.0f} degrees, correlation {score:.2f}", flush=True)
    albedo = albedo_of(filled, image, res, az, el)
    albedo[image < 3] = 0.5
    # the levels: block means of the 5 m grid, sampled at the site-centred points; the middle grey outside the square
    info = []
    total = 0
    mid_c = col_s - c0
    mid_r = row_s - r0
    block = albedo
    done = 0
    for level_id, level_res, tiles in site["levels"]:
        k = int(round(level_res / res))
        while done < int(round(math.log2(k))):
            block = mean2(block)
            done += 1
        bres = res * k
        size = tiles * TILE
        half_m = size * level_res / 2
        xs = (np.arange(size) + 0.5) * level_res - half_m
        ys = half_m - (np.arange(size) + 0.5) * level_res
        col = mid_c * res / bres + xs / bres - 0.5 + 0.0
        row = mid_r * res / bres - ys / bres - 0.5
        cc, rr = np.meshgrid(col, row)
        inside = (cc >= 0) & (cc <= block.shape[1] - 1.001) & (rr >= 0) & (rr <= block.shape[0] - 1.001)
        grid = bilinear(block, np.where(inside, rr, 0), np.where(inside, cc, 0))
        grid[~inside] = 0.5
        written = 0
        name = "a" + level_id[1:]
        for column in range(tiles):
            folder = os.path.join(out, "ground", name, str(column))
            os.makedirs(folder, exist_ok=True)
            for rw in range(tiles):
                tile = grid[rw * TILE : (rw + 1) * TILE, column * TILE : (column + 1) * TILE]
                path = os.path.join(folder, f"{rw}.webp")
                Image.fromarray(np.clip(np.rint(tile * 255.0), 0, 255).astype(np.uint8), "L").save(path, "WEBP", quality=80, method=6)
                written += os.path.getsize(path)
        total += written
        info.append({"id": name, "res": level_res, "tiles": tiles, "half": half_m, "bytes": written})
        print(f"  {name}: {tiles} x {tiles} tiles, {level_res:g} m, {written / 1e6:.1f} MB", flush=True)
    return {"levels": info, "bytes": total, "credit": site["ground_credit"], "sun": {"azimuth": az, "elevation": el, "correlation": round(score, 3)}}


def build(args):
    site = SITES[args.site]
    src = os.path.expanduser(args.sources)
    print("reading the height model ...", flush=True)
    dtm = read_dtm(os.path.join(src, site["dtm"]), site)
    print(f"  {dtm.shape[1]} x {dtm.shape[0]} samples, {100 * np.isfinite(dtm).mean():.1f} % with data, {np.nanmin(dtm):.0f} to {np.nanmax(dtm):.0f} m", flush=True)
    if args.far_window is None:
        far = far_sampler(site, os.path.join(src, site["far"]))
    else:
        # a try-out with no coarse map (the far ground a flat -2400 m): the pictures made from it are not the real horizon
        far = lambda lat, lon: np.full(lat.shape, -2400.0, dtype=np.float32)
    print("making the levels ...", flush=True)
    levels = build_levels(site, dtm, far)
    out = os.path.join(os.path.expanduser(args.out), "moon", args.site)
    os.makedirs(os.path.join(out, "terrain"), exist_ok=True)
    info = []
    total = 0
    for level_id, grid in levels.items():
        spec = next((l for l in site["levels"] if l[0] == level_id), None) or site["far_level"]
        assert np.isfinite(grid).all(), f"{level_id} has gaps"
        assert grid.min() > HEIGHT_MIN and grid.max() < HEIGHT_MIN + HEIGHT_RANGE
        written = write_level(os.path.join(out, "terrain"), level_id, grid)
        total += written
        info.append({"id": level_id, "res": spec[1], "tiles": spec[2], "half": spec[2] * TILE * spec[1] / 2, "bytes": written, "min": float(grid.min()), "max": float(grid.max())})
        print(f"  {level_id}: {spec[2]} x {spec[2]} tiles of {TILE}, {spec[1]:g} m, {written / 1e6:.1f} MB, heights {grid.min():.0f} to {grid.max():.0f} m", flush=True)
    ground = build_ground(args, site, dtm, out) if not args.no_ground else None
    centre = levels[site["levels"][0][0]]
    mid = centre.shape[0] // 2
    manifest = {
        "version": 1,
        "body": "moon",
        "site": args.site,
        "name": site["name"],
        "lat": site["lat"],
        "lon": site["lon"],
        "radius": R_MOON,
        "tile": TILE,
        "height": {"min": HEIGHT_MIN, "range": HEIGHT_RANGE},
        "ground": float(centre[mid - 1 : mid + 1, mid - 1 : mid + 1].mean()),
        "levels": info,
        "picture": ground,
        "credit": site["heights_credit"],
        "accuracy": site["accuracy"],
        "bytes": total + (ground["bytes"] if ground else 0),
    }
    with open(os.path.join(out, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=1)
    print(f"done: {total / 1e6:.1f} MB of tiles in {out}", flush=True)


def selftest(_args):
    """A made-up site with a hill and a hole: the levels are complete, the tiles read back to a fraction of a metre, and the plane maps back to the right longitude."""
    rng = np.random.default_rng(7)
    site = dict(SITES["apollo-17"])
    site["lat"], site["lon"] = 0.0, 0.0
    assert abs(plane_to_lonlat(np.array([0.0]), np.array([0.0]), site)[0][0]) < 1e-9
    lat, lon = plane_to_lonlat(np.array([30323.0]), np.array([0.0]), site)
    assert abs(lon[0] - 1.0) < 1e-3, lon
    # the codec
    h = rng.uniform(-3999, 3999, (64, 64))
    assert np.abs(decode(encode(h)) - h).max() <= HEIGHT_RANGE / 65535.0, "16 bits in two colours"
    # the block mean
    a = np.array([[1, 2], [3, np.nan]], dtype=np.float32)
    assert mean2(a)[0, 0] == 2.0 and np.isnan(mean2(np.full((2, 2), np.nan, dtype=np.float32))[0, 0])
    # the bilinear sample
    g = np.arange(16, dtype=np.float32).reshape(4, 4)
    assert abs(bilinear(g, np.array([1.5]), np.array([1.5]))[0] - 7.5) < 1e-6
    # a small site: a 300 x 300 model with a hill and a hole
    small = {**site, "dtm_res": 5.0, "dtm_x0": -750.0, "dtm_y0": 750.0, "dtm_center_lat": 0.0, "dtm_center_lon": 0.0, "levels": [("h5", 5.0, 1), ("h20", 20.0, 1)], "far_level": ("far", 480.0, 1)}
    yy, xx = np.mgrid[0:300, 0:300]
    dtm = (-1000.0 + 100.0 * np.exp(-(((xx - 150) ** 2 + (yy - 150) ** 2) / 4000.0))).astype(np.float32)
    dtm[:40, :] = np.nan
    levels = build_levels(small, dtm, lambda la, lo: np.full(la.shape, -950.0, dtype=np.float32))
    assert set(levels) == {"h5", "h20", "far"}
    for name, grid in levels.items():
        assert np.isfinite(grid).all(), f"{name} complete"
    centre = levels["h5"][128, 128]
    assert -910 < centre < -890, centre  # the hill's top, 100 m over -1000
    assert abs(levels["h5"][2, 128] - (-950.0)) < 1e-3, "the hole is filled from the coarse map"
    # the Sun fit: a hill lit from the south-west at 25 degrees is found again from its shading
    yy, xx = np.mgrid[0:200, 0:200]
    hill = (80.0 * np.exp(-(((xx - 100) ** 2 + (yy - 100) ** 2) / 1800.0)) + 8.0 * np.sin(xx / 6.0) * np.cos(yy / 9.0)).astype(np.float32)
    lit = shade_of(hill, 5.0, 225.0, 25.0) * 200.0 + 5.0
    score, az, el = fit_sun(hill, lit, 5.0, stride=1)
    assert abs(((az - 225.0 + 180) % 360) - 180) <= 6 and abs(el - 25.0) <= 6 and score > 0.95, (score, az, el)
    # and divided out again: the albedo of a hill with a bright patch has the patch, not the hill
    patch = lit.copy()
    patch[40:60, 40:60] *= 1.5
    alb = albedo_of(hill, patch, 5.0, 225.0, 25.0)
    assert alb[50, 50] > 1.3 * alb[150, 150], "the patch stays brighter"
    assert abs(float(alb[100, 100]) - float(alb[150, 150])) < 0.25, "the hill's own shading is gone"
    print("selftest ok")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build")
    b.add_argument("--sources", default=DEFAULT_SOURCES)
    b.add_argument("--out", default=os.path.join(ROOT, ".cache", "moon-terrain-out"))
    b.add_argument("--site", default="apollo-17", choices=sorted(SITES))
    b.add_argument("--no-ground", action="store_true", help="skip the ground picture")
    b.add_argument("--far-window", default=None, help="skip the coarse map and use a flat far ground (a try-out)")
    b.set_defaults(fn=build)
    s = sub.add_parser("selftest")
    s.set_defaults(fn=selftest)
    args = parser.parse_args()
    sys.exit(args.fn(args) or 0)
