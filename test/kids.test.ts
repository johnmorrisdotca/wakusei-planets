// The colouring sheets: every sheet draws, in both languages and on every paper, with thick lines, three facts worked out from the package's numbers, and text that fits its room.
import assert from "node:assert/strict";
import { test } from "node:test";
import { PAGE_NAMES, TYPE_PRESETS } from "@johnmorrisdotca/kazoku-ui/print";
import { BODIES } from "../src/facts.ts";
import { KIDS_BODIES, KIDS_SHEETS, LINEUP_IDS, SWATCHES, earthsWide, kidsFacts, kidsName, lineupFacts, moonPeriodDays, widthKm, yearDays } from "../src/kids/data.ts";
import { LINE_MM, OUTLINE_MM } from "../src/kids/picture.ts";
import { kidsOrientation, kidsRoom, kidsSvg, textWidth, wrap } from "../src/kids/svg.ts";

const LANGS = ["en", "ja"] as const;
const numbers = (svg: string, attribute: string): number[] => [...svg.matchAll(new RegExp(`${attribute}="(-?[\\d.]+)"`, "g"))].map((m) => Number(m[1]));
/** The text of a sheet with the place each line has on the page, adding the `translate` of the group it is in. */
const texts = (svg: string): { x: number; y: number; size: number; anchor: string; body: string }[] =>
  [...svg.matchAll(/<text x="(-?[\d.]+)" y="(-?[\d.]+)" font-size="([\d.]+)"([^>]*)>([^<]*)<\/text>/g)].map((m) => {
    const moved = [...svg.slice(0, m.index).matchAll(/<g transform="translate\(0 (-?[\d.]+)\)">/g)].at(-1);
    return { x: Number(m[1]), y: Number(m[2]) + Number(moved?.[1] ?? 0), size: Number(m[3]), anchor: /text-anchor="(\w+)"/.exec(m[4]!)?.[1] ?? "start", body: m[5]! };
  });

