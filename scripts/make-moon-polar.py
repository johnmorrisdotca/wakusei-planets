#!/usr/bin/env python3
"""Build the Moon's two polar height maps from the PDS LOLA gridded data.

    python3 -I scripts/make-moon-polar.py [--cache DIR] [--out DIR]

The north and south grids use the Mean Earth/Polar Axis frame of DE421.
The WebPs store elevations, in two lossless colour channels, for slope shading.
"""
import argparse
from pathlib import Path
import runpy
from tempfile import TemporaryDirectory

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
PDS = "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img"
SOURCES = {
    "north": ("ldem_75n_240m", "c63d22385f182f276dd90adb7755e3070e725c3cd50b6d0d20d76a94edbba41b"),
    "south": ("ldem_75s_240m", "d031efe2611b17dfbf3c158f5e15dc04cd5719349dcbf6384bb21fd97697c490"),
}
NATIVE_SIZE, NATIVE_STEP_M = 3812, 240
SIZE = 1536
MOON_RADIUS_M = 1_737_400
HEIGHT_LO, HEIGHT_RANGE = -12_000, 24_000


def build(source_dir, out):
    tiles = runpy.run_path(str(HERE / "make-body-tiles.py"))
    terrain = runpy.run_path(str(HERE / "make-moon-terrain.py"))
    source_dir.mkdir(parents=True, exist_ok=True)
    out.mkdir(parents=True, exist_ok=True)

    # The PDS pixel grid is centred on the pole. Samples outside the 75° cap
    # are unused, and clearing them makes the height maps smaller.
    half_m = NATIVE_SIZE * NATIVE_STEP_M / 2
    axis = (np.arange(SIZE) + .5) * (2 * half_m / SIZE) - half_m
    within = np.hypot(axis[:, None], axis[None, :]) <= 2 * MOON_RADIUS_M * np.tan(np.radians(15) / 2)

    with TemporaryDirectory(dir=out) as temporary:
        for side, (name, digest) in SOURCES.items():
            source = source_dir / f"{name}.img"
            pin = {"url": f"{PDS}/{name}.img", "sha256": digest}
            if not source.is_file():
                with TemporaryDirectory(dir=source_dir) as download:
                    Path(tiles["fetch"](name, download, pin)).replace(source)
            if tiles["sha256_of"](source) != digest:
                raise SystemExit(f"{source}: SHA-256 differs from the PDS file pinned in SOURCES")
            raw = np.fromfile(source, dtype="<i2").reshape(NATIVE_SIZE, NATIVE_SIZE)
            image = Image.fromarray(raw.astype(np.float32) * .5)
            height = np.asarray(image.resize((SIZE, SIZE), Image.Resampling.LANCZOS))
            rgb = terrain["encode"](np.where(within, height, 0), HEIGHT_LO, HEIGHT_RANGE)
            staged = Path(temporary) / f"{side}.webp"
            terrain["save_exact"](Image.fromarray(rgb), staged)
            print(f"{side}: {SIZE} x {SIZE}, {staged.stat().st_size:,} bytes", flush=True)
        for side in SOURCES:
            file = f"{side}.webp"
            (Path(temporary) / file).replace(out / file)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=ROOT / ".cache/moon-polar-sources")
    parser.add_argument("--out", type=Path, default=ROOT / ".cache/moon-polar-out")
    args = parser.parse_args()
    build(args.cache, args.out)
