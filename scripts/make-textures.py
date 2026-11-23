#!/usr/bin/env python3
"""Makes textures/<body>-<width>.webp, the painted looks' surface maps, from public-domain imagery on Wikimedia Commons (NASA, USGS, JPL).
Usage: python3 scripts/make-textures.py [body ... | saturn-ring]     (needs numpy and Pillow; originals are kept in .cache/src, never in the repository)
Each source's licence is read from Commons' own metadata for the file and the script stops unless it says public domain or CC0.
Maps are equirectangular, 2:1, longitude 0 in the middle and east to the right, north at the top. A planet with no global map (Saturn, Uranus, Neptune, the Sun) is made from one
photograph by turning the visible hemisphere back onto the sphere, taking the limb darkening off, and repeating the far side from the near one (mirrored at the limb)."""
import json, os, sys, time, urllib.parse, urllib.request
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache", "src")
OUT = os.path.join(ROOT, "textures")
UA = {"User-Agent": "wakusei-planets-build/0.1 (https://github.com/johnmorrisdotca/wakusei-planets)"}
WIDTHS = [512, 1024, 2048]
os.makedirs(CACHE, exist_ok=True)
os.makedirs(OUT, exist_ok=True)

SOURCES = {
    "mercury": ("Mercury MESSENGER MDIS Basemap EnhancedColor Mosaic Global 32ppd.jpg", 4096),
    "venus": ("Cylindrical Map of Venus.jpg", 4096),
    "mars": ("Mars Viking MDIM21 ClrMosaic 1km.jpg", 4096),
    "jupiter": ("Jupiter Cylindrical Map - Dec 2000 PIA07782.jpg", 3601),
    "saturn": ("Saturn during Equinox.jpg", 4613),
    "uranus": ("Uranus as seen by NASA's Voyager 2.tif", 1720),
    "neptune": ("Neptune Full (original).jpg", 2188),
    "pluto": ("Pluto color mapmosaic.jpg", 4096),
    "sun": ("SDO 20240810 000000 4096 HMIIC (HMI).jpg", 2048),
    "moon": ("CGI Moon Kit - Lroc color poles.tif", 4096),
    "io": ("Io from Galileo and Voyager missions.jpg", 4096),
    "europa": ("Europa Voyager GalileoSSI global mosaic.jpg", 1024),
    "ganymede": ("Ganymede equatorial.jpg", 3126),
    "callisto": ("Callisto equatorial.jpg", 4096),
    "titan": ("Titan map April 2011 full.png", 4046),
    "rhea": ("Rhea Color Map.jpg", 4096),
    "enceladus": ("Enceladus Color Map.jpg", 4096),
    "mimas": ("Map of Mimas 2010-02 PIA12780.jpg", 3840),
    "ceres": ("PIA20354-Ceres-DwarfPlanet-MercatorMap-HAMO-20160322-0DegreeLongitude.jpg", 4000),
    "vesta": ("Vesta map for GeoHack.png", 3561),
    "tethys": ("Tethys Color Map.jpg", 4096),
    "dione": ("Dione Color Map.jpg", 4096),
    "iapetus": ("Iapetus Color Map.jpg", 4096),
    "triton": ("Triton map no grid.jpg", 4096),
    "charon": ("Charon map iau1803c.jpg", 4096),
    "saturn-ring": ("Saturn's rings in visible light and radio.jpg", 3840),
}
# A source with less than 2048 pixels across is not made at 2048.
MAX_WIDTH = {"europa": 1024}
# Pictures full of fine detail get a lower WebP quality, to keep the package small.
QUALITY = {"vesta": 70, "rhea": 68, "enceladus": 68, "mimas": 74, "callisto": 74, "ceres": 72, "tethys": 62, "dione": 62, "iapetus": 64}
META = os.path.join(OUT, "SOURCES.json")
# Commons names no author for this file: the images are Galileo SSI and Voyager's, NASA and JPL's, and Commons marks the file public domain.
CREDIT_FALLBACK = {"io": "NASA / JPL (Galileo SSI and Voyager images); the file page names no author"}


