#!/usr/bin/env python3
"""Makes textures/<body>-<width>.webp, the painted looks' surface maps, from public-domain imagery on Wikimedia Commons (NASA, USGS, JPL).
Usage: python3 scripts/make-textures.py [body ...]     (needs numpy and Pillow; originals are kept in .cache/src, never in the repository)
Each source's licence is read from Commons' own metadata for the file and the script stops unless it says public domain or CC0.
Maps are equirectangular, 2:1, longitude 0 in the middle and east to the right, north at the top. A planet with no global map (Saturn, Uranus, Neptune, the Sun) is made from one
photograph by turning the visible hemisphere back onto the sphere, taking the limb darkening off, and repeating the far side from the near one (mirrored at the limb)."""
import json, os, sys, time, urllib.parse, urllib.request
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache", "src")
OUT = os.path.join(ROOT, "textures")
UA = {"User-Agent": "wakusei-planets-build/0.1 (john@johnmorris.ca)"}
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
}


def api(**p):
    p["format"] = "json"
    req = urllib.request.Request("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(p), headers=UA)
    return json.load(urllib.request.urlopen(req, timeout=30))


def licence(title):
    page = list(api(action="query", titles="File:" + title, prop="imageinfo", iiprop="extmetadata", iiextmetadatafilter="LicenseShortName|Credit")["query"]["pages"].values())[0]
    meta = page["imageinfo"][0]["extmetadata"]
    return meta.get("LicenseShortName", {}).get("value", ""), page["title"]


def fetch(body):
    title, width = SOURCES[body]
    lic, page = licence(title)
    if not (lic.lower().startswith("public domain") or lic.lower().startswith("cc0")):
        sys.exit(f"{body}: {title} is '{lic}', not public domain: not used")
    path = os.path.join(CACHE, body + ".jpg")
    if not os.path.exists(path):
        url = "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(title.replace(" ", "_")) + f"?width={width}"
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r, open(path, "wb") as f:
            f.write(r.read())
        time.sleep(2)
    print(f"{body}: {page} ({lic})")
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.float32) / 255.0


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
        # the south is in the polar night New Horizons never saw: it fades from the last real row into a dark brown
        h, w, _ = img.shape
        lum = img.mean(axis=2)
        edge = np.array([next((r for r in range(int(h * 0.5), h) if lum[r, c] < 0.04), h - 1) for c in range(w)])
        cut = int(np.percentile(edge, 15)) - 24
        blur = np.asarray(Image.fromarray((img * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(22)), dtype=np.float32) / 255.0
        last = blur[cut - 60 : cut - 10].mean(axis=(0, 1))
        fill = np.array([0.17, 0.115, 0.10], dtype=np.float32)
        rows = np.arange(h, dtype=np.float32)[:, None, None]
        t = np.clip((rows - cut) / (h * 0.16), 0, 1)
        t = t * t * (3 - 2 * t)
        img = np.where(rows >= cut, last[None, None] * (1 - t) + fill * t, img)
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
    big = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
    for w in WIDTHS:
        small = big.resize((w, w // 2), Image.LANCZOS)
        small.save(os.path.join(OUT, f"{body}-{w}.webp"), "WEBP", quality=82, method=6)
    print(f"  {body}: " + ", ".join(f"{w}={os.path.getsize(os.path.join(OUT, f'{body}-{w}.webp')) // 1024} KB" for w in WIDTHS))


for name in (sys.argv[1:] or list(SOURCES)):
    make(name)
