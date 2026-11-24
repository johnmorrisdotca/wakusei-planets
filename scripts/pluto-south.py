#!/usr/bin/env python3
"""Quilt Pluto's unphotographed south from the New Horizons mosaic.

The south was in polar night, so the mosaic is black there. This fills it with real patches of the photographed ground just north of that ragged edge, at the mosaic's own ground scale, blended across the edge. The last stretch to the pole is quilted in a south-polar projection, so the pole is not pinched, then written back to the equirectangular map. No drawn noise and no image service.

Seed 17981123. Source: the full "Pluto color mapmosaic.jpg" on Wikimedia Commons (public domain, NASA / JHUAPL / SwRI), the file NOTICE.md names, checked by SHA-256 before use.

The master is kept out of the repository:

  ~/Library/CloudStorage/Dropbox/Projects/Handoff/3d-assets/wakusei/pluto/pluto-south-16384.png

Run: python3 scripts/pluto-south.py
     python3 scripts/pluto-south.py --width 2048     (a small preview in /tmp, no master)
"""
import hashlib, json, os, sys, urllib.parse, urllib.request
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

SEED = 17981123
MASTER_W = 16384
WIDTHS = (512, 1024, 2048)
SOURCE_TITLE = "Pluto color mapmosaic.jpg"
SOURCE_URL = "https://upload.wikimedia.org/wikipedia/commons/a/ad/Pluto_color_mapmosaic.jpg"
SOURCE_SHA = "d63da5ee9eab8d0b98ebef3c0cdc3a92676d7c9b247b2383294fb5da5c67a71a"
POLAR_FROM = 55.0  # degrees south: the cap is quilted in a polar projection
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache", "src", "pluto-full.jpg")
DROPBOX = os.path.expanduser("~/Library/CloudStorage/Dropbox/Projects/Handoff/3d-assets/wakusei/pluto")
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
    print(f"source licence: {lic}")


def source_image():
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    if not os.path.exists(CACHE):
        print("downloading the New Horizons mosaic")
        with urllib.request.urlopen(urllib.request.Request(SOURCE_URL, headers=UA), timeout=180) as r:
            data = r.read()
        digest = hashlib.sha256(data).hexdigest()
        if digest != SOURCE_SHA:
            sys.exit(f"SHA-256 {digest} is not the file NOTICE.md names")
        with open(CACHE, "wb") as f:
            f.write(data)
    else:
        digest = hashlib.sha256(open(CACHE, "rb").read()).hexdigest()
        if digest != SOURCE_SHA:
            sys.exit(f"cached mosaic SHA-256 {digest} is not the file NOTICE.md names")
    return np.asarray(Image.open(CACHE).convert("RGB"))


