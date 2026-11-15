/**
 * Multi-tier durable cache for Microsoft Planetary Computer satellite scenes and readings.
 *
 * Tier 1: In-memory LRU isolate cache (MeasurementCache) for instant responses on warm instances.
 * Tier 2: Azure Blob Storage when AZURE_STORAGE_CONNECTION_STRING or AZURE_STORAGE_CONTAINER_SAS_URL is configured.
 * Tier 3: HTTP Cache-Control headers for browser and CDN caching.
 *
 * When Azure credentials are not set, it operates gracefully with Tier 1 in-isolate cache.
 * Keys and logs never include credentials or SAS signatures.
 */

import { MeasurementCache, MEASUREMENT_PAST_TTL_MS } from "@/lib/listen/measurementCache";
import { createHmac } from "node:crypto";

export const SATELLITE_CONTAINER = "satellite-cache";
export const SATELLITE_CACHE_MAX_ENTRIES = 256;

export interface SatelliteCacheKeyInput {
  readonly collection: string;
  readonly day: string;
  readonly lat: number;
  readonly lon: number;
  readonly sceneId?: string;
}

export function satelliteCacheKey(input: SatelliteCacheKeyInput): string {
  const latStr = (Math.round(input.lat * 100) / 100).toFixed(2);
  const lonStr = (Math.round(input.lon * 100) / 100).toFixed(2);
  const scenePart = input.sceneId ? `|${input.sceneId}` : "";
  return `${input.collection}|${input.day}|${latStr}|${lonStr}${scenePart}`;
}

export function satelliteBlobName(key: string): string {
  // Convert cache key to a safe Azure blob path: e.g. collection/day/lat_lon.json
  const safe = key.replace(/[^A-Za-z0-9._-]/g, "_");
  return `${safe}.json`;
}

interface AzureParsedConfig {
  readonly accountName: string;
  readonly accountKey?: string;
  readonly endpointSuffix: string;
  readonly blobEndpoint?: string;
  readonly sasUrl?: string;
}

export function parseAzureStorageConfig(env = process.env): AzureParsedConfig | null {
  const sasUrl = env.AZURE_STORAGE_CONTAINER_SAS_URL || env.AZURE_BLOB_SAS_URL;
  if (sasUrl) {
    try {
      const url = new URL(sasUrl);
      const hostParts = url.hostname.split(".");
      const accountName = hostParts[0] || "unknown";
      return {
        accountName,
        endpointSuffix: hostParts.slice(2).join(".") || "core.windows.net",
        sasUrl,
      };
    } catch {
      return null;
    }
  }

  const connStr = env.AZURE_STORAGE_CONNECTION_STRING;
  if (connStr) {
    const parts = connStr.split(";").reduce<Record<string, string>>((acc, pair) => {
      const idx = pair.indexOf("=");
      if (idx > 0) {
        const k = pair.slice(0, idx).trim();
        const v = pair.slice(idx + 1).trim();
        acc[k] = v;
      }
      return acc;
    }, {});

    const accountName = parts.AccountName;
    const accountKey = parts.AccountKey;
    const endpointSuffix = parts.EndpointSuffix || "core.windows.net";
    const blobEndpoint = parts.BlobEndpoint;

    if (accountName && (accountKey || blobEndpoint)) {
      return { accountName, accountKey, endpointSuffix, blobEndpoint };
    }
  }

  const accountName = env.AZURE_STORAGE_ACCOUNT;
  const accountKey = env.AZURE_STORAGE_KEY;
  if (accountName && accountKey) {
    return { accountName, accountKey, endpointSuffix: "core.windows.net" };
  }

  return null;
}

export function buildSharedKeyAuthorization(
  accountName: string,
  accountKey: string,
  method: string,
  urlPath: string,
  headers: Record<string, string>,
): string {
  const canonicalizedHeaders = Object.keys(headers)
    .filter((k) => k.toLowerCase().startsWith("x-ms-"))
    .sort()
    .map((k) => `${k.toLowerCase()}:${headers[k]}`)
    .join("\n");

  const canonicalizedResource = `/${accountName}${urlPath}`;

  const stringToSign = [
    method.toUpperCase(),
    headers["Content-Encoding"] || "",
    headers["Content-Language"] || "",
    headers["Content-Length"] || "",
    headers["Content-MD5"] || "",
    headers["Content-Type"] || "",
    headers["Date"] || "",
    headers["If-Modified-Since"] || "",
    headers["If-Match"] || "",
    headers["If-None-Match"] || "",
    headers["If-Unmodified-Since"] || "",
    headers["Range"] || "",
    canonicalizedHeaders,
    canonicalizedResource,
  ].join("\n");

  const keyBuffer = Buffer.from(accountKey, "base64");
  const signature = createHmac("sha256", keyBuffer).update(stringToSign, "utf8").digest("base64");
  return `SharedKey ${accountName}:${signature}`;
}

