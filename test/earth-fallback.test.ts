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
  const globe = { setAttribute() {} };
  slot.customElements = { get: () => class {}, whenDefined: () => new Promise(() => {}) };
  Object.assign(globalThis, { document: { createElement: () => globe } });
  assert.equal(await line(), globe);
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
