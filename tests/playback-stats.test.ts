// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
import { loadSource } from "../scripts/benchmark-name-sync.mjs";

async function renderStats(values: Record<string, number>) {
  let stats: unknown;
  let effect: (() => void) | undefined;
  const requested: string[] = [];
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { __TAURI_INTERNALS__: {}, setInterval: () => 1, clearInterval: () => {} },
  });
  try {
    const { StatsOverlay } = loadSource(
      readFileSync("src/components/player/stats-overlay.tsx", "utf8"),
      {
        react: {
          useState: (initial: unknown) => [stats ?? initial, (next: unknown) => (stats = next)],
          useEffect: (fn: () => void) => (effect = fn),
        },
        "react/jsx-runtime": {
          jsx: (type: unknown, props: unknown) => ({ type, props }),
          jsxs: (type: unknown, props: unknown) => ({ type, props }),
        },
        "@tauri-apps/api/core": {
          invoke: async (command: string) => {
            requested.push(command);
            return values;
          },
        },
        "@/lib/i18n": { useT: () => (value: string) => value },
      },
    );
    const props = {
      snap: { audioTracks: [], subtitleTracks: [], rate: 1, volume: 1 },
      engine: "mpv",
    };
    StatsOverlay(props);
    effect?.();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    return { requested, rendered: JSON.stringify(StatsOverlay(props)) };
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

test("playback stats distinguish decoder drops from video-output drops", async () => {
  const result = await renderStats({ decoderFrameDrops: 3, outputFrameDrops: 7 });
  assert.deepEqual(result.requested, ["mpv_playback_stats"]);
  assert.ok(!result.requested.includes("vo-drop-frame-count"));
  assert.ok(result.rendered.includes("3 / 7"));
});

test("unavailable drop counters are not reported as measured zero", async () => {
  const result = await renderStats({ outputFrameDrops: 7 });
  assert.ok(result.rendered.includes("— / 7"));
  const decoderOnly = await renderStats({ decoderFrameDrops: 3 });
  assert.ok(decoderOnly.rendered.includes("3 / —"));
});

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
test("the stats overlay asks the backend for one complete snapshot", () => {
  const overlay = read("src/components/player/stats-overlay.tsx");

  assert.match(overlay, /invoke<MpvPlaybackStats>\("mpv_playback_stats"\)/);
  assert.doesNotMatch(overlay, /getProp\(/);
  assert.match(overlay, /Streaming & renderer/);
  assert.match(overlay, /Source colour/);
  assert.match(overlay, /Cached data/);
});

test("the backend exposes safe detailed data from the active mpv session", () => {
  const backend = read("src-tauri/src/mpv.rs");
  const registry = read("src-tauri/src/lib.rs");

  assert.match(backend, /pub async fn mpv_playback_stats/);
  assert.match(backend, /pub struct MpvPlaybackStats/);
  assert.match(backend, /decoder-frame-drop-count/);
  assert.match(backend, /demuxer-cache-state/);
  assert.match(backend, /video-target-params\/gamma/);
  assert.match(registry, /mpv::mpv_playback_stats/);
});
