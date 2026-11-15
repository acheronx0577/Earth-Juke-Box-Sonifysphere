/**
 * One official NASA Earth Information Center still, served from the
 * Scientific Visualization Studio. The browser receives a same-origin image
 * and the label "image-derived". It never receives the upstream file URL.
 */

export const EIC_PAGE_ID = "5101";
export const EIC_FRAME_FILE = "sst_mur_most_recent_print.jpg";
export const EIC_PAGE = "https://svs.gsfc.nasa.gov/5101/";
export const EIC_API = "https://svs.gsfc.nasa.gov/api/5101/";
export const EIC_SOURCE = "NASA Scientific Visualization Studio";
export const EIC_QUALITY = "image-derived" as const;
export const EIC_CREDIT = "NASA Scientific Visualization Studio · Earth Information Center";
export const EIC_ATTRIBUTION = "NASA Scientific Visualization Studio, Earth Information Center, visualization 5101.";
export const EIC_IMAGE_PATH = "/api/listen/eic/image";
export const FRAME_MAX_BYTES = 2_500_000;

const TIMEOUT_MS = 12_000;
const REVALIDATE_SECONDS = 24 * 60 * 60;
const FRAME_HOST = "svs.gsfc.nasa.gov";

export const NO_FRAME = "This Earth Information Center frame is not available.";
export const UNREACHABLE = "The data service could not be reached";
export const TOO_MANY = "Too many requests, try again in a minute";

export class ProviderError extends Error {
  readonly status: 404 | 429 | 502 | 504;

  constructor(status: 404 | 429 | 502 | 504, message: string) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
  }
}

export interface SelectedFrame {
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
  readonly title: string;
  readonly date: string;
  readonly time: string;
}

export interface PublicFrame {
  readonly source: typeof EIC_SOURCE;
  readonly id: typeof EIC_PAGE_ID;
  readonly title: string;
  readonly date: string;
  readonly time: string;
  readonly quality: typeof EIC_QUALITY;
  readonly label: typeof EIC_QUALITY;
  readonly image: typeof EIC_IMAGE_PATH;
  readonly page: typeof EIC_PAGE;
  readonly width: number;
  readonly height: number;
  readonly credit: typeof EIC_CREDIT;
  readonly attribution: typeof EIC_ATTRIBUTION;
  readonly license: typeof EIC_PAGE;
  readonly alt: string;
}

interface FrameCandidate {
  readonly url: string;
  readonly filename: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
}

export function allowedFrameUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.hostname !== FRAME_HOST) return null;
  if (!url.pathname.startsWith("/vis/") || (!url.pathname.endsWith(`/${EIC_FRAME_FILE}`) && !url.pathname.endsWith("/sst_mur_print.jpg"))) return null;
  // SVS publishes these file links as HTTP. The same host is requested over HTTPS.
  url.protocol = "https:";
  return url;
}

export function selectPrintFrame(page: unknown): SelectedFrame | null {
  if (!page || typeof page !== "object") return null;
  const record = page as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title.trim() : "";
  const release = typeof record.release_date === "string" ? Date.parse(record.release_date) : Number.NaN;
  const update = typeof record.update_date === "string" ? Date.parse(record.update_date) : Number.NaN;
  const dateTimestamp = !Number.isNaN(update) ? update : release;
  if (!title || Number.isNaN(dateTimestamp)) return null;
  const images: FrameCandidate[] = [];
  collectImages(page, images);
  const matches = images.filter((image) => {
    if (!allowedFrameUrl(image.url)) return false;
    const name = image.filename.split("/").pop();
    if (name !== EIC_FRAME_FILE && name !== "sst_mur_print.jpg") return false;
    return image.width >= 640 && image.width <= 1600 && image.height >= 200;
  });
  matches.sort((a, b) => {
    const aName = a.filename.split("/").pop();
    const bName = b.filename.split("/").pop();
    if (aName === EIC_FRAME_FILE && bName !== EIC_FRAME_FILE) return -1;
    if (bName === EIC_FRAME_FILE && aName !== EIC_FRAME_FILE) return 1;
    return Math.abs(a.width - 1024) - Math.abs(b.width - 1024) || a.width * a.height - b.width * b.height;
  });
  const chosen = matches[0];
  const url = chosen ? allowedFrameUrl(chosen.url) : null;
  if (!chosen || !url) return null;
  const time = new Date(dateTimestamp).toISOString();
  return {
    url: url.toString(),
    width: chosen.width,
    height: chosen.height,
    alt: chosen.alt || title,
    title,
    date: time.slice(0, 10),
    time,
  };
}

export function publicFrame(frame: SelectedFrame): PublicFrame {
  return {
    source: EIC_SOURCE,
    id: EIC_PAGE_ID,
    title: frame.title,
    date: frame.date,
    time: frame.time,
    quality: EIC_QUALITY,
    label: EIC_QUALITY,
    image: EIC_IMAGE_PATH,
    page: EIC_PAGE,
    width: frame.width,
    height: frame.height,
    credit: EIC_CREDIT,
    attribution: EIC_ATTRIBUTION,
    license: EIC_PAGE,
    alt: `${frame.title}. Image-derived, not a measurement.`,
  };
}

