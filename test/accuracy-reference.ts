import { readFileSync } from "node:fs";
import type { Vec3 } from "../src/vec.ts";

export const refinedMoonReference = JSON.parse(readFileSync(new URL("./data/horizons-refined-moons.json", import.meta.url), "utf8")) as {
  dates: number[];
  moons: Record<string, Vec3[]>;
  plutoCentred: { dates: number[]; nix: Vec3[]; hydra: Vec3[] };
};

/** The original fixtures are retained for the published comparison. These two moons now use Pluto's centre. */
export function moonReference(id: string, ms: number, original: Vec3): Vec3 {
  if (id !== "nix" && id !== "hydra") return original;
  const centred = refinedMoonReference.plutoCentred;
  const row = centred[id][centred.dates.indexOf(ms)];
  if (row === undefined) throw new Error(`no Pluto-centred ${id} vector for ${new Date(ms).toISOString()}`);
  return row;
}
