import { BODIES, lineSvg, system, type BodyId, type LineOptions } from "@johnmorrisdotca/wakusei-planets";
import type { WakuseiBody } from "@johnmorrisdotca/wakusei-planets/element";

const options: LineOptions = { size: 240, time: Date.UTC(2026, 10, 2, 12), moons: true };
const id: BodyId = "jupiter";
const svg: string = lineSvg(id, options);
const io = system("jupiter", options.time ?? 0).moons[0];
console.log(svg.length > 1000, BODIES[id].name.en, io?.id);

export function tilt(element: WakuseiBody): void {
  element.setView({ tilt: 20 });
}

export function misspelt(): string {
  // @ts-expect-error "pluton" is not a body
  return lineSvg("pluton");
}