export async function loadPublicFrame(fetchImpl: typeof fetch = fetch): Promise<PublicFrame> {
  const frame = await loadSelectedFrame(fetchImpl);
  return publicFrame(frame);
}

export async function loadFrameBytes(fetchImpl: typeof fetch = fetch): Promise<{ bytes: Uint8Array; contentType: string }> {
  const frame = await loadSelectedFrame(fetchImpl);
  const response = await fetchAllowed(frame.url, fetchImpl, 0);
  const contentType = (response.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (!response.ok || (contentType !== "image/jpeg" && contentType !== "image/png")) {
    throw new ProviderError(502, UNREACHABLE);
  }
  const bytes = await readLimited(response, FRAME_MAX_BYTES);
  if (!bytes) throw new ProviderError(502, UNREACHABLE);
  return { bytes, contentType };
}

export function errorResult(error: unknown): { status: number; body: { error: string }; headers: HeadersInit } {
  const headers = { "Cache-Control": "no-store" };
  if (error instanceof ProviderError) {
    if (error.status === 404) return { status: 404, body: { error: NO_FRAME }, headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } };
    if (error.status === 429) return { status: 429, body: { error: TOO_MANY }, headers };
    if (error.status === 504) return { status: 504, body: { error: UNREACHABLE }, headers };
  }
  return { status: 502, body: { error: UNREACHABLE }, headers };
}

async function loadSelectedFrame(fetchImpl: typeof fetch): Promise<SelectedFrame> {
  const page = await fetchJson(EIC_API, fetchImpl);
  const frame = selectPrintFrame(page);
  if (!frame) throw new ProviderError(404, NO_FRAME);
  return frame;
}

async function fetchAllowed(url: string, fetchImpl: typeof fetch, redirects: number): Promise<Response> {
  if (!allowedFrameUrl(url)) throw new ProviderError(502, UNREACHABLE);
  let response: Response;
  try {
    response = await fetchImpl(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: REVALIDATE_SECONDS },
    });
  } catch (error) {
    if (isTimeout(error)) throw new ProviderError(504, UNREACHABLE);
    throw new ProviderError(502, UNREACHABLE);
  }
  if (response.status >= 300 && response.status < 400) {
    if (redirects >= 1) throw new ProviderError(502, UNREACHABLE);
    const location = response.headers.get("location");
    const next = location ? allowedFrameUrl(new URL(location, url).toString()) : null;
    if (!next) throw new ProviderError(502, UNREACHABLE);
    return fetchAllowed(next.toString(), fetchImpl, redirects + 1);
  }
  if (response.status === 404) throw new ProviderError(404, NO_FRAME);
  if (response.status === 429) throw new ProviderError(429, TOO_MANY);
  if (!response.ok) throw new ProviderError(502, UNREACHABLE);
  return response;
}

async function fetchJson(url: string, fetchImpl: typeof fetch): Promise<unknown> {
  const response = await fetchAllowedDocument(url, fetchImpl);
  try {
    return await response.json();
  } catch {
    throw new ProviderError(502, UNREACHABLE);
  }
}

async function fetchAllowedDocument(url: string, fetchImpl: typeof fetch): Promise<Response> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json" },
      next: { revalidate: REVALIDATE_SECONDS },
    });
  } catch (error) {
    if (isTimeout(error)) throw new ProviderError(504, UNREACHABLE);
    throw new ProviderError(502, UNREACHABLE);
  }
  if (response.status === 404) throw new ProviderError(404, NO_FRAME);
  if (response.status === 429) throw new ProviderError(429, TOO_MANY);
  if (!response.ok) throw new ProviderError(502, UNREACHABLE);
  const finalUrl = new URL(response.url || url);
  if (finalUrl.protocol !== "https:" || finalUrl.hostname !== FRAME_HOST) throw new ProviderError(502, UNREACHABLE);
  return response;
}

async function readLimited(response: Response, max: number): Promise<Uint8Array | null> {
  const declared = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > max) return null;
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return total > 32 ? bytes : null;
}

function collectImages(node: unknown, into: FrameCandidate[]) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectImages(item, into);
    return;
  }
  const record = node as Record<string, unknown>;
  if (record.media_type === "Image" && typeof record.url === "string") {
    into.push({
      url: record.url,
      filename: typeof record.filename === "string" ? record.filename : "",
      width: typeof record.width === "number" ? record.width : 0,
      height: typeof record.height === "number" ? record.height : 0,
      alt: typeof record.alt_text === "string" ? record.alt_text : "",
    });
  }
  for (const value of Object.values(record)) collectImages(value, into);
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}
