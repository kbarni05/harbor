import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { suwayomiAuthFor } from "@/lib/manga/sources/suwayomi/auth-registry";
import { useSettings } from "@/lib/settings";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type HarborFetchResponse = {
  status: number;
  ok: boolean;
  body: string;
  contentType?: string | null;
  headers?: Record<string, string>;
};

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Remote plain-HTTP images are blocked by the WebView as mixed content: the app
// page is a secure context, so http://localhost is exempt but http://<remote>
// is refused (https is fine). Route those through the Rust side and hand back a
// same-origin blob URL. Covers e.g. a Suwayomi server hosted on a VPS over HTTP.
export function needsImageProxy(url: string): boolean {
  if (!isTauri) return false;
  // An <img> tag cannot send an Authorization header, so any server behind
  // basic auth must be fetched through Rust regardless of scheme.
  if (suwayomiAuthFor(url)) return true;
  if (!url.startsWith("http://")) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return !(
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".localhost")
    );
  } catch {
    return false;
  }
}

const MAX_BLOB_CACHE_ENTRIES = 96;
type BlobCacheEntry = { src: string; refs: number; touchedAt: number };
const blobCache = new Map<string, BlobCacheEntry>();
const deadUrls = new Set<string>();
const inflight = new Map<string, Promise<string | null>>();
const thumbKeys = new Set<string>();
const cacheKeyFor = (url: string, thumbWidthPx?: number): string => `${thumbWidthPx ?? 0}\n${url}`;

function trimBlobCache(keepKey?: string): void {
  const evictable = [...blobCache.entries()]
    .filter(([key, entry]) => entry.refs === 0 && key !== keepKey)
    .sort((a, b) => a[1].touchedAt - b[1].touchedAt);
  for (const [key, entry] of evictable) {
    if (blobCache.size <= MAX_BLOB_CACHE_ENTRIES) break;
    blobCache.delete(key);
    thumbKeys.delete(key);
    URL.revokeObjectURL(entry.src);
  }
}
function retain(key: string): BlobCacheEntry | undefined {
  const entry = blobCache.get(key);
  if (entry) {
    entry.refs++;
    entry.touchedAt = Date.now();
  }
  return entry;
}
function release(key: string, entry: BlobCacheEntry): void {
  entry.refs = Math.max(0, entry.refs - 1);
  entry.touchedAt = Date.now();
  if (entry.refs === 0 && blobCache.get(key) !== entry) URL.revokeObjectURL(entry.src);
  trimBlobCache();
}
export async function clearThumbCache(): Promise<void> {
  for (const key of thumbKeys) {
    const entry = blobCache.get(key);
    blobCache.delete(key);
    if (entry?.refs === 0) URL.revokeObjectURL(entry.src);
  }
  thumbKeys.clear();
  await invoke("clear_thumb_cache");
}
export type ThumbCacheSize = { bytes: number; files: number };
export async function getThumbCacheSize(): Promise<ThumbCacheSize | null> {
  try {
    const size = await invoke<ThumbCacheSize>("thumb_cache_size");
    return size && typeof size.bytes === "number" && typeof size.files === "number" ? size : null;
  } catch {
    return null;
  }
}
function proxyImage(url: string, thumbWidthPx?: number): Promise<string | null> {
  const key = cacheKeyFor(url, thumbWidthPx);
  const cached = blobCache.get(key);
  if (cached) {
    cached.touchedAt = Date.now();
    return Promise.resolve(cached.src);
  }
  if (deadUrls.has(url)) return Promise.resolve(null);
  const pending = inflight.get(key);
  if (pending) return pending;
  const request = (async () => {
    try {
      const auth = suwayomiAuthFor(url);
      const resp = await invoke<HarborFetchResponse>("harbor_fetch", {
        args: {
          url,
          method: "GET",
          responseType: "base64",
          timeoutMs: 30000,
          headers: auth ? { authorization: auth } : undefined,
          allowLocalNetwork: Boolean(auth),
          thumbWidthPx,
        },
      });
      if (!resp.ok) throw new Error(`status ${resp.status}`);
      const type = resp.headers?.["content-type"] || resp.contentType || "image/jpeg";
      if (!type.startsWith("image/")) throw new Error(`type ${type}`);
      const src = URL.createObjectURL(new Blob([base64ToBytes(resp.body)], { type }));
      blobCache.set(key, { src, refs: 0, touchedAt: Date.now() });
      if (thumbWidthPx != null) thumbKeys.add(key);
      trimBlobCache(key);
      return src;
    } catch {
      deadUrls.add(url);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, request);
  return request;
}
export function useProxiedImageSrc(
  url: string | undefined,
  opts?: { forceProxy?: boolean },
): string | undefined {
  const need =
    !!url &&
    (opts?.forceProxy
      ? url.startsWith("http://") || url.startsWith("https://")
      : needsImageProxy(url));
  const { settings } = useSettings();
  const thumbWidthPx =
    settings.posterQuality === "max" ? undefined : settings.posterQuality === "high" ? 600 : 400;
  const [blob, setBlob] = useState<string | undefined>(() =>
    url && need ? blobCache.get(cacheKeyFor(url, thumbWidthPx))?.src : undefined,
  );
  const [failed, setFailed] = useState(() => !!url && need && deadUrls.has(url));
  useEffect(() => {
    setFailed(false);
    if (!url || !need) {
      setBlob(undefined);
      return;
    }
    const key = cacheKeyFor(url, thumbWidthPx);
    const cached = retain(key);
    if (cached) {
      setBlob(cached.src);
      return () => release(key, cached);
    }
    setBlob(undefined);
    if (deadUrls.has(url)) {
      setFailed(true);
      return;
    }
    let alive = true;
    let retained: BlobCacheEntry | undefined;
    void proxyImage(url, thumbWidthPx).then((src) => {
      if (!alive) {
        trimBlobCache();
        return;
      }
      retained = retain(key);
      if (src && retained) setBlob(src);
      else setFailed(true);
    });
    return () => {
      alive = false;
      if (retained) release(key, retained);
    };
  }, [url, need, thumbWidthPx]);
  return need ? (blob ?? (failed ? url : undefined)) : url;
}
