#!/usr/bin/env python3
"""Writes src/data/shapes/<body>.ts: the real shape of a small moon as a table of radii, from a published shape model (MODULES-1601).

Each model (an OBJ, a gzipped STL or a glTF binary, read from --cache; the script never fetches) is cut by rays from its centre in the directions of the vertices of the globe the package draws (`SphereGeometry(1, 192, 96)`: 192 steps of
longitude, 96 of latitude), and the farthest crossing of each ray is the radius there. The package draws a moon of this kind as that globe with every vertex moved to its radius, with the moon's own shader, map and light: the model is thinned to 18,624
radii (a few thousand triangles' worth of the shape as seen from the centre, and no more than a moon this small shows), a moon is star-shaped about its centre, and the table is a few kilobytes in a chunk of its own, not the model.

The table is written as radii in units of 1/UNIT km, as 16-bit integers each given as the step from the radius before it along the same latitude, little-endian, in base64. (An overhang, a ray that crosses the model more than twice, takes the farthest crossing.)

Frames: a model in the body-fixed IAU frame (Gaskell's Phobos and Phoebe) is used as it is. A model with no frame of its own (NASA's glTF files, Porter's Nix and Hydra) is turned so that its longest axis is the x axis (toward longitude 0), its middle axis y and its shortest z (north): where the IAU frame of the moon
has its prime meridian on the long axis (Phobos, Deimos, Nix, Hydra: the long axis points at the planet), that is the frame; Hyperion tumbles, so any frame is as good as another. `ORIENT` says which, and a body whose model has a texture with its own mapping is turned to the
map's longitudes (`fit_uv`).

Usage: python3 -I scripts/make-moon-shapes.py --cache DIR [--preview DIR]      (DIR holds the model files named in MODELS)"""
import base64, gzip, json, math, os, re, struct, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "src", "data", "shapes")
# the steps of longitude and of latitude of each moon's table: as many as the model has detail for (a smooth model needs few)
GRID = {"phobos": (192, 96), "phoebe": (160, 80), "deimos": (96, 48), "hyperion": (128, 64), "nix": (96, 48), "hydra": (96, 48)}

# body -> (file, kind, scale to km, orientation, centre)
MODELS = {
    "phobos": ("phobos_ver64q.tab.obj", "obj", 1.0, "iau", "box"),
    "phoebe": ("phoebe_ver64q.tab.obj", "obj", 1.0, "iau", "box"),
    "deimos": ("deimos.glb", "glb", None, "axes", "box"),
    "hyperion": ("hyperion.glb", "glb", None, "axes", "box"),
    "nix": ("nix.stl.gz", "stl", 0.5, "axes", "box"),
    "hydra": ("hydra.stl.gz", "stl", 1.0, "axes", "box"),
}
# a glTF file states no unit: its model is scaled so that the sphere of its own volume has JPL's mean radius of the moon (JPL SSD planetary satellite physical parameters: Deimos 6.2 km, Hyperion 135 km)
MEAN_KM = {"deimos": 6.2, "hyperion": 135.0}


def read_obj(path):
    vs, fs = [], []
    for line in open(path):
        if line.startswith("v "):
            vs.append([float(x) for x in line.split()[1:4]])
        elif line.startswith("f "):
            fs.append([int(p.split("/")[0]) - 1 for p in line.split()[1:4]])
    v = np.array(vs, dtype=np.float64)
    return v[np.array(fs)]


def read_stl(path):
    raw = gzip.open(path).read()
    n = struct.unpack("<I", raw[80:84])[0]
    if 84 + 50 * n == len(raw):
        arr = np.frombuffer(raw[84:], dtype=np.dtype([("n", "<f4", 3), ("v", "<f4", (3, 3)), ("a", "<u2")]), count=n)
        return arr["v"].astype(np.float64)
    vs = np.array([[float(x) for x in m] for m in re.findall(rb"vertex\s+(\S+)\s+(\S+)\s+(\S+)", raw)], dtype=np.float64)
    return vs.reshape(-1, 3, 3)


