// The Earth's line look without chikyu-earth, with no browser: the delegate says it has no globe (so the body draws its own outline), and the page's console is told once, after a short grace, why.
// The message waits so that an import of chikyu-earth's element a moment after this one is not reported as missing.
import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import "../src/bodies/earth.ts";
import { delegates } from "../src/scene/store.ts";

const line = () => delegates.get("earth")!.line({ center: "10,20", size: 300 });
const slot = globalThis as { customElements?: unknown };

afterEach(() => {
  mock.timers.reset();
  mock.restoreAll();
  delete slot.customElements;
});

test("a page that has chikyu-earth's element gets its globe and no message", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const info = mock.method(console, "info", () => {});
  const attributes: Record<string, string> = {};
  const globe = { setAttribute: (name: string, value: string) => (attributes[name] = value) };
  slot.customElements = { get: () => class {}, whenDefined: () => new Promise(() => {}) };
  Object.assign(globalThis, { document: { createElement: () => globe } });
  assert.equal(await line(), globe);
  assert.equal(attributes["controls"], "none");
  assert.equal(attributes["zoom-min"], "0.1");
  assert.equal(attributes["zoom-max"], "50");
  mock.timers.tick(5000);
  assert.equal(info.mock.callCount(), 0);
  delete (globalThis as { document?: unknown }).document;
});

test("an element that arrives within the grace is not reported missing", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const info = mock.method(console, "info", () => {});
  assert.equal(await line(), null);
  slot.customElements = { get: () => class {} };
  mock.timers.tick(5000);
  assert.equal(info.mock.callCount(), 0);
});

test("without chikyu-earth the delegate has no globe, and the console is told once after the grace", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const info = mock.method(console, "info", () => {});
  assert.equal(await line(), null, "no element: the body draws its own outline");
  assert.equal(await line(), null);
  assert.equal(info.mock.callCount(), 0, "not at once: the element may be a moment behind");
  mock.timers.tick(2000);
  assert.equal(info.mock.callCount(), 1);
  const [text] = info.mock.calls[0]!.arguments as [string];
  assert.match(text, /plain outline/);
  assert.match(text, /chikyu-earth's element is not on the page/);
  assert.match(text, /@johnmorrisdotca\/chikyu-earth\/element/);
  assert.equal(await line(), null);
  mock.timers.tick(10_000);
  assert.equal(info.mock.callCount(), 1, "once for the page");
});

// The shaded looks, for a page that asked for chikyu-earth's realistic Earth (`earth-from="chikyu"`): the same two cases, its element or none.
const shaded = (time: string | null = null, textureBase: string | null = null) => delegates.get("earth")!.shaded!({ center: "10,20", size: 300, time, textureBase });

test("with chikyu-earth's realistic element on the page the shaded delegate gives it, centred, live when no date is chosen and held at the date when one is", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const info = mock.method(console, "info", () => {});
  const made: { tag: string; attributes: Record<string, string> }[] = [];
  slot.customElements = { get: (tag: string) => (tag === "chikyu-earth-realistic" ? class {} : undefined), whenDefined: () => new Promise(() => {}) };
  Object.assign(globalThis, {
    document: {
      createElement: (tag: string) => {
        const attributes: Record<string, string> = {};
        made.push({ tag, attributes });
        return { setAttribute: (name: string, value: string) => (attributes[name] = value) };
      },
    },
  });
  assert.ok(await shaded());
  assert.deepEqual(made[0], { tag: "chikyu-earth-realistic", attributes: { center: "10,20" } }, "live by the real Sun: no time, no speed");
  assert.ok(await shaded("2026-06-21T12:00:00Z"));
  assert.deepEqual(made[1]!.attributes, { center: "10,20", time: "2026-06-21T12:00:00Z", speed: "0" }, "a chosen date holds the Earth at it");
  assert.ok(await shaded(null, "earth-textures/"));
  assert.deepEqual(made[2]!.attributes, { center: "10,20", "texture-base": "earth-textures/" }, "the pictures come from the folder the page names");
  mock.timers.tick(5000);
  assert.equal(info.mock.callCount(), 0);
  delete (globalThis as { document?: unknown }).document;
});

test("the line globe's element alone is not the realistic Earth: the shaded delegate has none, and the console says which import is missing, once", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const info = mock.method(console, "info", () => {});
  slot.customElements = { get: (tag: string) => (tag === "chikyu-earth" ? class {} : undefined), whenDefined: () => new Promise(() => {}) };
  assert.equal(await shaded(), null, "the body is drawn here");
  assert.equal(await shaded(), null);
  assert.equal(info.mock.callCount(), 0, "not at once: the element may be a moment behind");
  mock.timers.tick(2000);
  assert.equal(info.mock.callCount(), 1);
  const [text] = info.mock.calls[0]!.arguments as [string];
  assert.match(text, /earth-from="chikyu"/);
  assert.match(text, /@johnmorrisdotca\/chikyu-earth\/realistic\/element/);
  mock.timers.tick(10_000);
  assert.equal(info.mock.callCount(), 1, "once for the page");
});
