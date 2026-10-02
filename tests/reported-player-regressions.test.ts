// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("a text-sync read failure remains visible as feedback instead of vanishing", () => {
  const hook = read("src/views/player/hooks/use-text-sync.ts");
  const player = read("src/views/player.tsx");

  assert.match(hook, /Promise<string \| null>/);
  assert.match(hook, /return res\.reason;/);
  assert.match(hook, /catch \(e\)[\s\S]*return reason;/);
  assert.match(player, /textSync\.enter\(src\.url, src\.headers\)\.then\(\(reason\) =>/);
  assert.match(player, /showSyncToast\("error"/);
});

test("leaving fullscreen restores the prior window state on the window thread", () => {
  const source = read("src-tauri/src/fullscreen.rs");

  assert.match(source, /let maximized = main\.is_maximized\(\)\.unwrap_or\(false\);/);
  assert.match(source, /maximized,/);
  assert.match(source, /app\.run_on_main_thread\(move \|\| \{/);
  assert.match(source, /exit_fullscreen\(main, saved, restore_position\.unwrap_or\(true\)\)/);
  assert.doesNotMatch(source, /tokio::time::sleep/);
  const exit = source.slice(source.indexOf("fn exit_fullscreen("));
  assert.ok(
    exit.indexOf("main.set_fullscreen(false)") < exit.indexOf("saved.lock().unwrap().take()"),
  );
  assert.match(source, /if saved\.maximized \{[\s\S]*main\.maximize\(\)/);
  assert.match(source, /PhysicalSize \{[\s\S]*width: geo\.w,[\s\S]*height: geo\.h/);
});

test("the enabled clock is also rendered in windowed playback", () => {
  const controls = read("src/components/player/transport/control-renderer.tsx");
  const localTime = controls.slice(controls.indexOf('case "local-time":'));

  assert.match(localTime, /return \([\s\S]*<FullscreenClock/);
  assert.doesNotMatch(
    localTime.slice(0, localTime.indexOf('case "time-start":')),
    /ctx\.fullscreen \?/,
  );
});
