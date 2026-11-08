#!/usr/bin/env python3
"""Write src/data/stars.ts: the stars to visual magnitude 6.0 from the Yale Bright Star Catalogue.

Source: Hoffleit, D. and Warren, W. H. Jr., 1991, "The Bright Star Catalogue, 5th Revised Edition (Preliminary Version)", Astronomical Data Center
(NASA Goddard) and CDS, catalogue V/50. The catalogue's own documentation calls it public domain, and the Astronomical Data Center asks only that it
and the authors are acknowledged; NOTICE.md does. Positions are J2000 (FK5), proper motions and parallaxes are the catalogue's own.
NOT the Hipparcos or Tycho catalogues: ESA licenses those CC BY-NC 3.0 IGO (non-commercial), which an MIT package cannot pass on.

The common names are our own list, keyed by the catalogue's Bayer designation; each is checked here against the catalogue (the star must exist and
be as bright as the name implies). Names follow the IAU Working Group on Star Names.

    python3 -I scripts/make-star-data.py                 # fetches the catalogue from the VizieR mirror (needs the network)
    python3 -I scripts/make-star-data.py --from FILE     # reads a VizieR TSV saved earlier

Neither runs in the test.
"""
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

LIMIT = 6.0
MIRROR = "https://vizier.cfa.harvard.edu/viz-bin/asu-tsv"
OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "stars.ts"

GREEK = {
    "Alp": "α", "Bet": "β", "Gam": "γ", "Del": "δ", "Eps": "ε", "Zet": "ζ", "Eta": "η", "The": "θ", "Iot": "ι", "Kap": "κ", "Lam": "λ", "Mu": "μ",
    "Nu": "ν", "Xi": "ξ", "Omi": "ο", "Pi": "π", "Rho": "ρ", "Sig": "σ", "Tau": "τ", "Ups": "υ", "Phi": "φ", "Chi": "χ", "Psi": "ψ", "Ome": "ω",
}

# Common names by Bayer designation (with its number where the catalogue has components) and the faintest magnitude we expect, a check against a wrong key.
NAMES = {
    "α CMa": "Sirius", "α Car": "Canopus", "α Boo": "Arcturus", "α1 Cen": "Rigil Kentaurus", "α Lyr": "Vega", "α Aur": "Capella", "β Ori": "Rigel",
    "α CMi": "Procyon", "α Eri": "Achernar", "α Ori": "Betelgeuse", "β Cen": "Hadar", "α Aql": "Altair", "α Tau": "Aldebaran", "α Sco": "Antares",
    "α Vir": "Spica", "β Gem": "Pollux", "α PsA": "Fomalhaut", "α Cyg": "Deneb", "β Cru": "Mimosa", "α Leo": "Regulus", "ε CMa": "Adhara",
    "γ Cru": "Gacrux", "λ Sco": "Shaula", "γ Ori": "Bellatrix", "β Tau": "Elnath", "β Car": "Miaplacidus", "ε Ori": "Alnilam", "α Gru": "Alnair",
    "ζ Ori": "Alnitak", "α UMa": "Dubhe", "ε UMa": "Alioth", "α Per": "Mirfak", "η UMa": "Alkaid", "ε Sgr": "Kaus Australis", "δ CMa": "Wezen",
    "θ Sco": "Sargas", "ε Car": "Avior", "β CMa": "Mirzam", "α Pav": "Peacock", "α Hya": "Alphard", "α Cas": "Schedar", "β UMa": "Merak",
    "ε Boo": "Izar", "α Cet": "Menkar", "α Oph": "Rasalhague", "β Cet": "Diphda", "γ Dra": "Eltanin", "β And": "Mirach", "α And": "Alpheratz",
    "γ1 And": "Almach", "β UMi": "Kochab", "α UMi": "Polaris", "α CrB": "Alphecca", "α Ari": "Hamal", "β Per": "Algol", "ζ UMa": "Mizar",
    "δ Ori": "Mintaka", "κ Ori": "Saiph", "β Aur": "Menkalinan", "γ1 Leo": "Algieba", "β Leo": "Denebola", "γ Gem": "Alhena", "α Lup": "Men",
    "δ Sco": "Dschubba", "ε Sco": "Larawag", "ζ Pup": "Naos", "γ Vir": "Porrima", "β Cap": "Dabih", "α Aqr": "Sadalmelik", "β Aqr": "Sadalsuud",
    "ε Peg": "Enif", "α Peg": "Markab", "β Peg": "Scheat", "γ Peg": "Algenib", "β1 Sco": "Acrab", "δ Cas": "Ruchbah", "γ Cas": "Navi",
    "ε Cas": "Segin", "β Cas": "Caph", "α Tri": "Mothallah", "γ Cyg": "Sadr", "β1 Cyg": "Albireo", "γ Aql": "Tarazed",
    "β Aql": "Alshain", "α Del": "Sualocin", "β Del": "Rotanev", "ζ Her": "Rutilicus", "β Her": "Kornephoros", "α1 Her": "Rasalgethi",
    "η Boo": "Muphrid", "β Boo": "Nekkar", "γ Boo": "Seginus", "β Lib": "Zubeneschamali", "α2 Lib": "Zubenelgenubi", "β Leo": "Denebola",
    "α Crv": "Alchiba", "β Crv": "Kraz", "δ Crv": "Algorab", "α Crt": "Alkes", "α Lep": "Arneb", "β Lep": "Nihal",
    "α Col": "Phact", "β Col": "Wazn", "α Phe": "Ankaa", "θ1 Eri": "Acamar",
    "ι UMa": "Talitha", "λ UMa": "Tania Borealis", "μ UMa": "Tania Australis", "ν UMa": "Alula Borealis",
    "ξ UMa": "Alula Australis", "δ UMa": "Megrez", "γ UMa": "Phecda",
}
FAINTEST = {}