def roll_half(img):
    w = img.shape[1]
    return np.concatenate([img[:, w // 2 :], img[:, : w // 2]], axis=1)


def photo_edge(img):
    """The first row, in the south, from which the mosaic is black for 12 rows. A thin dark line is dropped by a median, and the edge is the northernmost of the nearby columns, so black does not leak into the photograph."""
    h, w, _ = img.shape
    black = img.mean(axis=2) < 10
    csum = np.cumsum(black, axis=0, dtype=np.int16)
    csum = np.vstack([np.zeros((1, w), np.int16), csum])
    run = csum[12:] - csum[:-12]
    south = run[h // 2 :] == 12
    has = south.any(axis=0)
    edge = np.where(has, south.argmax(axis=0) + h // 2, h - 12).astype(np.float32)
    pad = np.pad(edge, 15, mode="wrap")
    edge = np.median(np.lib.stride_tricks.sliding_window_view(pad, 31), axis=1)
    half = max(8, w // 64)
    pad = np.pad(edge, half, mode="wrap")
    low = np.lib.stride_tricks.sliding_window_view(pad, 2 * half + 1).min(axis=1)
    # `low` stays north of every black pixel nearby; `edge` follows the ragged end of the photographs, which is where the blend sits
    return edge, low


def patch_window(n):
    """A raised cosine, 1 in the middle and 0 at the edges, so overlapping patches of the real ground meet with no square edge."""
    t = np.linspace(-np.pi, np.pi, n, dtype=np.float32)
    w = (0.5 * (1 + np.cos(t))).astype(np.float32)
    return np.outer(w, w)


def add_patch(acc, weight, src, win, y, x):
    """Add one windowed patch. Longitude wraps; a patch that would run off the pole is clipped."""
    h, w, _ = acc.shape
    ph, pw = win.shape
    y1 = min(h, y + ph)
    if y1 <= y or y >= h:
        return
    src = src[: y1 - y]
    win = win[: y1 - y]
    x0 = x % w
    if x0 + pw <= w:
        acc[y:y1, x0 : x0 + pw] += src * win[..., None]
        weight[y:y1, x0 : x0 + pw] += win
        return
    cut = w - x0
    acc[y:y1, x0:] += src[:, :cut] * win[:, :cut, None]
    weight[y:y1, x0:] += win[:, :cut]
    acc[y:y1, : pw - cut] += src[:, cut:] * win[:, cut:, None]
    weight[y:y1, : pw - cut] += win[:, cut:]


def source_band(safe, height, patch):
    bot = int(safe.min()) - patch - 2
    top = max(0, bot - patch)
    if bot <= top:
        sys.exit("the photographed band is too thin to quilt from")
    return top, bot


def quilt(img, edge, safe, rng):
    """Lay large patches of the ground just north of the edge over the unphotographed south. Each patch is a real piece of the mosaic, taken from about the same longitude, and the patches overlap so widely that no square shows."""
    h, w, _ = img.shape
    deg = w / 360.0
    patch = max(48, int(8 * deg))
    step = max(24, patch // 3)
    top, bot = source_band(safe, h, patch)
    win = patch_window(patch)
    acc = np.zeros((h, w, 3), np.float32)
    weight = np.zeros((h, w), np.float32)
    photo = np.arange(h)[:, None] < safe[None, :]
    acc[photo] = img[photo]
    weight[photo] = 1
    cap = int(h * (90 + POLAR_FROM) / 180)
    y = int(safe.min()) - patch // 5
    rows = 0
    while y < cap:
        x = int(rng.integers(0, step))
        while x < w:
            sy = int(bot - rng.integers(0, max(1, bot - top)))
            sx = int(x + rng.integers(-int(6 * deg), int(6 * deg) + 1)) % w
            src = take(img, sy, sx, patch, patch).astype(np.float32)
            add_patch(acc, weight, src, win, y, x)
            x += step
        y += step
        rows += 1
    covered = weight > 0.2
    mixed = np.divide(acc, weight[..., None], out=np.zeros_like(acc), where=covered[..., None])
    quilted = img.copy()
    quilted[covered] = np.clip(mixed[covered], 0, 255).astype(np.uint8)
    done = rows
    rows = np.arange(h)[:, None]
    span = max(8.0, h * 0.055)
    t = np.clip((rows - (edge[None, :] - span)) / span, 0, 1)
    t = (t * t * (3 - 2 * t))[..., None]
    out = np.clip(img.astype(np.float32) * (1 - t) + quilted.astype(np.float32) * t, 0, 255).astype(np.uint8)
    print(f"  quilted {done} rows of {patch}px patches", flush=True)
    return out


def polar_cap(img, edge, safe, rng):
    """The last degrees, made where a pixel is the same size north and east, from the same real patches, then put back one pixel at a time so the pole is not pinched."""
    h, w, _ = img.shape
    px = w / 360.0
    radius_deg = (90 - POLAR_FROM) + 6.0
    radius = int(radius_deg * px)
    size = radius * 2 + 1
    cy = cx = radius
    yy, xx = np.mgrid[0:size, 0:size]
    rr = np.hypot(yy - cy, xx - cx)
    ang = np.arctan2(xx - cx, -(yy - cy))
    lat = -90.0 + rr / px
    lon = np.degrees(ang)
    eq_y = np.clip(((90.0 - lat) / 180.0 * h).astype(int), 0, h - 1)
    eq_x = np.clip(((lon + 180.0) / 360.0 * w).astype(int), 0, w - 1)
    acc = np.zeros((size, size, 3), np.float32)
    weight = np.zeros((size, size), np.float32)
    have = (lat >= -POLAR_FROM) & (rr <= radius)
    acc[have] = img[eq_y[have], eq_x[have]]
    weight[have] = 1
    deg = w / 360.0
    patch = max(32, int(6 * deg))
    step = max(16, patch // 3)
    top, bot = source_band(safe, h, patch)
    win = patch_window(patch)
    count = max(40, (size // step) ** 2)
    for _ in range(count):
        y = int(rng.integers(0, size - patch))
        x = int(rng.integers(0, size - patch))
        if rr[y + patch // 2, x + patch // 2] > radius - 2:
            continue
        if have[y : y + patch, x : x + patch].mean() > 0.9:
            continue
        sy = int(rng.integers(top, bot))
        sx = int(rng.integers(0, w))
        src = take(img, sy, sx, patch, patch).astype(np.float32)
        acc[y : y + patch, x : x + patch] += src * win[..., None]
        weight[y : y + patch, x : x + patch] += win
    polar = np.divide(acc, np.maximum(weight, 1e-6)[..., None], out=np.zeros_like(acc), where=(weight > 0)[..., None])
    # a missed pixel would be black, and at the pole that black is a hole. Fill it from the covered ground, and make the centre one colour.
    hole = weight < 0.05
    covered = weight > 0.2
    if covered.any():
        fill = polar[covered].mean(axis=0)
        polar[hole] = fill
        weight[hole] = 1
        polar[cy - 3 : cy + 4, cx - 3 : cx + 4] = polar[cy - 14 : cy - 7, cx - 3 : cx + 4].mean(axis=(0, 1))
        weight[cy - 3 : cy + 4, cx - 3 : cx + 4] = 1
    y0 = int(h * (90 + POLAR_FROM - 8) / 180)
    lats = 90.0 - (np.arange(y0, h) + 0.5) / h * 180.0
    lons = np.radians((np.arange(w) + 0.5) / w * 360.0 - 180.0)
    rad = (90.0 + lats)[:, None] * px
    fy = cy - rad * np.cos(lons)[None, :]
    fx = cx + rad * np.sin(lons)[None, :]
    yf = np.clip(np.floor(fy).astype(int), 0, size - 2)
    xf = np.clip(np.floor(fx).astype(int), 0, size - 2)
    ty = (fy - yf)[..., None]
    tx = (fx - xf)[..., None]
    sampled = (
        polar[yf, xf] * (1 - ty) * (1 - tx)
        + polar[yf, xf + 1] * (1 - ty) * tx
        + polar[yf + 1, xf] * ty * (1 - tx)
        + polar[yf + 1, xf + 1] * ty * tx
    )
    wy = ty[..., 0]
    wx = tx[..., 0]
    covered = (
        weight[yf, xf] * (1 - wy) * (1 - wx)
        + weight[yf, xf + 1] * (1 - wy) * wx
        + weight[yf + 1, xf] * wy * (1 - wx)
        + weight[yf + 1, xf + 1] * wy * wx
    )
    tw = np.clip((8.0 - (lats + POLAR_FROM)) / 8.0, 0, 1)[:, None] * np.clip(covered / 0.35, 0, 1)
    tw = tw[..., None]
    img[y0:] = np.clip(img[y0:].astype(np.float32) * (1 - tw) + sampled * tw, 0, 255).astype(np.uint8)
    return img


def take(img, y, x, bh, bw):
    h, w, _ = img.shape
    xs = np.arange(x, x + bw) % w
    return img[y : y + bh][:, xs]



def build(width):
    licence_is_public_domain()
    full = roll_half(source_image())
    height = width // 2
    img = np.array(Image.fromarray(full).resize((width, height), Image.Resampling.LANCZOS))
    edge, safe = photo_edge(img)
    print(f"edge rows {edge.min():.0f} to {edge.max():.0f} of {height} (about {90 - edge.mean() / height * 180:.0f} degrees south)")
    rng = np.random.default_rng(SEED)
    img = quilt(img, edge, safe, rng)
    img = polar_cap(img, edge, safe, rng)
    # the south must carry real variation, not one tone
    south = img[int(edge.max()) + 8 :]
    if float(south.std()) < 8:
        sys.exit(f"the south is flat (std {south.std():.1f}): the quilt failed")
    return img, edge


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
            f"- Source: {SOURCE_TITLE}",
            f"- Address: {SOURCE_URL}",
            f"- Source SHA-256: `{SOURCE_SHA}`",
            "- Licence: public domain (Wikimedia Commons metadata, NASA / Johns Hopkins University Applied Physics Laboratory / Southwest Research Institute).",
            "- Generator: `scripts/pluto-south.py` in wakusei-planets.",
            f"- Seed: {SEED}.",
            "- Date: 2026-11-23.",
            "- What it is: the New Horizons mosaic, with the unphotographed south quilted from real patches of the ground just north of the ragged edge. The pole is filled in a south-polar projection. It is not a photograph of that ground.",
            f"- Master SHA-256: `{digest}`.",
            "",
        ]))
    print(f"master {path} ({os.path.getsize(path) // (1024 * 1024)} MB)")
    out = os.path.join(ROOT, "textures")
    for w in WIDTHS:
        small = Image.fromarray(img).resize((w, w // 2), Image.Resampling.LANCZOS)
        webp = os.path.join(out, f"pluto-{w}.webp")
        small.save(webp, "WEBP", quality=82, method=6)
        print(f"  pluto-{w}.webp {os.path.getsize(webp) // 1024} KB")


def main():
    width = MASTER_W
    if len(sys.argv) == 3 and sys.argv[1] == "--width":
        width = int(sys.argv[2])
    img, _ = build(width)
    if width == MASTER_W:
        write_master(img)
    else:
        path = f"/tmp/pluto-south-{width}.jpg"
        Image.fromarray(img).save(path, quality=90)
        print(f"preview {path}")


if __name__ == "__main__":
    main()