def read_glb(path):
    raw = open(path, "rb").read()
    magic, ver, length = struct.unpack("<4sII", raw[:12])
    assert magic == b"glTF"
    off = 12
    js, binary = None, b""
    while off < length:
        size, kind = struct.unpack("<I4s", raw[off : off + 8])
        body = raw[off + 8 : off + 8 + size]
        if kind == b"JSON":
            js = json.loads(body)
        elif kind == b"BIN\0":
            binary = body
        off += 8 + size
    comp = {5126: ("f4", 4), 5123: ("u2", 2), 5125: ("u4", 4), 5121: ("u1", 1)}
    count = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}

    def accessor(i):
        a = js["accessors"][i]
        bv = js["bufferViews"][a["bufferView"]]
        dt, sz = comp[a["componentType"]]
        n = count[a["type"]]
        start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
        stride = bv.get("byteStride", sz * n)
        if stride == sz * n:
            return np.frombuffer(binary, dtype="<" + dt, count=a["count"] * n, offset=start).reshape(a["count"], n)
        rows = [np.frombuffer(binary, dtype="<" + dt, count=n, offset=start + k * stride) for k in range(a["count"])]
        return np.array(rows)

    tris, uvs = [], []
    for mesh in js["meshes"]:
        for prim in mesh["primitives"]:
            pos = accessor(prim["attributes"]["POSITION"]).astype(np.float64)
            idx = accessor(prim["indices"]).reshape(-1, 3) if "indices" in prim else np.arange(len(pos)).reshape(-1, 3)
            tris.append(pos[idx])
            if "TEXCOORD_0" in prim["attributes"]:
                uv = accessor(prim["attributes"]["TEXCOORD_0"]).astype(np.float64)
                uvs.append(uv[idx])
    return np.concatenate(tris), (np.concatenate(uvs) if uvs else None), js


def principal_axes(tris):
    """Rotate so the longest axis of the point cloud is x, the middle y, the shortest z; right handed."""
    pts = tris.reshape(-1, 3)
    centre = (pts.max(axis=0) + pts.min(axis=0)) / 2
    q = pts - centre
    w, v = np.linalg.eigh(np.cov(q.T))
    order = np.argsort(w)[::-1]
    rot = v[:, order]
    # the axes are ordered by the extent of the model along each, not by the variance (a lumpy body can have more variance along a shorter axis)
    ext = np.array([float(((q @ rot[:, i]).max() - (q @ rot[:, i]).min())) for i in range(3)])
    rot = rot[:, np.argsort(-ext)]
    if np.linalg.det(rot) < 0:
        rot[:, 2] = -rot[:, 2]
    return rot  # columns: the new x, y, z axes in the old frame


def directions(LON, LAT):
    """The unit direction (body-fixed X toward longitude 0, Y east, Z north) of every vertex of SphereGeometry(1, 192, 96), in its order, as the three.js sphere lays them out: x = -cos(phi) sin(theta), y = cos(theta), z = sin(phi) sin(theta)."""
    out = np.zeros((LAT + 1, LON, 3))
    for iy in range(LAT + 1):
        theta = math.pi * iy / LAT
        for ix in range(LON):
            phi = 2 * math.pi * ix / LON
            x, y, z = -math.cos(phi) * math.sin(theta), math.cos(theta), math.sin(phi) * math.sin(theta)
            out[iy, ix] = (z, x, y)  # body-fixed (X, Y, Z) = (z, x, y), the shader's vObj
    return out


def cast(tris, dirs, centre):
    """The farthest crossing of every ray from `centre` along `dirs` (n, 3) with the triangles (m, 3, 3): Moller-Trumbore, in chunks."""
    a = tris[:, 0] - centre
    e1 = tris[:, 1] - tris[:, 0]
    e2 = tris[:, 2] - tris[:, 0]
    best = np.zeros(len(dirs))
    for start in range(0, len(dirs), 32):
        d = dirs[start : start + 32]
        # ray origin 0 (centre moved to the origin): t such that t d = a + u e1 + v e2
        pvec = np.cross(d[:, None, :], e2[None, :, :])
        det = np.einsum("tk,rtk->rt", e1, pvec)
        with np.errstate(divide="ignore", invalid="ignore"):
            inv = 1.0 / det
            tvec = -a[None, :, :]
            u = np.einsum("rtk,rtk->rt", np.broadcast_to(tvec, pvec.shape), pvec) * inv
            qvec = np.cross(tvec, e1[None, :, :])
            v = np.einsum("rk,rtk->rt", d, qvec) * inv
            t = np.einsum("tk,rtk->rt", e2, qvec) * inv
        ok = (np.abs(det) > 1e-12) & (u >= 0) & (v >= 0) & (u + v <= 1) & (t > 0)
        t = np.where(ok, t, 0.0)
        best[start : start + 32] = t.max(axis=1)
    return best


