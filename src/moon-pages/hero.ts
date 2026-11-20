// The hero above a moon page's tabs: the planet's edge, and its main moons in an arc, farthest at the top. Disc sizes follow the moons' own diameters, squeezed so a small moon stays visible. No DOM.
import { BODIES, ringReach } from "../facts.ts";
import type { MoonPageHost, PageCard } from "./data.ts";

/** The moons in the hero's arc, farthest from the planet first. Jupiter's four are the Galileans. Saturn's seven are the large named moons. */
export const HERO_ARC: Record<MoonPageHost, readonly string[]> = {
  jupiter: ["callisto", "ganymede", "europa", "io"],
  saturn: ["iapetus", "titan", "rhea", "dione", "tethys", "enceladus", "mimas"],
  uranus: ["oberon", "titania", "umbriel", "ariel", "miranda"],
  neptune: ["nereid", "triton", "proteus", "larissa"],
};

/** A second, smaller row: the named moons the package draws that are not in the arc. Saturn's list is the small moons of the reference; Methone is not drawn here. None of these has a photo map. */
export const HERO_SMALL: Record<MoonPageHost, readonly string[]> = {
  jupiter: ["thebe", "amalthea"],
  saturn: ["pan", "atlas", "prometheus", "pandora", "janus", "epimetheus", "hyperion", "telesto", "calypso", "helene"],
  uranus: [],
  neptune: [],
};

/** Where the painted face is turned, in degrees, so the familiar side of the planet meets the moons. Jupiter's longitude is the package's best-known side, turned so the Great Red Spot sits in the visible half. Saturn's pitch looks over the pole: the near half of the rings, the one drawn in front of the globe, then crosses the lower part of the globe. A negative pitch puts that half on the upper globe and the far half, which the globe hides, on the lower. */
export const HERO_POSE: Record<MoonPageHost, { meridian: number; tilt: number; pitch?: number }> = {
  jupiter: { meridian: 70, tilt: 14 },
  saturn: { meridian: 30, tilt: 26.73, pitch: 22 },
  uranus: { meridian: 10, tilt: 16 },
  neptune: { meridian: 20, tilt: 16 },
};

/**
 * How far a hero planet is zoomed. A tight portrait fits the rings, and Jupiter's faint rings would shrink the globe to a third of the frame, so Jupiter is zoomed until the globe fills it. Saturn's rings are the picture, and stay at 1.
 */
export function heroZoom(host: MoonPageHost): number {
  if (host !== "jupiter") return 1;
  return Math.max(1.06, ringReach(BODIES[host]) * 1.04);
}

/** One moon of the hero: its name, the disc's width in pixels, and the centre as a percent of the hero. */
export interface HeroMoon {
  id: string;
  name: string;
  px: number;
  left: number;
  top: number;
}

/** The hero's moons for one planet, farthest first, in the arc from the upper left down toward the planet's limb. A moon that is not drawn is left out. */
export function heroMoons(cards: readonly PageCard[], host: MoonPageHost, lang: "en" | "ja"): HeroMoon[] {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const chosen = HERO_ARC[host].flatMap((id) => {
    const card = byId.get(id);
    return card === undefined ? [] : [card];
  });
  const max = Math.max(1, ...chosen.map((card) => card.radiusKm));
  const count = chosen.length;
  const largest = count <= 4 ? 132 : count <= 5 ? 120 : 112;
  return chosen.map((card, index) => {
    const even = count <= 1 ? 0 : index / (count - 1);
    // Saturn's first two discs are the large ones. A shared step sets Iapetus on Titan, so the first step is longer.
    const t = host === "saturn" && count > 2 ? (index === 0 ? 0 : 0.34 + 0.66 * ((index - 1) / (count - 2))) : even;
    const share = card.radiusKm / max;
    return {
      id: card.id,
      name: lang === "ja" ? card.name.ja : card.name.en,
      px: Math.max(64, Math.round(largest * share)),
      left: Math.round((16 + even * 12) * 10) / 10,
      top: Math.round((10 + t * 62) * 10) / 10,
    };
  });
}

/** The second row, in list order. Disc sizes follow diameter, with a floor so a small rock stays a disc. Every one is marked estimated: the package has no photo map for these. */
export function heroSmall(cards: readonly PageCard[], host: MoonPageHost, lang: "en" | "ja"): HeroMoon[] {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const chosen = HERO_SMALL[host].flatMap((id) => {
    const card = byId.get(id);
    return card === undefined ? [] : [card];
  });
  const max = Math.max(1, ...chosen.map((card) => card.radiusKm));
  return chosen.map((card) => ({
    id: card.id,
    name: `${lang === "ja" ? card.name.ja : card.name.en}*`,
    px: Math.round(28 * Math.max(0.45, card.radiusKm / max)),
    left: 0,
    top: 0,
  }));
}

export interface HeroCircle { id: string; px: number; diameterKm: number; }

/** The same moons as outline circles at their true diameters, the largest 56 pixels across. */
export function heroScale(cards: readonly PageCard[], host: MoonPageHost): HeroCircle[] {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const chosen = [...HERO_ARC[host], ...HERO_SMALL[host]].flatMap((id) => {
    const card = byId.get(id);
    return card === undefined ? [] : [card];
  });
  const max = Math.max(1, ...chosen.map((card) => card.radiusKm));
  return chosen.map((card) => ({ id: card.id, diameterKm: card.radiusKm * 2, px: Math.max(4, Math.round(56 * (card.radiusKm / max))) }));
}
