import { BODIES } from "../facts.ts";
import { LUMINOSITY_CLASSES, starLook, validateStarNumbers, type StarLook, type StarNumberName, type StarNumbers } from "../star.ts";
import type { Item } from "./model.ts";

const NUMBERS = ["rotationDays", "activity", "oblateness", "inclinationDeg", "corona", "variablePeriodDays", "variableAmplitude"] as const;
const ESTIMATES: readonly StarNumberName[] = ["temperatureK", "radiusSun", "luminosityClass", "rotationDays", "oblateness", "inclinationDeg", "variablePeriodDays", "variableAmplitude"];

/** Read a star from plain scene data. Copy only fields understood by the star renderer. */
export function portraitStar(value: unknown): StarNumbers | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  if (typeof raw.temperatureK !== "number" || typeof raw.radiusSun !== "number") return undefined;
  const star: StarNumbers = { temperatureK: raw.temperatureK, radiusSun: raw.radiusSun };
  if (typeof raw.name === "string") star.name = raw.name;
  const cls = LUMINOSITY_CLASSES.find((one) => one === raw.luminosityClass);
  if (raw.luminosityClass !== undefined && cls === undefined) return undefined;
  if (cls !== undefined) star.luminosityClass = cls;
  for (const key of NUMBERS) {
    const n = raw[key];
    if (n === undefined) continue;
    if (typeof n !== "number") return undefined;
    star[key] = n;
  }
  const estimated = raw.estimated;
  if (estimated !== undefined) {
    if (!Array.isArray(estimated)) return undefined;
    star.estimated = ESTIMATES.filter((key) => estimated.includes(key));
  }
  try {
    validateStarNumbers(star);
    return star;
  } catch (error) {
    if (error instanceof RangeError) return undefined;
    throw error;
  }
}

/** Percent-encode the JSON record, including the character that separates scene fields. */
export const encodePortraitStar = (star: StarNumbers): string => encodeURIComponent(JSON.stringify(star)).replace(/~/g, "%7E");

export function decodePortraitStar(text: string): StarNumbers | undefined {
  let value: unknown;
  try {
    value = JSON.parse(decodeURIComponent(text));
  } catch {
    return undefined;
  }
  return portraitStar(value);
}

const looks = new WeakMap<StarNumbers, StarLook>();

/** The scene keeps the same numbers while moving or turning an item. */
export function portraitStarLook(numbers: StarNumbers): StarLook {
  let made = looks.get(numbers);
  if (made === undefined) {
    made = starLook(numbers);
    looks.set(numbers, made);
  }
  return made;
}

export function itemName(item: Pick<Item, "body" | "star">, lang: "en" | "ja"): string {
  if (item.star === undefined) return BODIES[item.body].name[lang];
  return item.star.name?.trim() || (lang === "ja" ? "恒星" : "Star");
}