def sexagesimal(text: str, hours: bool) -> float:
    sign = -1.0 if text.strip().startswith("-") else 1.0
    parts = text.replace("+", " ").replace("-", " ").split()
    value = float(parts[0]) + float(parts[1]) / 60 + float(parts[2]) / 3600
    return sign * value * (15.0 if hours else 1.0)


def spectral_class(text: str) -> str:
    """The class and subclass only (K1 of K1.5IIIFe-0.5): enough to colour and label a star; the catalogue's full string is long."""
    match = re.match(r"\s*([OBAFGKMCRNS])\s*([0-9])?", text)
    return (match.group(1) + (match.group(2) or "")) if match else ""


def fetch() -> str:
    params = {"-source": "V/50/catalog", "-out.max": "unlimited", "-out": "HR,Name,RAJ2000,DEJ2000,pmRA,pmDE,Vmag,B-V,SpType,Parallax", "Vmag": "<=6.5", "-sort": "Vmag", "-oc.form": "d"}
    url = MIRROR + "?" + urllib.parse.urlencode(params, safe="=<>,/")
    with urllib.request.urlopen(url, timeout=120) as response:
        return response.read().decode("latin-1")


def designation(name: str):
    """The catalogue's ten-character name: a three-character Flamsteed number, a four-character Bayer letter and a three-character constellation."""
    name = name.ljust(10)
    flamsteed = name[0:3].strip()
    bayer = name[3:7].strip()
    constellation = name[7:10].strip()
    letter = ""
    if bayer:
        letter = GREEK.get(bayer[:3], bayer[:3]) + bayer[3:]
    return (int(flamsteed) if flamsteed.isdigit() else 0), letter, constellation


def main() -> None:
    text = Path(sys.argv[sys.argv.index("--from") + 1]).read_text(encoding="latin-1") if "--from" in sys.argv else fetch()
    stars = []
    for line in text.splitlines():
        if line.startswith("#") or not line.strip():
            continue
        p = line.split("\t")
        if len(p) < 10 or not p[0].strip().isdigit() or not p[2].strip() or not p[3].strip() or not p[6].strip():
            continue
        magnitude = float(p[6])
        if magnitude > LIMIT:
            continue
        flamsteed, letter, constellation = designation(p[1])
        stars.append({
            "hr": int(p[0]), "letter": letter, "flamsteed": flamsteed, "constellation": constellation,
            "ra": sexagesimal(p[2], True), "dec": sexagesimal(p[3], False),
            "pmRa": round(float(p[4]) * 1000) if p[4].strip() else 0, "pmDec": round(float(p[5]) * 1000) if p[5].strip() else 0,
            "v": magnitude, "bv": p[7].strip(), "spectral": spectral_class(p[8]), "plx": round(float(p[9]) * 1000) if p[9].strip() else 0,
        })
    stars.sort(key=lambda s: (s["v"], s["hr"]))
    by_designation = {}
    for s in stars:
        if s["letter"]:
            by_designation.setdefault(f'{s["letter"]} {s["constellation"]}', s)

    names = {}
    problems = []
    for key, name in NAMES.items():
        star = by_designation.get(key)
        if star is None:
            problems.append(f"no such star: {key} {name}; similar: {[k for k in by_designation if k.split()[-1] == key.split()[-1] and k[0] == key[0]]}")
        elif star["v"] > FAINTEST.get(key, 4.5):
            problems.append(f"too faint for a common name: {key} {name} {star['v']}")
        else:
            names[star["hr"]] = name
    if len(set(names.values())) != len(names):
        problems.append("a name is used twice")
    if problems:
        print("\n".join(problems))
        sys.exit(1)

    rows = []
    for s in stars:
        rows.append("|".join([
            str(s["hr"]), s["letter"], str(s["flamsteed"] or ""), s["constellation"], str(round(s["ra"] * 2400)), str(round(s["dec"] * 3600)), str(s["pmRa"]), str(s["pmDec"]),
            str(round(s["v"] * 100)), str(round(float(s["bv"]) * 100)) if s["bv"] else "", s["spectral"], str(s["plx"]),
        ]))
    name_lines = ",".join(f"{hr}:{name!r}".replace("'", '"') for hr, name in sorted(names.items()))
    out = f"""// GENERATED by scripts/make-star-data.py. Do not edit by hand.
// The stars of visual magnitude {LIMIT} and brighter from the Yale Bright Star Catalogue (Hoffleit and Warren 1991, 5th revised edition, preliminary; ADC/CDS V/50):
// {len(stars)} stars, brightest first. One row a star: HR number | Bayer letter | Flamsteed number | constellation | RA J2000 in tenths of a second of time |
// Dec J2000 in arc-seconds (both the catalogue's own resolution) | proper motion in RA (times cos Dec) and in Dec, milliarcseconds a year | V magnitude times 100 |
// B-V times 100 | spectral class and subclass | parallax in milliarcseconds.

/** The star rows, one per line. */
export const STAR_ROWS = `{chr(10).join(rows)}`;

/** Common names by HR number: our own list, after the IAU Working Group on Star Names. */
export const STAR_NAMES: Readonly<Record<number, string>> = {{ {name_lines} }};
"""
    OUT.write_text(out, encoding="utf-8")
    print(f"wrote {OUT} ({len(stars)} stars, {len(names)} named)")


if __name__ == "__main__":
    main()