def api(**p):
    p["format"] = "json"
    req = urllib.request.Request("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(p), headers=UA)
    return json.load(urllib.request.urlopen(req, timeout=30))


def licence(title):
    page = list(api(action="query", titles="File:" + title, prop="imageinfo", iiprop="extmetadata", iiextmetadatafilter="LicenseShortName|Credit|Artist|UsageTerms")["query"]["pages"].values())[0]
    meta = page["imageinfo"][0]["extmetadata"]
    return meta.get("LicenseShortName", {}).get("value", ""), page["title"], meta


def strip_tags(text):
    import re
    return re.sub(r"<[^>]+>", "", text).strip()


def fetch(body):
    title, width = SOURCES[body]
    lic, page, meta = licence(title)
    if not (lic.lower().startswith("public domain") or lic.lower().startswith("cc0")):
        sys.exit(f"{body}: {title} is '{lic}', not public domain: not used")
    path = os.path.join(CACHE, body + ".jpg")
    if not os.path.exists(path):
        url = "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(title.replace(" ", "_")) + f"?width={width}"
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r, open(path, "wb") as f:
            f.write(r.read())
        time.sleep(2)
    print(f"{body}: {page} ({lic})")
    record(body, {
        "file": title,
        "page": "https://commons.wikimedia.org/wiki/" + page.replace(" ", "_"),
        "licence": lic,
        "credit": strip_tags(meta.get("Credit", {}).get("value", "")) or CREDIT_FALLBACK.get(body, ""),
        "artist": strip_tags(meta.get("Artist", {}).get("value", "")) or CREDIT_FALLBACK.get(body, ""),
        "usage": meta.get("UsageTerms", {}).get("value", lic),
    })
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.float32) / 255.0


