/**
 * Server-only NASA API key handling.
 * Import this from route handlers, never from a client component.
 * The key is appended to upstream requests and is never logged or returned.
 */

const DEMO_KEY = "DEMO_KEY";
/** Treat the hourly budget as nearly spent once this many calls remain. */
const LOW_REMAINING = 5;

export interface NasaRateLimit {
  readonly remaining: number | null;
  readonly limit: number | null;
}

let rate: NasaRateLimit = { remaining: null, limit: null };

function configuredKey(): string | null {
  const value = process.env.NASA_API_KEY?.trim() ?? "";
  if (!value || value === DEMO_KEY) return null;
  if (value.length < 8 || value.length > 128) return null;
  if (/[^\x21-\x7e]/.test(value)) return null;
  return value;
}

/** `NASA_API_KEY` when it is set to a usable value, otherwise `DEMO_KEY`. */
export function nasaApiKey(): string {
  return configuredKey() ?? DEMO_KEY;
}

export function isDemoNasaKey(): boolean {
  return nasaApiKey() === DEMO_KEY;
}

export function nasaRateLimit(): NasaRateLimit {
  return rate;
}

export function noteNasaRateLimit(response: Pick<Response, "headers" | "status">): void {
  const remainingHeader = parseCount(response.headers.get("x-ratelimit-remaining"));
  const limitHeader = parseCount(response.headers.get("x-ratelimit-limit"));
  const remaining = response.status === 429 ? 0 : remainingHeader;
  if (remaining === null && limitHeader === null) return;
  rate = {
    remaining: remaining ?? rate.remaining,
    limit: limitHeader ?? rate.limit,
  };
}

/** Demo key, or a real key whose remaining budget is low, should use a saved result before calling NASA. */
export function preferNasaCache(): boolean {
  if (isDemoNasaKey()) return true;
  return rate.remaining !== null && rate.remaining <= LOW_REMAINING;
}

export function nasaQuotaExhausted(): boolean {
  return rate.remaining === 0;
}

/** Strip `api_key` so a URL is safe to log or send to the browser. */
export function redactNasaUrl(value: string): string {
  return value.replace(/([?&#]api_key=)[^&#\s]*/gi, "$1");
}

export function resetNasaKeyStateForTests(): void {
  rate = { remaining: null, limit: null };
}

/**
 * GET an api.nasa.gov URL. The key is added here and is not part of `endpoint`.
 * Errors never include the key or the authed URL.
 */
export async function nasaGet(endpoint: URL, accept = "application/json"): Promise<Response> {
  const authed = new URL(endpoint.toString());
  authed.searchParams.set("api_key", nasaApiKey());
  try {
    const response = await fetch(authed, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: accept },
    });
    noteNasaRateLimit(response);
    return response;
  } catch (error) {
    const status = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError") ? 504 : 502;
    throw new NasaRequestError(status);
  }
}

export class NasaRequestError extends Error {
  readonly status: 502 | 504;

  constructor(status: 502 | 504) {
    super(status === 504 ? "The data service could not be reached" : "The data service could not be reached");
    this.name = "NasaRequestError";
    this.status = status;
  }
}

function parseCount(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const count = Number(value);
  return Number.isSafeInteger(count) ? count : null;
}