export class SatelliteCache<T> {
  private readonly memoryCache = new MeasurementCache<T>(SATELLITE_CACHE_MAX_ENTRIES);

  constructor(
    private readonly getEnv: () => NodeJS.ProcessEnv = () => process.env,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async get(key: string): Promise<T | undefined> {
    const memoryHit = this.memoryCache.get(key);
    if (memoryHit !== undefined) return memoryHit;

    const azureConfig = parseAzureStorageConfig(this.getEnv());
    if (!azureConfig) return undefined;

    try {
      const blobName = satelliteBlobName(key);
      const result = await this.readAzureBlob(azureConfig, blobName);
      if (result !== undefined) {
        this.memoryCache.set(key, result, MEASUREMENT_PAST_TTL_MS);
        return result;
      }
    } catch {
      // Azure read error gracefully falls back without breaking the caller.
    }
    return undefined;
  }

  async set(key: string, value: T, ttlMs = MEASUREMENT_PAST_TTL_MS): Promise<void> {
    this.memoryCache.set(key, value, ttlMs);

    const azureConfig = parseAzureStorageConfig(this.getEnv());
    if (!azureConfig) return;

    try {
      const blobName = satelliteBlobName(key);
      await this.writeAzureBlob(azureConfig, blobName, value);
    } catch {
      // Azure write error gracefully ignored in serverless runtime.
    }
  }

  async getOrLoad(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const hit = await this.get(key);
    if (hit !== undefined) return hit;

    const loaded = await loader();
    await this.set(key, loaded, ttlMs);
    return loaded;
  }

  private async readAzureBlob(config: AzureParsedConfig, blobName: string): Promise<T | undefined> {
    let url: string;
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (config.sasUrl) {
      const parsedSas = new URL(config.sasUrl);
      const basePath = parsedSas.pathname.replace(/\/$/, "");
      url = `${parsedSas.origin}${basePath}/${encodeURIComponent(blobName)}${parsedSas.search}`;
    } else if (config.accountName && config.accountKey) {
      const endpoint = config.blobEndpoint || `https://${config.accountName}.blob.${config.endpointSuffix}`;
      url = `${endpoint}/${SATELLITE_CONTAINER}/${encodeURIComponent(blobName)}`;
      const now = new Date().toUTCString();
      headers["x-ms-date"] = now;
      headers["x-ms-version"] = "2023-11-03";
      headers["Authorization"] = buildSharedKeyAuthorization(
        config.accountName,
        config.accountKey,
        "GET",
        `/${SATELLITE_CONTAINER}/${encodeURIComponent(blobName)}`,
        headers,
      );
    } else {
      return undefined;
    }

    const response = await this.fetchImpl(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(8000),
    });

    if (response.status === 404) return undefined;
    if (!response.ok) return undefined;

    return (await response.json()) as T;
  }

  private async writeAzureBlob(config: AzureParsedConfig, blobName: string, value: T): Promise<void> {
    let url: string;
    const payload = JSON.stringify(value);
    const byteLength = Buffer.byteLength(payload, "utf8");
    const headers: Record<string, string> = {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": String(byteLength),
      "x-ms-blob-type": "BlockBlob",
    };

    if (config.sasUrl) {
      const parsedSas = new URL(config.sasUrl);
      const basePath = parsedSas.pathname.replace(/\/$/, "");
      url = `${parsedSas.origin}${basePath}/${encodeURIComponent(blobName)}${parsedSas.search}`;
    } else if (config.accountName && config.accountKey) {
      const endpoint = config.blobEndpoint || `https://${config.accountName}.blob.${config.endpointSuffix}`;
      url = `${endpoint}/${SATELLITE_CONTAINER}/${encodeURIComponent(blobName)}`;
      const now = new Date().toUTCString();
      headers["x-ms-date"] = now;
      headers["x-ms-version"] = "2023-11-03";
      headers["Authorization"] = buildSharedKeyAuthorization(
        config.accountName,
        config.accountKey,
        "PUT",
        `/${SATELLITE_CONTAINER}/${encodeURIComponent(blobName)}`,
        headers,
      );
    } else {
      return;
    }

    await this.fetchImpl(url, {
      method: "PUT",
      headers,
      body: payload,
      signal: AbortSignal.timeout(10000),
    });
  }
}

export const satelliteCache = new SatelliteCache();
