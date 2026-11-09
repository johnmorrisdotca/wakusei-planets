// How long a close-approach search takes: `node scripts/bench-nearest.ts`. Each search is run five times after one to warm up, and the median is printed. Not part of the tests (the machine decides the numbers).
import "../src/tables/all.ts";
import { closestApproach, conjunctions, nearest } from "../src/nearest.ts";

const year = { from: Date.UTC(2023, 0, 1), to: Date.UTC(2024, 0, 1) };
const median = (run: () => unknown): number => {
  run();
  const times = Array.from({ length: 5 }, () => {
    const start = performance.now();
    run();
    return performance.now() - start;
  }).sort((a, b) => a - b);
  return times[2]!;
};

const rows: Array<[string, () => unknown]> = [
  ["nearest to Jupiter, every body, one date", () => nearest("jupiter", { date: Date.UTC(2023, 2, 2), count: 10 })],
  ["closestApproach, Venus and Jupiter, one year", () => closestApproach("venus", "jupiter", year)],
  ["conjunctions, the Sun and the planets (8 bodies, 28 pairs), one year", () => conjunctions(year)],
  ["conjunctions, the Moon and 3 planets, one year", () => conjunctions({ ...year, bodies: ["moon", "venus", "mars", "jupiter"], within: 5 })],
  ["conjunctions, Jupiter and its four moons, one year", () => conjunctions({ ...year, bodies: ["jupiter", "io", "europa", "ganymede", "callisto"], within: 1 })],
];
console.log(`node ${process.version}`);
for (const [name, run] of rows) console.log(`${median(run).toFixed(1).padStart(8)} ms  ${name}`);
