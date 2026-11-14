import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Tiny server-side cache: memory first, then a file under .cache/live-data, then the network.
 * If the network fails, a stale copy (memory or file) is returned and flagged, so callers can say "cached".
 */

const CACHE_DIR = path.join(process.cwd(), ".cache", "live-data");

interface Entry {
  readonly body: Buffer;
  readonly fetchedAt: number;
}

export interface CachedBody {
  readonly body: Buffer;
  readonly fetchedAt: number;
  /** True when the network call failed and an older copy was used. */
  readonly stale: boolean;
}

const memory = new Map<string, Entry>();
const inflight = new Map<string, Promise<CachedBody>>();

function fileFor(key: string): string {
  return path.join(CACHE_DIR, key.replace(/[^a-z0-9._-]+/gi, "_"));
}

async function readFileEntry(key: string): Promise<Entry | null> {
  try {
    const file = fileFor(key);
    const [body, info] = await Promise.all([readFile(file), stat(file)]);
    return { body, fetchedAt: info.mtimeMs };
  } catch {
    return null;
  }
}

export async function fetchWithTimeout(url: string, timeoutMs: number, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
      headers: { "User-Agent": "SonifySphere/0.1 (NASA Space Apps prototype)", ...(init?.headers ?? {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Get a URL body with caching. `ttlMs` is how long a copy counts as fresh.
 * Throws only when the network fails AND no copy exists anywhere.
 */
export async function cachedFetch(key: string, url: string, ttlMs: number, timeoutMs: number): Promise<CachedBody> {
  const now = Date.now();
  const hot = memory.get(key);
  if (hot && now - hot.fetchedAt < ttlMs) return { ...hot, stale: false };

  const running = inflight.get(key);
  if (running) return running;

  const job = (async (): Promise<CachedBody> => {
    const disk = hot ?? (await readFileEntry(key));
    if (disk && now - disk.fetchedAt < ttlMs) {
      memory.set(key, disk);
      return { ...disk, stale: false };
    }
    try {
      const response = await fetchWithTimeout(url, timeoutMs);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
      const body = Buffer.from(await response.arrayBuffer());
      const entry = { body, fetchedAt: Date.now() };
      memory.set(key, entry);
      await mkdir(CACHE_DIR, { recursive: true });
      await writeFile(fileFor(key), body).catch(() => undefined);
      return { ...entry, stale: false };
    } catch (error) {
      if (disk) {
        memory.set(key, disk);
        return { ...disk, stale: true };
      }
      throw error;
    }
  })();

  inflight.set(key, job);
  try {
    return await job;
  } finally {
    inflight.delete(key);
  }
}

export async function cachedText(key: string, url: string, ttlMs: number, timeoutMs: number) {
  const result = await cachedFetch(key, url, ttlMs, timeoutMs);
  return { ...result, text: result.body.toString("utf8") };
}

/** Small memo for derived values (parsed series etc.), keyed by the raw body's fetch time. */
const derived = new Map<string, { at: number; value: unknown }>();
export function memoDerived<T>(key: string, at: number, build: () => T): T {
  const hit = derived.get(key);
  if (hit && hit.at === at) return hit.value as T;
  const value = build();
  derived.set(key, { at, value });
  return value;
}

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
