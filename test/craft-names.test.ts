// The craft names: no id or name is a body's, and a search finds every craft by every listed name, however it is spaced or punctuated.
import assert from "node:assert/strict";
import { test } from "node:test";
import { BODIES } from "../src/facts.ts";
import { findSpacecraft, SPACECRAFT, SPACECRAFT_IDS } from "../src/spacecraft.ts";

const squash = (text: string): string => text.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");

test("no craft id or name is the id or name of a body", () => {
  const taken = new Map<string, string>();
  for (const [id, body] of Object.entries(BODIES)) for (const word of [id, body.name.en, body.name.ja]) taken.set(squash(word), id);
  for (const id of SPACECRAFT_IDS) {
    const craft = SPACECRAFT[id];
    for (const word of [id, craft.name.en, craft.name.ja, ...(craft.otherNames ?? [])]) assert.equal(taken.get(squash(word)), undefined, `${id}: ${word}`);
  }
});

test("every craft is found by each of its names, and spacing, punctuation and width do not matter", () => {
  for (const id of SPACECRAFT_IDS) {
    const craft = SPACECRAFT[id];
    for (const word of [id, craft.name.en, craft.name.ja, ...(craft.otherNames ?? [])]) {
      assert.ok(findSpacecraft(word).includes(id), `${id}: ${word}`);
      assert.ok(findSpacecraft(word.toUpperCase()).includes(id), `${id}: ${word} upper`);
    }
  }
  assert.deepEqual(findSpacecraft("europa-clipper"), ["europaclipper"]);
  assert.deepEqual(findSpacecraft("  Tesla   Roadster "), ["roadster"]);
  assert.deepEqual(findSpacecraft("ｽﾀｰﾏﾝ"), ["roadster"]);
  assert.deepEqual(findSpacecraft("osiris apex"), ["osirisapex"]);
  assert.deepEqual(findSpacecraft(" - "), []);
  assert.deepEqual(findSpacecraft(""), []);
});
