// moonAge is days since the previous new moon. The noon age is that number at 03:00 UTC (noon in Japan), rounded to one decimal, held to the National Astronomical Observatory's almanac
// (暦象年表 令和8年 / 2026, the January Moon table, column 月齢, read from the published PDF). moonPhaseName uses the same office's table of looks (https://www.nao.ac.jp/faq/a0201.html):
// 新月, 三日月, 上弦, 満月, 下弦. The fat waxing Moon, the fat waning Moon and the thin Moon lit on its eastern side have no name there.
import assert from "node:assert/strict";
import { test } from "node:test";
import { moonAge, moonPhaseName, moonPhases } from "../src/sky.ts";

/** Noon in Japan on a day of January 2026, and the almanac's noon age. */
const NOON = [
  [1, 12.1],
  [18, 29.1],
  [19, 0.3],
  [31, 12.3],
] as const;

test("January 2026 noon ages match the Observatory's almanac to the tenth it prints", () => {
  for (const [day, printed] of NOON) {
    const age = moonAge(Date.UTC(2026, 0, day, 3, 0));
    assert.equal(Math.round(age * 10) / 10, printed, `January ${day}: ${age}`);
  }
});

test("the age is 0 at a new moon and about one day later a day later", () => {
  const born = moonPhases(Date.UTC(2026, 0, 1), Date.UTC(2026, 1, 1)).find((event) => event.phase === "new")!.time;
  assert.ok(Math.abs(moonAge(born)) < 1e-9);
  const later = moonAge(born.getTime() + 86_400_000);
  assert.ok(later > 0.99 && later < 1.01, String(later));
  assert.equal(moonAge(born), moonAge(new Date(born.getTime())));
  assert.throws(() => moonAge(Number.NaN), RangeError);
});

test("the eight English looks, and Japanese only where the Observatory names the look", () => {
  const year = moonPhases(Date.UTC(2026, 0, 1), Date.UTC(2026, 2, 1));
  const at = (phase: string) => year.find((event) => event.phase === phase)!.time;
  const named: Record<string, string> = { new: "新月", firstQuarter: "上弦", full: "満月", lastQuarter: "下弦" };
  const english: Record<string, string> = { new: "new moon", firstQuarter: "first quarter", full: "full moon", lastQuarter: "last quarter" };
  for (const phase of Object.keys(named)) {
    assert.equal(moonPhaseName(at(phase), "en"), english[phase]);
    assert.equal(moonPhaseName(at(phase), "ja"), named[phase]);
  }
  const newer = at("new").getTime();
  const quarter = year.find((event) => event.phase === "firstQuarter" && event.time.getTime() > newer)!.time.getTime();
  const full = year.find((event) => event.phase === "full" && event.time.getTime() > quarter)!.time.getTime();
  const last = year.find((event) => event.phase === "lastQuarter" && event.time.getTime() > full)!.time.getTime();
  const nextNew = year.find((event) => event.phase === "new" && event.time.getTime() > last)!.time.getTime();
  assert.equal(moonPhaseName(newer + (quarter - newer) / 2, "en"), "waxing crescent");
  assert.equal(moonPhaseName(newer + (quarter - newer) / 2, "ja"), "三日月");
  assert.equal(moonPhaseName(quarter + (full - quarter) / 2, "en"), "waxing gibbous");
  assert.equal(moonPhaseName(quarter + (full - quarter) / 2, "ja"), null);
  assert.equal(moonPhaseName(full + (last - full) / 2, "en"), "waning gibbous");
  assert.equal(moonPhaseName(full + (last - full) / 2, "ja"), null);
  assert.equal(moonPhaseName(last + (nextNew - last) / 2, "en"), "waning crescent");
  assert.equal(moonPhaseName(last + (nextNew - last) / 2, "ja"), null);
  assert.throws(() => moonPhaseName(newer, "fr" as "en"), RangeError);
});