def table_of(radii_km, LON, LAT):
    """radii (LAT+1, LON) km -> (unit, base64 text of the steps along each latitude)."""
    top = float(radii_km.max())
    unit = 1
    while top * unit * 2 < 32000:
        unit *= 2
    q = np.rint(radii_km * unit).astype(np.int64)
    steps = np.diff(np.concatenate([np.zeros((LAT + 1, 1), dtype=np.int64), q], axis=1), axis=1)
    # the first of each row is its own value; the rest are steps
    assert steps.min() > -32768 and steps.max() < 32768, (steps.min(), steps.max())
    return unit, base64.b64encode(steps.astype("<i2").tobytes()).decode()


SOURCES = {
    "phobos": {"file": "phobos_ver64q.tab.obj", "source": "Gaskell Phobos Shape Model V1.0, NASA PDS Small Bodies Node, urn:nasa:pds:gaskell.phobos.shape-model::1.0, doi 10.26033/xzv5-bw95"},
    "phoebe": {"file": "phoebe_ver64q.tab.obj", "source": "Gaskell Phoebe Shape Model V2.0, NASA PDS Small Bodies Node, urn:nasa:pds:gaskell.phoebe.shape-model::1.0, doi 10.26033/ehkj-xj95"},
    "deimos": {"file": "24879_Deimos_1_1000.glb", "source": "NASA 3D Resources, Deimos, credit NASA/JPL-Caltech"},
    "hyperion": {"file": "Hyperion_1_1000.glb", "source": "NASA 3D Resources, Hyperion, credit NASA Visualization Technology Applications and Development"},
    "nix": {"file": "nix_nrf1d3_hipoly.stl.gz", "source": "Simon Porter, Shape Model of Nix, figshare doi 10.6084/m9.figshare.12779948.v1, CC BY 4.0"},
    "hydra": {"file": "hydra_shf1k3_hipoly.stl.gz", "source": "Simon Porter, Shape Model of Hydra, figshare doi 10.6084/m9.figshare.12779975.v1, CC BY 4.0"},
}


def render(r, path, size=360):
    LAT, LON = r.shape[0] - 1, r.shape[1]
    """A few views of the shape for a look (not part of the package): the globe's vertices moved to their radii, lit from one side, seen from four sides."""
    from PIL import Image, ImageDraw
    d = directions(LON, LAT)
    pts = d * r[..., None]
    top = float(r.max())
    images = []
    for yaw in (0, 90, 180, 270):
        ca, sa = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
        rot = np.array([[ca, -sa, 0], [sa, ca, 0], [0, 0, 1]])
        p = pts @ rot.T
        # seen along +x from far away: screen x = y, screen y = z; depth = x (nearer is larger)
        img = Image.new("L", (size, size), 0)
        dr = ImageDraw.Draw(img)
        quads = []
        for iy in range(LAT):
            for ix in range(LON):
                jx = (ix + 1) % LON
                a, b, c, e = p[iy, ix], p[iy, jx], p[iy + 1, jx], p[iy + 1, ix]
                n = np.cross(b - a, e - a) + np.cross(c - b, e - b)
                ln = np.linalg.norm(n)
                if ln == 0:
                    continue
                n = n / ln
                if float(n @ ((a + b + c + e) / 4)) < 0:
                    n = -n
                quads.append(((a[0] + b[0] + c[0] + e[0]) / 4, (a, b, c, e), n))
        quads.sort(key=lambda q: q[0])
        light = np.array([0.8, 0.45, 0.4]) / np.linalg.norm([0.8, 0.45, 0.4])
        for depth, poly, n in quads:
            if n[0] < -0.05:
                continue
            shade = int(max(0.0, float(n @ light)) * 215 + 25)
            dr.polygon([(size / 2 + q[1] / top * size * 0.46, size / 2 - q[2] / top * size * 0.46) for q in poly], fill=shade)
        images.append(img)
    out = Image.new("L", (size * 4, size))
    for i, im in enumerate(images):
        out.paste(im, (i * size, 0))
    out.save(path)


