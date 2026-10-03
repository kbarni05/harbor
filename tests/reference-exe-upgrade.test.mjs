import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readJson = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url), "utf8"));

test("the reference upgrade consistently declares 0.9.129", () => {
  for (const name of [
    "package.json",
    "src-tauri/tauri.conf.json",
    "installer/package.json",
    "installer/src-tauri/tauri.conf.json",
  ]) {
    assert.equal(readJson(name).version, "0.9.129", name);
  }
  assert.ok(readJson("src/lib/updater/bundled-release-notes.json").notes["0.9.129"]);
});

test("the supplied working installer policy is retained", () => {
  const config = readJson("src-tauri/tauri.conf.json");
  assert.equal(config.bundle.windows.nsis.installMode, "currentUser");
  assert.equal(config.bundle.windows.nsis.installerHooks, "./installer-hooks.nsh");
  assert.equal(config.bundle.windows.webviewInstallMode, undefined);
  assert.equal(readJson("src-tauri/tauri.windows.conf.json").bundle.windows, undefined);
  assert.equal(
    readJson("src-tauri/tauri.reference-windows.conf.json").bundle.resources["resources/capstan/"],
    null,
  );
});

test("the reference provenance is explicit and excludes the additional custom branch", () => {
  const report = readJson("docs/reference-exe-reconstruction.json");
  assert.equal(
    report.referenceSha256,
    "c5f295521b259d3cec98d6ad06ee12e8024816158ca2c5402d086ea3272d255e",
  );
  assert.equal(report.mainNamedFunctionComparison.missing, 0);
  assert.equal(report.mainNamedFunctionComparison.changed, 0);
  assert.match(report.customSourceChanges, /no separate Hungarian\/player branch merged/);
});
