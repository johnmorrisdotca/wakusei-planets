#!/usr/bin/env python3
"""Writes textures/<body>-<width>.webp for the small moons that have a published global map (MODULES-1601), from the mission's own mosaic, and prints the entries for textures/SOURCES.json.

  phobos  USGS Astrogeology, Phobos Viking Global Mosaic 5m (Stooke, DLR control), 14400 x 7200, https://astrogeology.usgs.gov/search/map/phobos_viking_global_mosaic_5m (planetarymaps.usgs.gov/mosaic/Phobos_Viking_Mosaic_40ppd_DLRcontrol.tif)
  deimos  USGS Astrogeology, Deimos Global Mosaic (Stooke, Viking; the WMS of planetarymaps.usgs.gov, layer VIKING), cut at 2048 x 1024
  phoebe  Cassini ISS global mosaic, the PDS volume COISS_3001 (DLR and the ISS team, 2006), SP_1M_0_0_SIMP.IMG, 2880 x 1440, 0.233 km per pixel (also NASA/JPL/Space Science Institute's PIA07775): its gaps (the north pole and the rim of the data, which the mosaic leaves black) are filled with the surrounding brightness, blurred.

Each mosaic is a map of brightness (greyscale), simple cylindrical, longitude 0 in the middle and east to the right, the package's own layout. The package's map colours a body: the brightness of the mosaic is kept (its mean made the body's own mean) and tinted with the body's colour in the package's table of facts (`--tint`),
so the map is the mission's pictures and the colour and level the package's. Phobos and Phoebe were registered against their shape model (the shape's relief and the map's brightness correlate best at no turn, no mirror: the check is in the log of this script).

Usage: python3 -I scripts/make-moon-maps.py --cache DIR      (DIR holds Phobos_Viking_Mosaic_40ppd_DLRcontrol.tif, deimos-usgs.png and SP_1M_0_0_SIMP.IMG; the script never fetches)"""
import json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "textures")
WIDTHS = [512, 1024, 2048]
Image.MAX_IMAGE_PIXELS = None

# body -> (tint colour: the body's colour in src/facts.ts, mean level: the mean of the dark and the light colour of its look in src/bodies/moons-*.ts). Phoebe is not in the table of facts yet: its mosaic is panchromatic and the moon nearly neutral grey
# (no tint), and its level is the mean of the dark and the light colour of its look, as for the others (it is as dark as Phobos: geometric albedo 0.08 and 0.07).
STYLE = {
    "phobos": ("#8c8782", 0.42),
    "deimos": ("#9a948b", 0.52),
    "phoebe": ("#808080", 0.34),
}


def rgb(hexcolour):
    return np.array([int(hexcolour[i : i + 2], 16) / 255 for i in (1, 3, 5)])


def fill(img, valid):
    """The gaps of a map filled with the brightness round them: normalised box averages of growing radius, then a soft blend, so the filled part has no edge."""
    out = img.astype(np.float64).copy()
    have = valid.copy()
    h, w = img.shape
    s = 4
    while not have.all() and s < 512:
        weight = box(have.astype(np.float64), s)
        avg = box(np.where(have, out, 0.0), s) / np.maximum(weight, 1e-9)
        take = ~have & (weight > 0.04)
        out[take] = avg[take]
        have |= take
        s *= 2
    blur = box(out, 6)
    soft = box((~valid).astype(np.float64), 4)
    return np.where(valid, out, out * (1 - np.clip(soft * 4, 0, 1)) + blur * np.clip(soft * 4, 0, 1))


def box(a, s):
    """A box average of radius s, wrapping in longitude (columns), edge-clamped in latitude (rows)."""
    k = 2 * s + 1
    p = np.concatenate([a[:, -s:], a, a[:, :s]], axis=1)
    c = np.cumsum(np.concatenate([np.zeros((a.shape[0], 1)), p], axis=1), axis=1)
    a = (c[:, k:] - c[:, :-k]) / k
    p = np.pad(a, ((s, s), (0, 0)), mode="edge")
    c = np.cumsum(np.concatenate([np.zeros((1, a.shape[1])), p], axis=0), axis=0)
    return (c[k:] - c[:-k]) / k


def write(body, grey, mean_of_valid):
    tint, level = STYLE[body]
    t = rgb(tint)
    t = t / t.mean()
    for width in WIDTHS:
        im = Image.fromarray(np.clip(grey, 0, 255).astype(np.uint8)).resize((width, width // 2), Image.LANCZOS)
        g = np.asarray(im, dtype=np.float64) / 255.0
        g = g / mean_of_valid * level
        out = np.clip(g[..., None] * t[None, None, :], 0, 1)
        Image.fromarray((out * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, f"{body}-{width}.webp"), "WEBP", quality=80, method=5)
    print(f"{body}: wrote textures/{body}-512|1024|2048.webp (mean level {level}, tint {tint})", file=sys.stderr)


def main():
    cache = sys.argv[sys.argv.index("--cache") + 1] if "--cache" in sys.argv else sys.exit(__doc__)
    os.makedirs(OUT, exist_ok=True)
    # Phobos
    g = np.asarray(Image.open(os.path.join(cache, "Phobos_Viking_Mosaic_40ppd_DLRcontrol.tif")).convert("L").resize((4096, 2048), Image.LANCZOS), dtype=np.float64)
    write("phobos", g, g.mean() / 255.0)
    # Deimos
    g = np.asarray(Image.open(os.path.join(cache, "deimos-usgs.png")).convert("L"), dtype=np.float64)
    write("deimos", g, g.mean() / 255.0)
    # Phoebe: the black of the mosaic's gaps and the bright artefacts at its south edge are not data
    raw = np.fromfile(os.path.join(cache, "SP_1M_0_0_SIMP.IMG"), dtype=np.uint8)[11520:].reshape(1440, 2880).astype(np.float64)
    valid = raw > 3
    valid[:30] = False
    valid[-60:] = False
    grown = box(valid.astype(np.float64), 3) > 0.995  # a pixel only counts where its neighbours are data too: the rim of a gap is smeared
    g = fill(np.where(grown, raw, 0.0), grown)
    write("phoebe", g, g.mean() / 255.0)


if __name__ == "__main__":
    main()
