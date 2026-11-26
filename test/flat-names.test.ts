// MODULES-1873: a moving moon's dot was painted on the canvas above the map, so it covered a place's name. The names are painted after those dots.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { paintFlatLabels, type FlatLabel } from "../src/flat/namePaint.ts";

test("a name is stroked and then filled, and an empty list paints nothing", () => {
  const calls: string[] = [];
  const ctx = {
    font: "",
    textBaseline: "alphabetic" as CanvasTextBaseline,
    textAlign: "start" as CanvasTextAlign,
    lineWidth: 0,
    lineJoin: "miter" as CanvasLineJoin,
    strokeStyle: "",
    fillStyle: "",
    strokeText(text: string, x: number, y: number): void {
      calls.push(`stroke ${text} ${x} ${y} ${this.textAlign}`);
    },
    fillText(text: string, x: number, y: number): void {
      calls.push(`fill ${text} ${x} ${y} ${this.textAlign}`);
    },
  };
  paintFlatLabels(ctx as unknown as CanvasRenderingContext2D, []);
  assert.deepEqual(calls, []);
  const labels: FlatLabel[] = [
    { text: "Pavonis Mons", x: 12, y: 40, align: "left" },
    { text: "Deimos", x: 80, y: 20, align: "right" },
  ];
  paintFlatLabels(ctx as unknown as CanvasRenderingContext2D, labels);
  assert.deepEqual(calls, ["stroke Pavonis Mons 12 40 left", "fill Pavonis Mons 12 40 left", "stroke Deimos 80 20 right", "fill Deimos 80 20 right"]);
  assert.equal(ctx.textAlign, "left");
});

test("the places' names are painted on the moving canvas, after the moving marks", () => {
  const src = readFileSync(new URL("../src/flat/element.ts", import.meta.url), "utf8");
  const draw = src.slice(src.indexOf("  #draw(): void {"), src.indexOf("  #placeMoons"));
  const marks = draw.indexOf("this.#drawCustoms(ctx);");
  const names = draw.indexOf("this.#paintPlaceNames(ctx);");
  assert.ok(marks > 0, "the moving marks are drawn in the frame");
  assert.ok(names > marks, "the places' names are painted after the moving marks");
  const laidOut = src.slice(src.indexOf("  #drawMarks("), src.indexOf("  #syncFlags("));
  assert.equal(laidOut.includes("strokeText"), false, "the places' names are not painted on the map canvas, under the dots");
  assert.equal(laidOut.includes("this.#placeLabels = labels"), true, "the names are kept for the later paint");
});