def main():
    arg = lambda name: sys.argv[sys.argv.index(name) + 1] if name in sys.argv else None
    cache = arg("--cache")
    preview = arg("--preview")
    only = arg("--only")
    if not cache:
        sys.exit(__doc__)
    os.makedirs(OUT, exist_ok=True)
    for body, (fname, kind, scale, orient, centre_kind) in MODELS.items():
        if only and body not in only.split(","):
            continue
        path = os.path.join(cache, fname)
        uv = None
        if kind == "obj":
            tris = read_obj(path)
        elif kind == "stl":
            tris = read_stl(path)
        else:
            tris, uv, _ = read_glb(path)
        tris = tris * (scale if scale is not None else 1.0)
        pts = tris.reshape(-1, 3)
        centre = (pts.max(axis=0) + pts.min(axis=0)) / 2
        if orient == "axes":
            rot = principal_axes(tris)
            tris = (tris.reshape(-1, 3) - centre) @ rot
            tris = tris.reshape(-1, 3, 3)
            centre = np.zeros(3)
            pts = tris.reshape(-1, 3)
            centre = (pts.max(axis=0) + pts.min(axis=0)) / 2
        LON, LAT = GRID[body]
        r = cast(tris, directions(LON, LAT).reshape(-1, 3), centre).reshape(LAT + 1, LON)
        volume_radius = lambda rr: float((np.mean(rr[1:-1] ** 3 * np.sin(np.pi * (np.arange(1, LAT)[:, None]) / LAT)) / np.mean(np.sin(np.pi * np.arange(1, LAT) / LAT)) * 1.0) ** (1 / 3))
        if body in MEAN_KM:
            k = MEAN_KM[body] / volume_radius(r)
            r = r * k
            tris = tris * k
            pts = tris.reshape(-1, 3)
            centre = centre * k
            print(f"{body}: the file's unit is taken so that the sphere of its volume has the mean radius of {MEAN_KM[body]} km (a factor of {k:.4f})", file=sys.stderr)
        miss = int((r == 0).sum())
        for iy, ix in zip(*np.nonzero(r == 0)):  # a ray that slipped between two triangles takes the mean of its neighbours
            around = [r[(iy + dy) % (LAT + 1), (ix + dx) % LON] for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dy or dx) and 0 <= iy + dy <= LAT and r[(iy + dy) % (LAT + 1), (ix + dx) % LON] > 0]
            r[iy, ix] = sum(around) / len(around)
        # the poles are one point: every ray of the top row has the one radius, as has the bottom row
        r[0, :] = r[0, :].mean()
        r[LAT, :] = r[LAT, :].mean()
        ext = pts.max(axis=0) - pts.min(axis=0)
        print(f"{body}: volume radius {volume_radius(r):.3f} km;")
        print(f"{body}: {len(tris)} triangles, extents {ext.round(2).tolist()} (as read), radii {r.min():.3f} to {r.max():.3f} (mean {r.mean():.3f}), {miss} rays missed", file=sys.stderr)
        np.save(os.path.join(cache, f"{body}-radii-raw.npy"), r)
        unit, text = table_of(r, LON, LAT)
        with open(os.path.join(OUT, f"{body}.ts"), "w", encoding="utf-8") as f:
            f.write(f"// Made by scripts/make-moon-shapes.py from {SOURCES[body]['file']} ({SOURCES[body]['source']}). Do not edit by hand.\n")
            f.write(f"import type {{ ShapeTable }} from \"../../scene/shape.ts\";\n\nexport const SHAPE_{body.upper()}: ShapeTable = {{ lon: {LON}, lat: {LAT}, unit: {unit}, steps: \"{text}\" }};\n")
        if preview:
            os.makedirs(preview, exist_ok=True)
            render(r, os.path.join(preview, f"{body}-shape.png"))


if __name__ == "__main__":
    main()