def record(body, entry):
    """textures/SOURCES.json: the file page, licence and credit of each source, as Commons gave them."""
    data = json.load(open(META)) if os.path.exists(META) else {}
    data[body] = entry
    with open(META, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def fill_black_rows(img, trim=0.07):
    """The poles a mosaic has no data for, or only noise: the outer rows repeat the first row with real data."""
    h = img.shape[0]
    empty = (img.mean(axis=2) < 0.06).mean(axis=1) > 0.6
    good = np.where(~empty)[0]
    top = max(good[0], int(h * trim))
    bottom = min(good[-1], h - 1 - int(h * trim))
    out = img.copy()

    def row(i, step):
        r = img[i : i + 24 * step : step] if step > 0 else img[i + 24 * step + 1 : i + 1]
        r = r.mean(axis=0)
        k = np.ones(31) / 31
        return np.stack([np.convolve(np.pad(r[:, c], 15, mode="wrap"), k, mode="valid") for c in range(3)], axis=1)

    out[:top] = row(top, 1)
    out[bottom + 1:] = row(bottom, -1)
    return out


def desaturate(img, keep):
    grey = img.mean(axis=2, keepdims=True)
    return np.clip(grey + (img - grey) * keep, 0, 1)


def roll(img, fraction):
    return np.roll(img, int(round(fraction * img.shape[1])), axis=1)


def sample(img, px, py):
    h, w, _ = img.shape
    x0 = np.clip(np.floor(px).astype(int), 0, w - 2)
    y0 = np.clip(np.floor(py).astype(int), 0, h - 2)
    fx = np.clip(px - x0, 0, 1)[..., None]
    fy = np.clip(py - y0, 0, 1)[..., None]
    return (img[y0, x0] * (1 - fx) * (1 - fy) + img[y0, x0 + 1] * fx * (1 - fy) + img[y0 + 1, x0] * (1 - fx) * fy + img[y0 + 1, x0 + 1] * fx * fy)


def disc_of(img, threshold=0.06):
    """The centre and radius of the bright disc: the columns and rows that hold a real run of bright pixels (not a speck of noise or a ring's tip)."""
    lum = img.mean(axis=2)
    mask = lum > threshold
    h, w = mask.shape
    cols = np.where(mask.sum(axis=0) > h * 0.02)[0]
    rows = np.where(mask.sum(axis=1) > w * 0.02)[0]
    return (cols.min() + cols.max()) / 2, (rows.min() + rows.max()) / 2, ((cols.max() - cols.min()) + (rows.max() - rows.min())) / 4


def unproject(img, cx, cy, radius, b0, lon0, width=4096, dark=(0.35, 0.7), shrink=0.985):
    """The visible hemisphere of a photographed disc, as an equirectangular map."""
    h = width // 2
    lon = (np.arange(width) + 0.5) / width * 360 - 180
    lat = 90 - (np.arange(h) + 0.5) / h * 180
    LON, LAT = np.meshgrid(lon, lat)
    b = np.radians(b0)
    la = np.radians(LAT)

    def look(delta):
        d = np.radians(delta)
        mu = np.sin(b) * np.sin(la) + np.cos(b) * np.cos(la) * np.cos(d)
        x = np.cos(la) * np.sin(d)
        y = np.cos(b) * np.sin(la) - np.sin(b) * np.cos(la) * np.cos(d)
        px = cx + x * radius * shrink
        py = cy - y * radius * shrink
        colour = sample(img, px, py)
        a, p = dark
        colour = colour / (a + (1 - a) * np.clip(mu, 0.12, 1)[..., None] ** p)
        return colour, mu

    delta = (LON - lon0 + 180) % 360 - 180
    near, mu = look(delta)
    mirrored, _ = look(np.sign(delta) * (180 - np.abs(delta)))
    weight = np.clip((mu - 0.12) / 0.4, 0, 1)[..., None]
    return np.clip(near * weight + mirrored * (1 - weight), 0, 1)


def profile_map(img, lon0, window):
    """A map that is the same at every longitude: each latitude's median colour over the longitudes `window` degrees either side of `lon0`, where the photograph is best."""
    w = img.shape[1]
    lon = (np.arange(w) + 0.5) / w * 360 - 180
    near = np.abs((lon - lon0 + 180) % 360 - 180) <= window
    row = np.median(img[:, near], axis=1)
    k = np.ones(5) / 5
    row = np.stack([np.convolve(np.pad(row[:, c], 2, mode="edge"), k, mode="valid") for c in range(3)], axis=1)
    return np.repeat(row[:, None, :], w, axis=1)


def patch(base, detail, lon, lat, rx, ry):
    """Real detail from `detail` laid over `base` inside a soft oval (degrees)."""
    h, w, _ = base.shape
    LON = ((np.arange(w) + 0.5) / w * 360 - 180)[None, :]
    LAT = (90 - (np.arange(h) + 0.5) / h * 180)[:, None]
    d = np.sqrt(((LON - lon) / rx) ** 2 + ((LAT - lat) / ry) ** 2)
    m = np.clip((1.0 - d) / 0.35, 0, 1)[..., None]
    return base * (1 - m) + detail * m


def highpass(img, radius_px, mean):
    blur = np.asarray(Image.fromarray((img * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius_px)), dtype=np.float32) / 255.0
    return np.clip(mean + (img - blur), 0, 1)


def smooth_rows(img, lo, hi, amount=1):
    """Take a thin line out (a ring crossing a disc): rows between lo and hi (fractions of the height) are blended from their neighbours."""
    h = img.shape[0]
    a, b = int(lo * h), int(hi * h)
    out = img.copy()
    for i in range(a, b + 1):
        t = (i - a) / max(1, b - a)
        out[i] = img[a - 1] * (1 - t) + img[b + 1] * t
    return out


def extend_poles(img, top, bottom, window=24):
    """Rows above `top` and below `bottom` (the poles a strip does not reach): from the nearest rows that hold data, blurred a long way along the row, they fade to that band's one mean colour at the pole."""
    out = img.copy()
    w = img.shape[1]
    k = np.ones(w // 10) / (w // 10)

    def fill(edge_a, edge_b, rows):
        r = img[edge_a:edge_b].mean(axis=0)
        blur = np.stack([np.convolve(np.pad(r[:, c], w // 20, mode="wrap"), k, mode="valid")[:w] for c in range(3)], axis=1)
        mean = r.mean(axis=0)
        n = len(rows)
        for j, i in enumerate(rows):
            t = (j + 1) / n
            t = t * t * (3 - 2 * t)
            out[i] = blur * (1 - t) + mean * t

    fill(top, top + window, range(top - 1, -1, -1))
    fill(bottom - window + 1, bottom + 1, range(bottom + 1, img.shape[0]))
    # the last rows of real data fade into the fill, so the edge is not a line on the sphere
    feather = max(8, img.shape[0] // 20)
    for j in range(feather):
        t = j / feather
        t = t * t * (3 - 2 * t)
        out[top + j] = out[top - 1] * (1 - t) + img[top + j] * t
        out[bottom - j] = out[bottom + 1] * (1 - t) + img[bottom - j] * t if bottom + 1 < img.shape[0] else out[bottom - j]
    return out


def mercator_to_equirect(strip, lat_max, width):
    """A Mercator strip (one turn round, +- lat_max degrees) as an equirectangular map `width` across and half as high; the poles it does not reach repeat its last rows."""
    h, w, _ = strip.shape
    scale = width / w
    resized = np.asarray(Image.fromarray((strip * 255).astype(np.uint8)).resize((width, max(2, round(h * scale))), Image.LANCZOS), dtype=np.float32) / 255.0
    rh = resized.shape[0]
    merc = lambda lat: np.log(np.tan(np.pi / 4 + np.radians(lat) / 2))
    ymax = merc(lat_max)
    out_h = width // 2
    lat = 90 - (np.arange(out_h) + 0.5) / out_h * 180
    inside = np.abs(lat) <= lat_max
    src = np.zeros(out_h)
    src[inside] = (ymax - merc(lat[inside])) / (2 * ymax) * rh - 0.5
    src = np.clip(src, 0, rh - 1.001)
    y0 = np.floor(src).astype(int)
    f = (src - y0)[:, None, None]
    out = resized[y0] * (1 - f) + resized[y0 + 1] * f
    first, last = np.where(inside)[0][[0, -1]]
    return extend_poles(out, first, last)


def lat_strip_to_equirect(strip, lat_max, width):
    """A strip of an equirectangular map that covers +- lat_max degrees, as the whole map `width` across."""
    h, w, _ = strip.shape
    resized = np.asarray(Image.fromarray((strip * 255).astype(np.uint8)).resize((width, round(width * (2 * lat_max / 360))), Image.LANCZOS), dtype=np.float32) / 255.0
    out_h = width // 2
    pad = (out_h - resized.shape[0]) // 2
    out = np.zeros((out_h, width, 3), dtype=np.float32)
    out[pad : pad + resized.shape[0]] = resized
    return extend_poles(out, pad, pad + resized.shape[0] - 1)


def fill_unseen(img, side, margin=8, fade=0.2, depth=4, calm=0.0, feather=24, along=12):
    """A map with a black region where nothing was imaged (the polar night): `side` is `north` (black above) or `south` (black below). Each column keeps its real rows; above (or below) the first of them it
    continues with the colour just inside the edge, blurred a long way along the row, and fades to the picture's mean colour away from it. `calm` (0 to 1) takes that colour part of the way to the mean first, so dark ground at the edge does not smear into the fill, `feather` is how many rows the real picture takes to melt into it, and the colour at the edge is averaged over 1/`along` of the way round the body (a small number smooths it more)."""
    work = img if side == "north" else img[::-1]
    h, w, _ = work.shape
    real = work.mean(axis=2) > 0.05
    edge = np.array([next((r for r in range(h - 12) if real[r : r + 12, c].all()), h - 1) for c in range(w)])
    pad = np.pad(edge, 20, mode="wrap")
    edge = np.median(np.lib.stride_tricks.sliding_window_view(pad, 41), axis=1).astype(int) + margin
    mean = np.median(work[real], axis=0)
    band = np.stack([work[min(e + depth, h - 31) : min(e + depth + 26, h - 1), c].mean(axis=0) for c, e in enumerate(edge)])
    n = w // along
    k = np.ones(n) / n
    band = np.stack([np.convolve(np.pad(band[:, c], n // 2, mode="wrap"), k, mode="valid")[:w] for c in range(3)], axis=1)
    band = band * (1 - calm) + mean * calm
    out = work.copy()
    rows = np.arange(h)[:, None]
    above = rows < edge[None, :]
    t = np.clip((edge[None, :] - rows) / (h * fade), 0, 1)
    t = (t * t * (3 - 2 * t))[..., None]
    out = np.where(above[..., None], band[None] * (1 - t) + mean * t, out)
    for j in range(feather):
        f = j / feather
        f = f * f * (3 - 2 * f)
        r = edge + j
        ok = r < h
        out[r[ok], np.arange(w)[ok]] = band[ok] * (1 - f) + work[r[ok], np.arange(w)[ok]] * f
    return out if side == "north" else out[::-1]


def tint(img, dark, light, contrast):
    """A grey map as colour: its brightness picks a colour between `dark` and `light`, with the contrast turned down toward the middle."""
    g = img.mean(axis=2, keepdims=True)
    mid = np.median(g)
    g = np.clip(mid + (g - mid) * contrast, 0, 1)
    return np.asarray(dark, dtype=np.float32) * (1 - g) + np.asarray(light, dtype=np.float32) * g


def gblur(a, sigma):
    """A Gaussian blur by the Fourier transform: wrapped round the map's width (longitude is a circle) and mirrored at the top and bottom."""
    h = a.shape[0]
    pad = int(min(h // 2, 4 * sigma))
    b = np.concatenate([a[:pad][::-1], a, a[-pad:][::-1]], axis=0) if pad > 0 else a
    fy = np.fft.fftfreq(b.shape[0])[:, None]
    fx = np.fft.rfftfreq(b.shape[1])[None, :]
    k = np.exp(-2 * (np.pi * sigma) ** 2 * (fx ** 2 + fy ** 2))
    out = np.fft.irfft2(np.fft.rfft2(b, axes=(0, 1)) * k, s=b.shape, axes=(0, 1))
    return (out[pad : pad + h] if pad > 0 else out).astype(np.float32)


def _hash3(ix, iy, iz, seed):
    # a lattice point below zero is turned to a whole number first: a negative float turned straight to an unsigned one is not defined, and turned every point below zero into the same one
    ix, iy, iz = (np.asarray(v).astype(np.int64).astype(np.uint32) for v in (ix, iy, iz))
    n = (ix * np.uint32(73856093)) ^ (iy * np.uint32(19349663)) ^ (iz * np.uint32(83492791)) ^ np.uint32(seed * 2654435761 % 2**32)
    n ^= n >> np.uint32(13)
    n *= np.uint32(0x5BD1E995)
    n ^= n >> np.uint32(15)
    return (n & np.uint32(0xFFFFFF)).astype(np.float32) / np.float32(0xFFFFFF)


def noise3(x, y, z, seed):
    """Smooth value noise in three dimensions, 0 to 1. Noise of a point on a sphere has no seam and no pinching at the poles."""
    ix, iy, iz = np.floor(x), np.floor(y), np.floor(z)
    fx, fy, fz = x - ix, y - iy, z - iz
    fx, fy, fz = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy), fz * fz * (3 - 2 * fz)
    out = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                v = _hash3(ix + dx, iy + dy, iz + dz, seed)
                out = out + v * (fx if dx else 1 - fx) * (fy if dy else 1 - fy) * (fz if dz else 1 - fz)
    return out


def sphere_fbm(h0, h1, w, seed, base, octaves, warp=0.35, gain=0.55):
    """Fractal noise on the sphere for rows h0 to h1 of an equirectangular map h rows tall (h = w / 2): `base` is the lowest frequency, in cycles round the sphere. The point is moved by a noise of its own first, which turns blobs into flowing, ragged shapes."""
    h = w // 2
    lat = (0.5 - (np.arange(h0, h1) + 0.5) / h) * np.pi
    lon = ((np.arange(w) + 0.5) / w - 0.5) * 2 * np.pi
    cl = np.cos(lat)[:, None]
    x = (cl * np.cos(lon)[None, :]).astype(np.float32)
    y = (cl * np.sin(lon)[None, :]).astype(np.float32)
    z = np.broadcast_to(np.sin(lat)[:, None], x.shape).astype(np.float32)
    if warp:
        f = base * 0.8
        x, y, z = (x + warp * (noise3(x * f + 5, y * f, z * f, seed + 11) - 0.5), y + warp * (noise3(x * f, y * f + 7, z * f, seed + 12) - 0.5), z + warp * (noise3(x * f, y * f, z * f + 9, seed + 13) - 0.5))
    total, amp, norm, f = 0, 1.0, 0.0, base
    for o in range(octaves):
        total = total + amp * noise3(x * f, y * f, z * f, seed + o)
        norm += amp
        amp *= gain
        f *= 2.03
    return (total / norm).astype(np.float32)


def craters(rows, w, top, seed, density=0.0007, rmin=2.5, rmax=26.0):
    """The height of ground pocked with craters, for rows `top` to `rows` of a map `w` wide: bowls with raised rims, many small and a few large (the number larger than a radius goes as one over its square, as a surface of one age does). A crater is as wide in pixels across a circle of latitude as it is tall, so it is stretched by one over the cosine of its latitude."""
    rng = np.random.default_rng(seed)
    h = w // 2
    height = np.zeros((rows - top, w), dtype=np.float32)
    lat_of = lambda y: (0.5 - (y + 0.5) / h) * np.pi
    area = float(((rows - top) * w) * np.mean(np.cos(lat_of(np.arange(top, rows)))))
    count = int(density * area * (4.0 / rmin) ** 2 * 0.1) + 1
    radii = np.minimum(rmax, rmin / np.sqrt(rng.random(count)))
    cy = rng.integers(top, rows, count)
    cx = rng.integers(0, w, count)
    for r, y, x in zip(radii, cy, cx):
        cos = max(0.08, np.cos(lat_of(y)))
        rx = r / cos
        reach = 2.1
        y0, y1 = int(max(top, y - reach * r)), int(min(rows, y + reach * r + 1))
        xs = np.arange(int(x - min(reach * rx, w / 2)), int(x + min(reach * rx, w / 2)) + 1)
        yy = np.arange(y0, y1)
        q = np.hypot(((xs[None, :] - x) * cos) / r, (yy[:, None] - y) / r)
        bowl = np.where(q < 1, -(1 - q * q), 0.0) * 0.55
        rim = 0.28 * np.exp(-(((q - 1.0) / 0.2) ** 2))
        height[y0 - top : y1 - top][:, xs % w] += (r * (bowl + rim)).astype(np.float32)
    return height


def generate_unseen(img, seed=1798, reach=0.14):
    """The south of Pluto that New Horizons never saw (the black rows of its mosaic, in the polar night), made up and made to belong. The new ground is fractal noise on the sphere (no seam at the date line, none squeezed at the pole) read through the colours of the
    mapped band just north of the edge, in the same shares (as dark, as red and as bright in as many places), with craters and a fine grain of the same strength as the mapped ground's laid over it, lit from the upper left as the mapped craters are. Its broad colours
    are nudged by a slowly changing offset until they meet the mapped colours at the edge, and it is faded in over the last few degrees of the photographs by a soft mask that follows their ragged edge, so no line shows where they end and no detail is stretched
    across the join. Nothing is copied: no crater or ridge of the mapped half is found twice."""
    h, w, _ = img.shape
    lum = img.mean(axis=2)
    black = (lum < 0.04).astype(np.int32)
    run = np.stack([black[r : r + 12].sum(axis=0) for r in range(h - 12)])
    edge = np.array([next((r for r in range(h // 2, h - 12) if run[r, c] == 12), h - 12) for c in range(w)], dtype=np.float32)
    pad = np.pad(edge, 15, mode="wrap")
    edge = np.median(np.lib.stride_tricks.sliding_window_view(pad, 31), axis=1)
    half = w // 64
    pad = np.pad(edge, half, mode="wrap")
    edge = np.lib.stride_tricks.sliding_window_view(pad, 2 * half + 1).min(axis=1)
    # the photographs fade towards their edge: the last stretch is not trusted, and the mapped ground used is what lies above it
    edge = (gblur(edge[None, :].repeat(3, 0), w * 0.004)[1] - w * 0.012).astype(np.float32)
    rows = np.arange(h, dtype=np.float32)[:, None]
    valid = (rows < edge[None, :]).astype(np.float32)
    # 1. the colours the new ground is read through: the mapped band above the edge, smoothed so grain is not read as colour, from darkest to brightest in 256 steps of equal share
    soft = np.stack([gblur(img[..., c], 5) for c in range(3)], axis=-1)
    band = (rows >= edge[None, :] - h * 0.22) & (rows < edge[None, :] - h * 0.02) & (lum > 0.04)
    order = np.argsort(soft.mean(axis=2)[band])
    colours = np.stack([soft[..., c][band][order] for c in range(3)], axis=1)
    lut = np.stack([colours[i * len(colours) // 256 : (i + 1) * len(colours) // 256].mean(axis=0) for i in range(256)])
    # 2. the new ground: its broad colours, for the rows from a little above the edge (it is faded in over the last of the photographs) to the pole
    blend = h * 0.045
    top = max(0, int(edge.min() - blend - h * 0.03))
    n = sphere_fbm(top, h, w, seed, base=2.4, octaves=7, warp=0.45, gain=0.62)
    rank = np.empty(n.size, dtype=np.float32)
    rank[np.argsort(n, axis=None)] = np.linspace(0, 1, n.size, dtype=np.float32)
    broad = lut[np.minimum(255, (rank.reshape(n.shape) * 256).astype(int))].astype(np.float32)
    low = np.stack([gblur(broad[..., c], 10) for c in range(3)], axis=-1)
    # the broad colours are nudged, a little at a time and by an amount that changes slowly along the edge, until they meet the mapped colours there: an offset with no detail in it, so nothing is stretched
    columns = np.arange(w)
    def mean_rows(a, lo, hi):
        return np.stack([a[max(0, int(e + lo)) : max(1, int(e + hi)), x].mean(axis=0) for x, e in zip(columns, edge)])
    real_edge = mean_rows(soft, -h * 0.06, -h * 0.02)
    new_edge = mean_rows(np.concatenate([np.zeros((top, w, 3), dtype=np.float32), low]), h * 0.0, h * 0.03)
    offset = np.stack([gblur(np.repeat((real_edge - new_edge)[None, :, c], 3, axis=0), w * 0.02)[1] for c in range(3)], axis=-1)
    # 3. the new ground's detail: craters and ridged grain, lit from the upper left, as a brightness that is multiplied in; its strength is that of the mapped ground where the photographs are sharp (the equatorial band)
    relief = craters(h, w, top, seed + 1) + 6.0 * sphere_fbm(top, h, w, seed + 2, base=70.0, octaves=3, warp=0, gain=0.5)
    gy, gx = np.gradient(relief)
    shade = np.clip(-(gx * 0.7 + gy * 0.7), -4, 4)
    grain = (sphere_fbm(top, h, w, seed + 3, base=160.0, octaves=3, warp=0, gain=0.6) - 0.5) * 2
    detail = shade / max(shade.std(), 1e-4) * 0.7 + grain / max(grain.std(), 1e-4) * 0.45
    sharp = (rows >= h * 0.28) & (rows < h * 0.42) & (valid > 0)
    mapped = np.stack([img[..., c] - gblur(img[..., c], 4) for c in range(3)], axis=-1).mean(axis=2)
    strength = float(mapped[sharp].std() / max(soft.mean(axis=2)[sharp].mean(), 1e-3))
    detail = detail / max(detail.std(), 1e-4) * strength
    # 4. the join: the new ground, detail and all, faded in over the last few degrees of the photographs by a soft mask that follows their ragged edge (it wanders), so no detail is ever stretched; the offset that meets the colours dies away over `reach` of the height south of it
    wob = (sphere_fbm(top, h, w, seed + 100, base=7.0, octaves=4, warp=0) - 0.5) * 2 * h * 0.03
    dd = rows[top:] - edge[None, :] + wob
    t = np.clip(dd / (h * reach), 0, 1)
    meet = (1 - t * t * (3 - 2 * t))[..., None]
    base = low + offset[None, :, :] * meet
    south = base * (1 + detail[..., None]) + detail[..., None] * 0.035
    feather = w * 0.006
    a = np.clip((dd + blend) / (blend + feather), 0, 1)
    a = (a * a * (3 - 2 * a))[..., None]
    out = img.copy()
    out[top:] = img[top:] * (1 - a) + south * a
    return np.clip(out, 0, 1)

def make(body):
    img = fetch(body)
    if body == "mercury":
        img = fill_black_rows(img)
        img = np.clip(desaturate(img, 0.12) * 1.22, 0, 1)
    elif body == "venus":
        img = roll(fill_black_rows(img), 0.169)
    elif body == "mars":
        img = fill_black_rows(img)
    elif body == "jupiter":
        pass
    elif body == "pluto":
        img = roll(img, 0.5)
        img = generate_unseen(img)
    elif body == "saturn":
        cx, cy, r = disc_of(img, 0.09)
        r = ((img.mean(axis=2) > 0.09).sum(axis=1) > img.shape[1] * 0.02).nonzero()[0]
        r = (r.max() - r.min()) / 2
        img = smooth_rows(profile_map(unproject(img, cx, cy, r, 0, 0), 0, 40), 0.47, 0.53)
    elif body == "uranus":
        cx, cy, r = disc_of(img, 0.12)
        seen = unproject(img, cx, cy, r, -82, 0, dark=(0.45, 0.5))
        h = seen.shape[0]
        base = np.median(seen[int(h * 0.6) :, :].reshape(-1, 3), axis=0)
        lat = (90 - (np.arange(h) + 0.5) / h * 180)
        img = np.repeat((base[None, :] * (1 - 0.035 * np.sin(np.radians(lat)))[:, None])[:, None, :], seen.shape[1], axis=1)
    elif body == "neptune":
        cx, cy, r = disc_of(img, 0.07)
        seen = unproject(img, cx, cy, r, -30, -10.5, dark=(0.3, 0.7))
        img = patch(profile_map(seen, -10.5, 30), seen, -30, -24, 24, 16)
    elif body == "sun":
        cx, cy, r = disc_of(img[:3700], 0.2)
        seen = unproject(img[:3700], cx, cy, r, 0, 0, dark=(0.55, 0.6), shrink=0.97)
        centre = np.median(seen[:, 1800:2300].reshape(-1, 3), axis=0)
        img = highpass(seen, 40, centre)
    elif body == "moon":
        pass
    elif body == "io":
        img = roll(lat_strip_to_equirect(img[:, 3:-3], 57.3, 4096), 0.5)
    elif body == "europa":
        img = extend_poles(img, 8, int(img.shape[0] * 0.9))
    elif body in ("ganymede", "callisto"):
        img = mercator_to_equirect(img, 57.0, 4096)
    elif body == "titan":
        img = tint(roll(img, 0.5), (0.20, 0.11, 0.04), (0.92, 0.62, 0.28), 0.35)
    elif body in ("rhea", "enceladus"):
        img = desaturate(roll(img, 0.5), 0.3 if body == "enceladus" else 0.55)
    elif body == "ceres":
        # the green and yellow of the map are where Dawn's colour coverage is incomplete (the map says so): they become the grey the rest of the surface is, keeping the picture's detail
        lum = img.mean(axis=2, keepdims=True)
        sat = (img.max(axis=2) - img.min(axis=2))[..., None]
        calm = sat < 0.1
        tone = (img * calm).sum(axis=(0, 1)) / np.maximum(1, (lum * calm).sum(axis=(0, 1)))
        wrong = np.clip((sat - 0.12) / 0.14, 0, 1)
        img = img * (1 - wrong) + lum * tone * wrong
        img = extend_poles(img, int(img.shape[0] * 0.02), int(img.shape[0] * 0.93))
        img = desaturate(img, 0.6)
    elif body == "vesta":
        # Dawn's grey photomap runs from 330 degrees (its left edge) to 330 degrees: longitude 0 is a twelfth in, so it is rolled to the middle; the grey is given the faint warmth of Vesta's surface (a V-type asteroid)
        img = tint(roll(img, 5 / 12), (0.05, 0.047, 0.042), (0.93, 0.90, 0.83), 1.0)
    elif body in ("tethys", "dione"):
        img = desaturate(roll(img, 0.5), 0.55)
    elif body == "iapetus":
        img = desaturate(roll(img, 0.5), 0.7)
    elif body == "triton":
        img = desaturate(fill_unseen(img, "north", margin=30, fade=0.28, depth=60, calm=0.3, feather=110, along=3), 0.45)
    elif body == "charon":
        img = fill_unseen(img, "south", margin=12, fade=0.1, depth=40)
    elif body == "mimas":
        # the map inside its frame: the gap between the frame and the map is black, and a wider box left a black strip of 22 columns at the seam (a dark band pole to pole on the globe)
        img = img[183:1926, 226:3718]
    big = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
    for w in [x for x in WIDTHS if x <= MAX_WIDTH.get(body, 2048)]:
        small = big.resize((w, w // 2), Image.LANCZOS)
        small.save(os.path.join(OUT, f"{body}-{w}.webp"), "WEBP", quality=QUALITY.get(body, 82), method=6)
    print(f"  {body}: " + ", ".join(f"{w}={os.path.getsize(os.path.join(OUT, f'{body}-{w}.webp')) // 1024} KB" for w in WIDTHS if w <= MAX_WIDTH.get(body, 2048)))


# Saturn's rings: Cassini's natural-colour mosaic of the lit side (PIA07874, PIA06175) is a picture of the rings along one radius, the planet far to the left. Along the line it is
# made from, a column is a radius: r = RING_FROM_KM + RING_KM_PER_PX * column, fitted to five edges the picture shows (the B ring's inner edge, the Cassini Division's two, the
# Encke gap and the A ring's outer edge; every one within 300 km). The strip keeps the picture's colour and takes its opacity from its brightness, so over black space it is the photograph.
RING_FROM_KM, RING_KM_PER_PX, RING_COLUMNS, RING_WIDTH = 74794.0, 16.4267, 3789, 2048


def make_ring():
    img = fetch("saturn-ring")
    photo = img[262:284, :RING_COLUMNS].mean(axis=0)
    blocks = np.array_split(np.arange(RING_COLUMNS), RING_WIDTH)
    strip = np.stack([photo[b].mean(axis=0) for b in blocks])
    lum = strip.mean(axis=1)
    alpha = np.clip(lum * 1.1, 0.0, 1.0)
    colour = strip / np.maximum(alpha, 0.04)[:, None]
    # white balance: the mosaic is pinker and bluer than Cassini's natural-colour portrait of Saturn that the planet's map is made from; the B ring's blue to green falls from 0.98 to 0.86
    colour = np.clip(colour * np.array([0.98, 1.0, 0.88]), 0.0, 1.0)
    rgba = np.concatenate([colour, alpha[:, None]], axis=1)
    out = Image.fromarray((rgba * 255 + 0.5).astype(np.uint8)[None, :, :], "RGBA")
    path = os.path.join(OUT, f"saturn-ring-{RING_WIDTH}.webp")
    out.save(path, "WEBP", lossless=True, method=6)
    print(f"  saturn-ring: {RING_WIDTH} samples, {RING_FROM_KM:.0f} to {RING_FROM_KM + RING_KM_PER_PX * RING_COLUMNS:.0f} km, {os.path.getsize(path)} bytes")


for name in (sys.argv[1:] or list(SOURCES)):
    make_ring() if name == "saturn-ring" else make(name)
