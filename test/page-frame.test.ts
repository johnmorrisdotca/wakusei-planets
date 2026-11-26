// The build puts kazoku-ui's page frame into every demo page. The checker's comment is only the marker the build replaces.
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderBuilder, renderEmbed, renderIndex } from "../scripts/page.ts";

test("the home page says what it is and credits its data", () => {
  const html = renderIndex();
  assert.match(html, /<kazoku-page-header/);
  assert.match(html, /<kazoku-page-credits/);
  assert.doesNotMatch(html, /<!--frame:/);
  assert.match(html, /data-host="jupiter"[\s\S]*?<wakusei-body body="jupiter"/);
  assert.match(html, /data-host="jupiter"[\s\S]*?<wakusei-body body="ganymede"/);
});

test("the embed credits its data and has no page header", () => {
  const html = renderEmbed();
  assert.match(html, /<kazoku-page-credits/);
  assert.doesNotMatch(html, /<kazoku-page-header/);
  assert.doesNotMatch(html, /<!--frame:/);
});

test("the code builder says what it is", () => {
  const html = renderBuilder();
  assert.match(html, /<kazoku-page-header/);
  assert.match(html, /<kazoku-page-credits/);
});
