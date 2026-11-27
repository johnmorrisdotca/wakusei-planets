import assert from "node:assert/strict";
import { test } from "node:test";
import { tellBodyClick } from "../src/space/body-click.ts";

test("a press tells the page, and preventDefault takes it so the view does not go", () => {
  const target = new EventTarget();
  const heard: unknown[] = [];
  target.addEventListener("wakusei-body-click", (event) => {
    const told = event as CustomEvent;
    heard.push(told.detail);
    assert.equal(told.cancelable, true);
  });
  assert.equal(tellBodyClick(target, { id: "phobos" }), false);
  target.addEventListener("wakusei-body-click", (event) => { event.preventDefault(); });
  assert.equal(tellBodyClick(target, { id: "phobos" }), true);
  assert.deepEqual(heard, [{ id: "phobos" }, { id: "phobos" }]);
});
