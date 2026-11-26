import assert from "node:assert/strict";
import { test } from "node:test";
import { coveredArrowLabel, COVERED_ARROW_WORDS } from "../src/space/covered-words.ts";

test("a covered arrow's screen-reader words come from the string table", () => {
  const parts = { bodies: "Moon, Mars", cover: "Earth", hint: "choose to look at it" };
  assert.equal(coveredArrowLabel("en", parts), "Moon, Mars: Earth is in front. choose to look at it");
  assert.equal(coveredArrowLabel(null, parts), COVERED_ARROW_WORDS["en"]!.replace("{bodies}", parts.bodies).replace("{cover}", parts.cover).replace("{hint}", parts.hint));
  assert.equal(coveredArrowLabel("fr", parts), coveredArrowLabel("en", parts));
  assert.equal(coveredArrowLabel("ja", { bodies: "月, 火星", cover: "地球", hint: "choose to look at it" }), "月, 火星: 地球 の後ろ. choose to look at it");
});
