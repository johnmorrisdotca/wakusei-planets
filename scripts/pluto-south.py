#!/usr/bin/env python3
"""Quilt Pluto's unphotographed south from the New Horizons mosaics.

The south was in polar night, so the mosaic is black there. The photographed
half is the USGS 300 m LORRI/MVIC terrain, coloured by the Ralph/MVIC global
colour map. The south is filled with many different pieces of that
photographed ground (turned by right angles, scaled a little, never the same
piece beside itself). The pole is filled in a south-polar projection and
written back onto every pixel, so it is not pinched into spokes.

Seed 17981123. Both source files are NASA / JHUAPL / SwRI, public domain.
The Commons file is checked for its licence and is not the picture.

The master is kept out of the repository:

  ~/Library/CloudStorage/Dropbox/Projects/Handoff/3d-assets/wakusei/pluto/pluto-south-16384.png

Run: python3 scripts/pluto-south.py
     python3 scripts/pluto-south.py --width 2048
"""
import hashlib, json, os, sys, urllib.parse, urllib.request
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

SEED = 17981123
MASTER_W = 16384
WIDTHS = (512, 1024, 2048)
SOURCE_TITLE = "Pluto color mapmosaic.jpg"
POLAR_BLEND = -34.0  # just south of the photographed edge
POLAR_FULL = -55.0  # from here to the pole the polar picture is the whole pixel
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DROPBOX = os.path.expanduser("~/Library/CloudStorage/Dropbox/Projects/Handoff/3d-assets/wakusei/pluto")
TERRAIN_PATH = os.path.join(DROPBOX, "sources", "Pluto_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif")
TERRAIN_SHA = "592b7fb0f88cafa0bedf9f33bb71e983952a250ee8577edf2abfe814b473356b"
TERRAIN_PAGE = "https://astrogeology.usgs.gov/search/map/pluto_new_horizons_lorri_mvic_global_mosaic_300m"
TERRAIN_URL = "https://planetarymaps.usgs.gov/mosaic/Pluto_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif"
COLOUR_PATH = os.path.join(DROPBOX, "sources", "PIA11707.tif")
COLOUR_SHA = "cdee0025859fe36067da51f0e50137f3a39023d11c5b18d5c6f59fd8f53d2a60"
COLOUR_PAGE = "https://science.nasa.gov/photojournal/pluto-color-map/"
COLOUR_URL = "https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia11/pia11707/PIA11707.tif"
UA = {"User-Agent": "wakusei-planets-build/0.1 (https://github.com/johnmorrisdotca/wakusei-planets)"}


def licence_is_public_domain():
    query = urllib.parse.urlencode({
        "action": "query", "titles": "File:" + SOURCE_TITLE, "prop": "imageinfo",
        "iiprop": "extmetadata", "iiextmetadatafilter": "LicenseShortName", "format": "json",
    })
    req = urllib.request.Request("https://commons.wikimedia.org/w/api.php?" + query, headers=UA)
    page = list(json.load(urllib.request.urlopen(req, timeout=30))["query"]["pages"].values())[0]
    lic = page["imageinfo"][0]["extmetadata"].get("LicenseShortName", {}).get("value", "")
    if not (lic.lower().startswith("public domain") or lic.lower().startswith("cc0")):
        sys.exit(f"pluto source is '{lic}', not public domain: not used")
    print(f"source licence: {lic}", flush=True)


def file_sha(path, expect, label):
    digest = hashlib.sha256(open(path, "rb").read()).hexdigest()
    if digest != expect:
        sys.exit(f"{label} SHA-256 {digest} is not the file this script records")
    return digest


