// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const source = readFileSync(
  new URL("../src/lib/use-localized-overview.ts", import.meta.url),
  "utf8",
);

test("a metadata language is independent from the display language", () => {
  assert.match(source, /settings\.tmdbLanguage && settings\.translateDescriptions/);
  assert.match(source, /\^tt\\d\+\$/);
  assert.match(source, /tmdbIdFromImdb\(request\.key, request\.id, request\.type\)/);
  assert.match(source, /tmdbMetadataOverview\(request\.key, id, request\.language\)/);
  assert.match(source, /preferredMeta\?\.description \|\| meta\.description/);
});