test("there is a sheet for the Sun, the eight planets, Pluto, the Moon and the big moons, and the lineup", () => {
  assert.deepEqual(KIDS_BODIES, ["sun", "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "moon", "io", "europa", "ganymede", "callisto", "titan", "triton", "charon"]);
  assert.equal(KIDS_SHEETS.length, KIDS_BODIES.length + 1);
  assert.equal(KIDS_SHEETS.at(-1), "lineup");
  assert.equal(kidsOrientation("lineup"), "landscape");
  assert.equal(kidsOrientation("saturn"), "portrait");
});

test("every sheet renders on every paper, in both languages, drawn for the room it has", () => {
  for (const page of PAGE_NAMES) {
    for (const id of KIDS_SHEETS) {
      const room = kidsRoom(page, kidsOrientation(id));
      for (const lang of LANGS) {
        const svg = kidsSvg(id, { ...room, lang });
        assert.ok(svg.startsWith("<svg") && svg.endsWith("</svg>"), `${id} ${page} ${lang}`);
        assert.ok(svg.includes(`viewBox="0 0 ${Math.round(room.widthMm * 100) / 100} ${Math.round(room.heightMm * 100) / 100}"`), `${id} ${page}: the viewBox is the room`);
        assert.ok(!/NaN|undefined|Infinity/.test(svg), `${id} ${page} ${lang} has a bad number`);
        assert.ok(svg.includes(`data-kids-sheet="${id}"`));
      }
    }
  }
});

test("every line of a colouring picture is at least 2.5 mm thick, the outline 3 mm", () => {
  assert.equal(OUTLINE_MM, TYPE_PRESETS.kid.lineMm);
  assert.ok(LINE_MM >= 2.5);
  for (const id of KIDS_BODIES) {
    const svg = kidsSvg(id, { ...kidsRoom("a4"), lang: "en" });
    const widths = numbers(svg, "stroke-width");
    assert.ok(widths.length >= 5, `${id} has lines`);
    assert.ok(Math.min(...widths) >= 2.5, `${id}: thinnest line ${Math.min(...widths)} mm`);
    assert.ok(Math.max(...widths) <= 3, id);
    assert.ok(svg.includes(`stroke-width="${OUTLINE_MM}"`), `${id} has its 3 mm outline`);
  }
});

test("a sheet has three facts, in plain words, in each language", () => {
  for (const id of KIDS_BODIES) {
    for (const lang of LANGS) {
      const facts = kidsFacts(id, lang);
      assert.equal(facts.length, 3, `${id} ${lang}`);
      for (const fact of facts) assert.ok(fact.length > 12 && !/NaN|undefined/.test(fact), `${id} ${lang}: ${fact}`);
      assert.equal(new Set(facts).size, 3);
    }
  }
});

test("the facts are worked out from the numbers", () => {
  assert.equal(widthKm("jupiter"), 143000);
  assert.ok(Math.abs(earthsWide("jupiter") - 11.2) < 0.05);
  assert.ok(Math.abs(yearDays("mars") - 687) < 1 && Math.abs(yearDays("earth") - 365.25) < 0.01 && Math.abs(yearDays("neptune") / 365.25 - 165) < 1);
  assert.ok(Math.abs(moonPeriodDays("moon") - 27.32) < 0.01 && Math.abs(moonPeriodDays("io") - 1.77) < 0.01);
  assert.deepEqual(kidsFacts("jupiter", "en"), ["143,000 km across: 11 times as wide as Earth.", "It spins once in 9.9 hours.", "It goes around the Sun in 12 years."]);
  assert.deepEqual(kidsFacts("moon", "en"), ["3,470 km across. Earth is 3.7 times wider.", "It goes around Earth in 27.3 days.", "It always shows the same face to Earth."]);
  assert.ok(kidsFacts("venus", "en")[1]!.includes("backwards") && kidsFacts("triton", "en")[1]!.includes("backwards"));
  assert.ok(kidsFacts("neptune", "ja")[2]!.includes("165ねん"));
  assert.equal(kidsName("saturn", "ja"), "どせい（土星）");
  assert.equal(kidsName("io", "ja"), "イオ");
});

test("the colours to colour with are real colours, a few for each body", () => {
  for (const id of KIDS_BODIES) {
    assert.ok(SWATCHES[id].length >= 2 && SWATCHES[id].length <= 4, id);
    for (const one of SWATCHES[id]) assert.ok(/^#[0-9a-f]{6}$/.test(one.hex) && one.en !== "" && one.ja !== "", `${id} ${one.hex}`);
  }
  for (const id of ["sun", "mercury", "venus", "earth", "mars", "pluto"] as const) assert.equal(SWATCHES[id][0]!.hex, BODIES[id].colour, `${id} starts with the body's own colour`);
});

test("the text fits: every line is inside the room, in type no smaller than the kid preset says, and no two lines of text run into each other", () => {
  const body = (TYPE_PRESETS.kid.bodyPt * 25.4) / 72;
  for (const page of ["a4", "letter"] as const) {
    for (const id of KIDS_SHEETS) {
      const room = kidsRoom(page, kidsOrientation(id));
      for (const lang of LANGS) {
        const svg = kidsSvg(id, { ...room, lang });
        const lines = texts(svg).filter((one) => one.body.length > 1);
        assert.ok(lines.length >= 3, `${id}: text found`);
        for (const line of lines) {
          const width = textWidth(line.body, line.size);
          const left = line.anchor === "middle" ? line.x - width / 2 : line.x;
          assert.ok(left >= -0.01 && left + width <= room.widthMm + 0.01, `${id} ${page} ${lang}: "${line.body}" is ${width.toFixed(1)} mm wide at ${left.toFixed(1)}, the room is ${room.widthMm}`);
          assert.ok(line.y <= room.heightMm + 0.01 && line.y - line.size >= -0.01, `${id} ${page} ${lang}: "${line.body}" is outside the room (y ${line.y})`);
          assert.ok(line.size >= body - 0.01, `${id}: "${line.body}" is ${line.size} mm, under the body size`);
        }
        const rows = [...new Set(lines.map((one) => Math.round(one.y * 10) / 10))].sort((a, b) => a - b);
        for (let i = 1; i < rows.length; i += 1) assert.ok(rows[i]! - rows[i - 1]! >= body, `${id} ${page} ${lang}: two lines of text are ${(rows[i]! - rows[i - 1]!).toFixed(1)} mm apart`);
      }
    }
  }
});

test("the picture is big: a body's disc is at least 70 mm across on a Letter sheet (30 mm for the ringed ones, whose rings take the width, and 55 for the Sun, with its rays)", () => {
  for (const id of KIDS_BODIES) {
    const svg = kidsSvg(id, { ...kidsRoom("letter"), lang: "en" });
    const [rx] = numbers(svg.slice(svg.indexOf("<ellipse")), "rx");
    assert.ok(rx! * 2 >= (id === "saturn" || id === "uranus" ? 30 : id === "sun" ? 55 : 70), `${id}: its disc is ${(rx! * 2).toFixed(0)} mm across`);
  }
});

test("the lineup draws the eight planets left to right at one scale, numbered in order, and its Sun fact follows from the scale", () => {
  const room = kidsRoom("a4", "landscape");
  const svg = kidsSvg("lineup", { ...room, lang: "en" });
  const badges = [...svg.matchAll(/<circle cx="(-?[\d.]+)" cy="[\d.]+" r="[\d.]+" fill="#000" data-badge="(\d)"/g)].map((m) => [Number(m[1]), Number(m[2])] as const);
  assert.deepEqual(badges.map((b) => b[1]), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(badges.map((b) => b[0]), [...badges.map((b) => b[0])].sort((a, b) => a - b));
  for (let i = 1; i < badges.length; i += 1) assert.ok(badges[i]![0] - badges[i - 1]![0] >= 8.5, `numbers ${i} and ${i + 1} are ${(badges[i]![0] - badges[i - 1]![0]).toFixed(1)} mm apart`);
  assert.deepEqual([...svg.matchAll(/data-body="(\w+)"/g)].map((m) => m[1]), [...LINEUP_IDS]);
  const radii = svg.split('<g data-body="').slice(1).map((part) => [/^\w+/.exec(part)![0], Number(/<ellipse cx="[\d.]+" cy="[\d.]+" rx="([\d.]+)"/.exec(part)![1])] as const);
  const jupiter = radii.find((r) => r[0] === "jupiter")![1];
  for (const [id, rx] of radii) assert.ok(Math.abs(rx / jupiter - BODIES[id as "mars"].radiusKm / BODIES.jupiter.radiusKm) < 0.02, `${id} is drawn at the same scale as Jupiter`);
  const k = jupiter / BODIES.jupiter.radiusKm;
  const sun = lineupFacts("en", k)[2]!;
  assert.ok(sun.includes(`${Math.round((BODIES.sun.radiusKm * 2 * k) / 10)} cm`), sun);
  assert.equal(lineupFacts("en", k)[0], "Biggest: Jupiter, 11 times as wide as Earth.");
  assert.equal(lineupFacts("en", k)[1], "Smallest: Mercury.");
  for (const [page, lang] of [["a4", "en"], ["a4", "ja"], ["letter", "en"], ["letter", "ja"]] as const) {
    const wide = kidsSvg("lineup", { ...kidsRoom(page, "landscape"), lang });
    const across = Number(/data-body="jupiter"><ellipse cx="[\d.]+" cy="[\d.]+" rx="([\d.]+)"/.exec(wide)![1]) * 2;
    assert.ok(across >= 25, `${page} ${lang}: Jupiter is ${across.toFixed(0)} mm across`);
  }
});

test("a sentence wraps at spaces (English) or after a full stop (Japanese) and never runs past the width", () => {
  const text = "It goes around the Sun in 12 years and then does it again.";
  const lines = wrap(text, 80, 6.35);
  assert.ok(lines.length >= 2 && lines.join(" ") === text);
  for (const line of lines) assert.ok(textWidth(line, 6.35) <= 80);
  for (const line of wrap("よこはば 143,000km。ちきゅうの ほうが 11ばい おおきい。たいように 1しゅう。", 100, 6.35)) assert.ok(textWidth(line, 6.35) <= 100, line);
});