def roll_half(img):
    w = img.shape[1]
    return np.concatenate([img[:, w // 2 :], img[:, : w // 2]], axis=1)


def align_and_tint(width):
    """The 300 m terrain, turned to the package's longitude, coloured by the MVIC map."""
    for path in (TERRAIN_PATH, COLOUR_PATH):
        if not os.path.exists(path):
            sys.exit(f"missing {path}")
    file_sha(TERRAIN_PATH, TERRAIN_SHA, "terrain")
    file_sha(COLOUR_PATH, COLOUR_SHA, "colour")
    height = width // 2
    grey = np.array(
        Image.open(TERRAIN_PATH).convert("L").resize((width, height), Image.Resampling.LANCZOS),
        dtype=np.float32,
    )
    colour = np.array(
        Image.open(COLOUR_PATH).convert("RGB").resize((width, height), Image.Resampling.LANCZOS),
        dtype=np.float32,
    )
    colour = roll_half(colour)
    lum = colour.mean(axis=2)
    best, shift = -1.0, 0.0
    for frac in (0.0, 0.5):
        rolled = np.roll(grey, int(width * frac), axis=1)
        mask = (rolled > 12) & (lum > 12)
        mask[int(height * 0.7) :] = False
        score = float(np.corrcoef(rolled[mask], lum[mask])[0, 1]) if mask.sum() > 1000 else -1.0
        if score > best:
            best, shift = score, frac
    grey = np.roll(grey, int(width * shift), axis=1)
    print(f"terrain aligned at roll {shift} (correlation {best:.3f})", flush=True)
    tone = colour[lum > 12].mean(axis=0)
    painted = colour * (grey[..., None] / np.maximum(lum[..., None], 8.0))
    missing = lum < 12
    painted[missing] = grey[missing][..., None] * (tone / max(float(tone.mean()), 1.0))
    painted[grey < 4] = 0
    return np.clip(painted, 0, 255).astype(np.uint8), grey


def photo_edge(grey):
    """The row after the last photographed pixel. A dark crater does not count: the polar night is black from the edge all the way to the pole. A column with no data takes the median, so a gore does not pull the quilt up to the equator."""
    h, w = grey.shape
    data = grey >= 2
    rev = data[::-1]
    has = rev.any(axis=0)
    last = h - 1 - rev.argmax(axis=0)
    edge = np.where(has, last + 1, np.nan).astype(np.float64)
    edge[~has] = np.nanmedian(edge)
    pad = np.pad(edge, 15, mode="wrap")
    edge = np.median(np.lib.stride_tricks.sliding_window_view(pad, 31), axis=1).astype(np.float32)
    half = max(8, w // 64)
    pad = np.pad(edge, half, mode="wrap")
    low = np.lib.stride_tricks.sliding_window_view(pad, 2 * half + 1).min(axis=1).astype(np.float32)
    return edge, low


def patch_window(n):
    t = np.linspace(-np.pi, np.pi, n, dtype=np.float32)
    w = (0.5 * (1 + np.cos(t))).astype(np.float32)
    return np.outer(w, w)


def take(img, y, x, n):
    h, w = img.shape[:2]
    ys = np.arange(y, y + n)
    xs = np.arange(x, x + n) % w
    if ys.min() < 0 or ys.max() >= h:
        return None
    return img[ys][:, xs]


def source_points(img, safe, patch):
    h, w, _ = img.shape
    step = max(16, patch // 2)
    found = []
    for x in range(0, w, step):
        y = int(safe[x]) - patch - 4
        block = take(img, y, x, patch)
        if block is not None and (block.mean(axis=2) < 8).mean() < 0.05:
            found.append((y, x, (y // step, x // step)))
    for y in range(int(h * 0.12), int(h * 0.48), step):
        for x in range(0, w, step * 2):
            if y + patch >= int(safe[min(x, w - 1)]):
                continue
            block = take(img, y, x, patch)
            if block is not None and (block.mean(axis=2) < 8).mean() < 0.08:
                found.append((y, x, (y // step, x // step)))
    return found


def varied_patch(img, y, x, n, rot, scale):
    src = take(img, y, x, n)
    if src is None:
        return None
    src = np.array(src)
    if rot:
        src = np.rot90(src, int(rot))
    if abs(scale - 1) > 0.03:
        m = max(8, int(round(n * scale)))
        arr = np.array(Image.fromarray(src).resize((m, m), Image.Resampling.BILINEAR))
        if m >= n:
            o = (m - n) // 2
            src = arr[o : o + n, o : o + n]
        else:
            canvas = np.zeros((n, n, src.shape[2]), np.uint8)
            o = (n - m) // 2
            canvas[o : o + m, o : o + m] = arr
            src = canvas
    return src


def add_patch(acc, weight, src, win, y, x, wrap=False):
    h, w = weight.shape
    ph, pw = src.shape[:2]
    y1 = min(h, y + ph)
    if y1 <= y or y >= h or y < 0:
        return
    src = src[: y1 - y]
    win = win[: y1 - y]
    if not wrap:
        x1 = min(w, x + pw)
        x0 = max(x, 0)
        if x1 <= x0 or x >= w:
            return
        part = src[:, x0 - x : x0 - x + (x1 - x0)]
        part_w = win[:, x0 - x : x0 - x + (x1 - x0)]
        acc[y:y1, x0:x1] += part.astype(np.float32) * part_w[..., None]
        weight[y:y1, x0:x1] += part_w
        return
    x0 = x % w
    if x0 + pw <= w:
        acc[y:y1, x0 : x0 + pw] += src.astype(np.float32) * win[..., None]
        weight[y:y1, x0 : x0 + pw] += win
        return
    cut = w - x0
    acc[y:y1, x0:] += src[:, :cut].astype(np.float32) * win[:, :cut, None]
    weight[y:y1, x0:] += win[:, :cut]
    acc[y:y1, : pw - cut] += src[:, cut:].astype(np.float32) * win[:, cut:, None]
    weight[y:y1, : pw - cut] += win[:, cut:]


def seam_error(acc, weight, src, y, x):
    h, w = weight.shape
    n = src.shape[0]
    y1 = min(h, y + min(8, n))
    x1 = min(w, x + n)
    if y1 <= y or x1 <= x:
        return 40.0
    ww = weight[y:y1, x:x1]
    have = ww > 0.25
    if not have.any():
        return 40.0
    got = acc[y:y1, x:x1][have] / ww[have, None]
    return float(np.abs(got - src[: y1 - y, : x1 - x][have].astype(np.float32)).mean())


def quilt(img, edge, safe, rng):
    """Fill the south with many different pieces of the photographed ground."""
    h, w, _ = img.shape
    deg = w / 360.0
    patch = max(48, int(5 * deg))
    step = max(16, patch // 2)
    found = source_points(img, safe, patch)
    if len(found) < 12:
        sys.exit(f"only {len(found)} photographed patches")
    win = patch_window(patch)
    acc = np.zeros((h, w, 3), np.float32)
    weight = np.zeros((h, w), np.float32)
    photo = np.arange(h)[:, None] < safe[None, :]
    acc[photo] = img[photo]
    weight[photo] = 1
    placed = {}
    row_i = 0
    count = 0
    y = int(np.percentile(safe, 8)) - patch // 3
    while y < h - 2:
        x = int(rng.integers(0, max(1, step // 3)))
        col_i = 0
        while x < w:
            banned = {placed.get((col_i - 1, row_i)), placed.get((col_i, row_i - 1))}
            banned.discard(None)
            best_src, best_key, best_err = None, None, 1e9
            for _try in range(8):
                sy, sx, key = found[int(rng.integers(0, len(found)))]
                if key in banned:
                    continue
                src = varied_patch(img, sy, sx, patch, int(rng.integers(0, 4)), float(rng.uniform(0.9, 1.12)))
                if src is None:
                    continue
                err = seam_error(acc, weight, src, y, x)
                if err < best_err:
                    best_src, best_key, best_err = src, key, err
            if best_src is None:
                sy, sx, key = found[int(rng.integers(0, len(found)))]
                best_src = varied_patch(img, sy, sx, patch, int(rng.integers(0, 4)), 1.0)
                best_key = key
            if best_src is not None:
                add_patch(acc, weight, best_src, win, y + int(rng.integers(-4, 5)), x, wrap=True)
                placed[(col_i, row_i)] = best_key
                count += 1
            x += step
            col_i += 1
        y += step
        row_i += 1
    covered = weight > 0.15
    mixed = np.divide(acc, weight[..., None], out=np.zeros_like(acc), where=covered[..., None])
    quilted = img.copy()
    quilted[covered] = np.clip(mixed[covered], 0, 255).astype(np.uint8)
    span = max(8.0, h * 0.045)
    rows = np.arange(h)[:, None]
    t = np.clip((rows - (edge[None, :] - span)) / span, 0, 1)
    t = (t * t * (3 - 2 * t))[..., None]
    out = np.clip(img.astype(np.float32) * (1 - t) + quilted.astype(np.float32) * t, 0, 255).astype(np.uint8)
    print(f"  quilted {row_i} rows from {count} patches of {patch}px", flush=True)
    return out


def fill_holes(polar, weight, inside):
    hole = inside & (weight < 0.05)
    for _ in range(24):
        if not hole.any():
            break
        padded = np.pad(polar, ((1, 1), (1, 1), (0, 0)), mode="edge")
        ww = np.pad(weight, 1, mode="edge")
        acc = np.zeros_like(polar)
        count = np.zeros(polar.shape[:2], np.float32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy == 0 and dx == 0:
                    continue
                sl = padded[1 + dy : 1 + dy + polar.shape[0], 1 + dx : 1 + dx + polar.shape[1]]
                sw = ww[1 + dy : 1 + dy + weight.shape[0], 1 + dx : 1 + dx + weight.shape[1]]
                good = sw > 0.2
                acc[good] += sl[good]
                count[good] += 1
        use = hole & (count > 0)
        polar[use] = acc[use] / count[use, None]
        weight[use] = 1
        hole = inside & (weight < 0.05)
    if hole.any() and (weight > 0.5).any():
        polar[hole] = polar[weight > 0.5].mean(axis=0)
        weight[hole] = 1
    return polar, weight


def polar_cap(img, safe, rng):
    """The pole, made as one square picture and written onto every southern pixel."""
    h, w, _ = img.shape
    px = w / 360.0
    radius_deg = 90.0 + POLAR_BLEND + 3.0
    radius = max(16, int(round(radius_deg * px)))
    size = radius * 2 + 1
    cy = cx = radius
    yy, xx = np.mgrid[0:size, 0:size]
    dx = xx - cx
    dy = yy - cy
    rr = np.hypot(dy, dx)
    lat = -90.0 + rr / px
    lon = np.degrees(np.arctan2(dx, -dy))
    acc = np.zeros((size, size, 3), np.float32)
    weight = np.zeros((size, size), np.float32)
    ring = (lat >= POLAR_BLEND - 4) & (lat <= POLAR_BLEND + 1) & (rr <= radius)
    eq_y = np.clip(((90.0 - lat) / 180.0 * h).astype(np.int32), 0, h - 1)
    eq_x = np.mod(((lon + 180.0) / 360.0 * w).astype(np.int32), w)
    acc[ring] = img[eq_y[ring], eq_x[ring]]
    weight[ring] = 1
    patch = max(32, int(14 * px))
    found = source_points(img, safe, patch)
    if len(found) < 8:
        sys.exit(f"only {len(found)} patches for the pole")
    win = patch_window(patch)
    step = max(8, patch // 2)
    count = 0
    for y in range(0, size - patch, step):
        for x in range(0, size - patch, step):
            if rr[y + patch // 2, x + patch // 2] > radius - 2:
                continue
            best_src, best_err = None, 1e9
            for _try in range(6):
                sy, sx, _key = found[int(rng.integers(0, len(found)))]
                src = varied_patch(img, sy, sx, patch, int(rng.integers(0, 4)), float(rng.uniform(0.9, 1.12)))
                if src is None:
                    continue
                err = seam_error(acc, weight, src, y, x)
                if err < best_err:
                    best_src, best_err = src, err
            if best_src is not None:
                add_patch(acc, weight, best_src, win, y, x)
                count += 1
    inside = rr <= radius
    covered = weight > 0.05
    polar = np.divide(acc, np.maximum(weight, 1e-6)[..., None], out=np.zeros_like(acc), where=covered[..., None])
    polar, weight = fill_holes(polar, weight, inside)
    y0 = int((90.0 - (POLAR_BLEND + 1)) / 180.0 * h)
    lats = 90.0 - (np.arange(y0, h) + 0.5) / h * 180.0
    lons = np.radians((np.arange(w) + 0.5) / w * 360.0 - 180.0)
    rad = (90.0 + lats)[:, None] * px
    fy = cy - rad * np.cos(lons)[None, :]
    fx = cx + rad * np.sin(lons)[None, :]
    yf = np.clip(np.floor(fy).astype(np.int32), 0, size - 2)
    xf = np.clip(np.floor(fx).astype(np.int32), 0, size - 2)
    ty = (fy - yf)[..., None]
    tx = (fx - xf)[..., None]
    sampled = (
        polar[yf, xf] * (1 - ty) * (1 - tx)
        + polar[yf, xf + 1] * (1 - ty) * tx
        + polar[yf + 1, xf] * ty * (1 - tx)
        + polar[yf + 1, xf + 1] * ty * tx
    )
    tw = np.clip((POLAR_BLEND - lats) / (POLAR_BLEND - POLAR_FULL), 0, 1)[:, None, None]
    img = img.copy()
    img[y0:] = np.clip(img[y0:].astype(np.float32) * (1 - tw) + sampled * tw, 0, 255).astype(np.uint8)
    dark = img[y0:].mean(axis=2) < 1
    if dark.mean() > 0.002:
        rows = np.where(dark.any(axis=1))[0]
        lat_dark = lats[rows] if len(rows) else []
        print(f"  pole holes {dark.mean():.1%} at latitudes {lat_dark[:3]} .. {lat_dark[-3:] if len(lat_dark) else ''}", flush=True)
    print(f"  polar cap {size}px, {count} patches, join {POLAR_BLEND:.0f} to {POLAR_FULL:.0f}", flush=True)
    return img


def pole_view(img, n=700):
    """A disc as the globe sees the south pole, so a pinched pole shows as spokes."""
    h, w, _ = img.shape
    yy, xx = np.mgrid[0:n, 0:n]
    cy = cx = (n - 1) / 2.0
    r = np.hypot(yy - cy, xx - cx) / (n / 2.0)
    lat = -90.0 + r * 55.0
    lon = np.degrees(np.arctan2(xx - cx, -(yy - cy)))
    fy = (90.0 - lat) / 180.0 * h - 0.5
    fx = (lon + 180.0) / 360.0 * w - 0.5
    yf = np.clip(np.floor(fy).astype(np.int32), 0, h - 2)
    xf = np.clip(np.floor(fx).astype(np.int32), 0, w - 2)
    ty = (fy - yf)[..., None]
    tx = (fx - xf)[..., None]
    fx1 = (xf + 1) % w
    sampled = (
        img[yf, xf] * (1 - ty) * (1 - tx)
        + img[yf, fx1] * (1 - ty) * tx
        + img[yf + 1, xf] * ty * (1 - tx)
        + img[yf + 1, fx1] * ty * tx
    )
    sampled[r > 1] = 20
    return np.clip(sampled, 0, 255).astype(np.uint8)


def match_brightness(img, edge):
    """The generated south is brought to the brightness of the mapped ground, feathered across the edge, so it does not read as a lighter band."""
    h, w, _ = img.shape
    ref = float(img[int(h * 0.2) : int(h * 0.5)].mean())
    south = float(img[int(h * 0.85) :].mean())
    if south < 1:
        return img
    scale = float(np.clip(ref / south * 0.98, 0.75, 1.0))
    rows = np.arange(h)[:, None]
    span = h * 0.06
    t = np.clip((rows - (edge[None, :] - span)) / (span * 2), 0, 1)
    t = (t * t * (3 - 2 * t))[..., None]
    out = np.clip(img.astype(np.float32) * (1 - t + t * scale), 0, 255).astype(np.uint8)
    print(f"  south brightness x{scale:.3f}", flush=True)
    return out


def build(width):
    licence_is_public_domain()
    painted, grey = align_and_tint(width)
    edge, safe = photo_edge(grey)
    height = painted.shape[0]
    print(
        f"edge rows {edge.min():.0f} to {edge.max():.0f} of {height} "
        f"(about {90 - edge.mean() / height * 180:.0f} degrees south)",
        flush=True,
    )
    rng = np.random.default_rng(SEED)
    img = quilt(painted, edge, safe, rng)
    img = polar_cap(img, safe, rng)
    img = match_brightness(img, edge)
    south = img[int(edge.max()) + 8 :]
    if float(south.std()) < 8:
        sys.exit(f"the south is flat (std {south.std():.1f}): the quilt failed")
    return img


def write_master(img):
    os.makedirs(DROPBOX, exist_ok=True)
    path = os.path.join(DROPBOX, "pluto-south-16384.png")
    if os.path.exists(path):
        sys.exit(f"{path} already exists: not overwritten")
    Image.fromarray(img).save(path, "PNG", compress_level=3)
    digest = hashlib.sha256(open(path, "rb").read()).hexdigest()
    readme = os.path.join(DROPBOX, "README.md")
    with open(readme, "w") as f:
        f.write("\n".join([
            "# Pluto south master",
            "",
            "Equirectangular, 16384 by 8192, north at the top, longitude 0 in the middle.",
            "",
            f"- Terrain: Pluto_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif",
            f"- Terrain page: {TERRAIN_PAGE}",
            f"- Terrain file: {TERRAIN_URL}",
            f"- Terrain SHA-256: `{TERRAIN_SHA}`",
            "- Terrain credit: NASA / JHUAPL / SwRI / LPI, published by USGS Astrogeology. Public domain. 300 m per pixel, 8-bit. A pixel of 0 is no data.",
            f"- Colour: PIA11707.tif (Ralph/MVIC global colour mosaic)",
            f"- Colour page: {COLOUR_PAGE}",
            f"- Colour file: {COLOUR_URL}",
            f"- Colour SHA-256: `{COLOUR_SHA}`",
            "- Colour credit: NASA / JHUAPL / SwRI. Public domain.",
            "- The Commons JPEG is not this picture. Its licence is still checked, because NOTICE names that file.",
            "- Generator: `scripts/pluto-south.py` in wakusei-planets.",
            f"- Seed: {SEED}.",
            "- Date: 2026-11-23.",
            "- What it is: the 300 m terrain, coloured by the MVIC map, with the unphotographed south quilted from many different pieces of that photographed ground (turned by right angles, scaled a little, never the same piece beside itself). The pole is one picture in a south-polar projection, written back so it is not pinched. It is not a photograph of that ground.",
            f"- Master SHA-256: `{digest}`.",
            "",
        ]))
    print(f"master {path} ({os.path.getsize(path) // (1024 * 1024)} MB)", flush=True)
    write_webps(img)


def write_webps(img):
    out = os.path.join(ROOT, "textures")
    for w in WIDTHS:
        small = Image.fromarray(img).resize((w, w // 2), Image.Resampling.LANCZOS)
        webp = os.path.join(out, f"pluto-{w}.webp")
        small.save(webp, "WEBP", quality=82, method=6)
        print(f"  pluto-{w}.webp {os.path.getsize(webp) // 1024} KB", flush=True)


def main():
    width = MASTER_W
    if len(sys.argv) == 3 and sys.argv[1] == "--width":
        width = int(sys.argv[2])
    img = build(width)
    page = Image.fromarray(img).resize((1400, 700), Image.Resampling.LANCZOS)
    if width == MASTER_W:
        page.save("/tmp/pluto-south-page.jpg", quality=88)
        Image.fromarray(pole_view(img, 900)).save("/tmp/pluto-south-pole.jpg", quality=90)
        write_master(img)
    else:
        path = f"/tmp/pluto-south-{width}.jpg"
        page.save(path, quality=88)
        Image.fromarray(pole_view(img)).save("/tmp/pluto-south-pole.jpg", quality=90)
        print(f"preview {path}", flush=True)


if __name__ == "__main__":
    main()
