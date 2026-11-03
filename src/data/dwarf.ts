// The dwarf planets besides Pluto: where each is, and the few moons whose orbits are published with a date.
// Positions: JPL Small-Body Database, osculating elements at JD 2461200.5 (2026-06-09 00:00 UTC), ecliptic and equinox J2000, as read from https://ssd.jpl.nasa.gov/api/sbdb.api on 2026-11-03
// (a in au, angles in degrees, `n` the mean motion in degrees a day). Run as a plain ellipse they are good for a few years either side of that epoch (Ceres, pulled by Jupiter, drifts most).
import type { DwarfId } from "../facts.ts";
import type { OrbitElements } from "./orbits.ts";

/** The osculating heliocentric elements of one epoch. */
export interface Osculating {
  /** Milliseconds since 1970. */
  epoch: number;
  a: number;
  e: number;
  i: number;
  node: number;
  w: number;
  m: number;
  n: number;
}

const epoch = 1780963200000;

export const DWARF_ELEMENTS: Readonly<Record<DwarfId, Osculating>> = {
  ceres: { epoch, a: 2.765552595034094, e: 0.07969229514816586, i: 10.58802780183462, node: 80.24862682043221, w: 73.29421453021587, m: 274.4193463761342, n: 0.21430445064843 },
  orcus: { epoch, a: 39.37686537914865, e: 0.2205240628250881, i: 20.55681019612, node: 268.4053519455824, w: 73.56848606705262, m: 189.0972913554275, n: 0.003988800931399829 },
  haumea: { epoch, a: 43.06029023650952, e: 0.1944430148898797, i: 28.20847393040364, node: 121.7860561329425, w: 240.6905472508661, m: 223.2104118812299, n: 0.003488097731816818 },
  quaoar: { epoch, a: 43.15617622670811, e: 0.03520019261837198, i: 7.991575800732639, node: 188.9191248092036, w: 163.209046106457, m: 292.8487574842713, n: 0.003476479214379914 },
  makemake: { epoch, a: 45.57093317300052, e: 0.1588889953992523, i: 29.02785603743067, node: 79.2948338209406, w: 297.0922733397207, m: 169.9379962048232, n: 0.003203850120050116 },
  gonggong: { epoch, a: 66.86666567773766, e: 0.5042510000302973, i: 30.89906721170288, node: 336.8383156185827, w: 206.6232839773693, m: 111.664541568459, n: 0.001802559348482343 },
  eris: { epoch, a: 67.93394687853566, e: 0.4382385347971672, i: 43.9258279471791, node: 36.00477044417249, w: 150.7949235840312, m: 211.774434275007, n: 0.001760247770619088 },
  sedna: { epoch, a: 543.7195289104732, e: 0.8598824585187618, i: 11.92527582847476, node: 144.5061662673739, w: 311.0987725939751, m: 358.5956944005428, n: 7.773948799642578e-05 },
};

// Moons of the dwarf planets whose orbit is published with an epoch, so they can be put where they are on a date. Moons with no published phase are left out (Weywot, Xiangliu, S/2015 (136472) 1).
// Dysnomia: Holler, Grundy, Buie & Noll (2021), "The Eris/Dysnomia system I: The orbit of Dysnomia", Icarus 355:114130, Table 2 (combined fit; epoch JD 2453979.0; the angles are to the J2000 equator;
//   the table gives the longitude of periapsis 307 and the mean longitude 125.78, so the argument of periapsis is 307 - 126.17 and the mean anomaly 125.78 - 307). Period 15.785899 days.
// Hiʻiaka and Namaka: Ragozzine & Brown (2009), "Orbits and Masses of the Satellites of the Dwarf Planet Haumea (2003 EL61)", AJ 137:4766, Table 2: osculating elements at HJD 2454615.0, J2000 ecliptic,
//   the periods from their section III.1. The two moons pull on each other, so a plain ellipse from 2008 is only roughly right years later.
// Vanth: Brown, Ragozzine, Stansberry & Fraser (2010), "The Size, Density, and Formation of the Orcus-Vanth System in the Kuiper Belt", AJ 139:2700, Table 2, solution 1 of the two mirror solutions
//   (epoch JD 2454439.280, J2000 ecliptic, a circle). Period 9.5393 days.
export const DWARF_MOON_ORBITS: Record<string, OrbitElements> = {
  dysnomia: { parent: "eris", frame: "j2000", epoch: 1157025600000, a: 37273, e: 0.0062, w: 180.83, m: 178.78, i: 45.49, node: 126.17, sid: 22.8051630, dw: 0, dn: 0 },
  hiiaka: { parent: "haumea", frame: "ecliptic", epoch: 1211976000000, a: 49880, e: 0.0513, w: 154.1, m: 152.8, i: 126.356, node: 206.766, sid: 7.2783147, dw: 0, dn: 0 },
  namaka: { parent: "haumea", frame: "ecliptic", epoch: 1211976000000, a: 25657, e: 0.249, w: 178.9, m: 178.5, i: 113.013, node: 205.016, sid: 19.6954859, dw: 0, dn: 0 },
  vanth: { parent: "orcus", frame: "ecliptic", epoch: 1196793792000, a: 8980, e: 0, w: 0, m: 143.1, i: 90.2, node: 50.0, sid: 37.7386181, dw: 0, dn: 0 },
};
