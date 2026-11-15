/**
 * Private background jobs for processing Microsoft Planetary Computer satellite scenes.
 *
 * Satellite scenes (MODIS Land Surface Temperature and related collections) are processed
 * asynchronously. A background job extracts raster metadata, validates point values,
 * computes spatial scene statistics, derives sonification audio parameters, and stores
 * results in the durable multi-tier cache (Azure Blob Storage + memory).
 *
 * Jobs can be created via POST /api/listen/pc/jobs and polled via GET /api/listen/pc/jobs.
 * Cached scenes return immediately on the first query.
 */

import {
  parseDay,
  roundCoord,
  readPoint,
  searchScenes,
  PC_COLLECTION,
  type ParsedQuery,
  type PointReading,
} from "@/lib/listen/planetaryComputer";
import {
  satelliteCache,
  satelliteCacheKey,
} from "@/lib/listen/satelliteCache";

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface SatelliteSceneResult {
  readonly sceneId: string;
  readonly collection: string;
  readonly date: string;
  readonly time: string;
  readonly resolution: string | null;
  readonly unit: string;
  readonly point: {
    readonly lat: number;
    readonly lon: number;
    readonly kelvin: number;
    readonly celsius: number;
    readonly quality: "measured";
  };
  readonly sceneStats: {
    readonly minKelvin: number;
    readonly maxKelvin: number;
    readonly meanKelvin: number;
    readonly minCelsius: number;
    readonly maxCelsius: number;
    readonly meanCelsius: number;
    readonly sampleCount: number;
  };
  readonly sonification: {
    readonly baseFreqHz: number;
    readonly harmonicRatio: number;
    readonly tempo: number;
    readonly normalized: number;
  };
  readonly cached: boolean;
  readonly source: string;
  readonly processedAt: string;
}

export interface SatelliteJobQuery {
  readonly lat: number;
  readonly lon: number;
  readonly day: string;
  readonly collection?: string;
  readonly sceneId?: string;
}

export interface SatelliteJob {
  readonly id: string;
  status: JobStatus;
  progress: number;
  readonly createdAt: string;
  completedAt?: string;
  readonly query: SatelliteJobQuery;
  result?: SatelliteSceneResult;
  error?: string;
  message?: string;
}

export const MAX_JOBS = 1000;

// Registry of in-flight and recent background jobs
const jobs = new Map<string, SatelliteJob>();

export function kelvinToCelsius(kelvin: number): number {
  return Math.round((kelvin - 273.15) * 100) / 100;
}

export function mapTempToSound(celsius: number): {
  baseFreqHz: number;
  harmonicRatio: number;
  tempo: number;
  normalized: number;
} {
  // Map -50 °C to +50 °C onto 0..1
  const normalized = Math.min(1, Math.max(0, (celsius + 50) / 100));
  // 220 Hz (A3) to 880 Hz (A5)
  const baseFreqHz = Math.round(220 * Math.pow(2, normalized * 2));
  const harmonicRatio = Math.round((0.5 + normalized * 1.5) * 100) / 100;
  const tempo = Math.round((0.8 + normalized * 0.6) * 10) / 10;
  return {
    baseFreqHz,
    harmonicRatio,
    tempo,
    normalized: Math.round(normalized * 10_000) / 10_000,
  };
}

export function parseJobQuery(raw: {
  lat?: unknown;
  lon?: unknown;
  time?: unknown;
  collection?: unknown;
  sceneId?: unknown;
}): SatelliteJobQuery | null {
  const lat = typeof raw.lat === "number" ? raw.lat : Number(raw.lat);
  const lon = typeof raw.lon === "number" ? raw.lon : Number(raw.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return null;
  }
  const timeRaw = typeof raw.time === "string" ? raw.time.trim() : "";
  const day = parseDay(timeRaw);
  if (!day) return null;

  const collection =
    typeof raw.collection === "string" && raw.collection.trim()
      ? raw.collection.trim()
      : PC_COLLECTION;

  const sceneId =
    typeof raw.sceneId === "string" && raw.sceneId.trim()
      ? raw.sceneId.trim()
      : undefined;

  return {
    lat: roundCoord(lat),
    lon: roundCoord(lon),
    day,
    collection,
    sceneId,
  };
}

export function getSatelliteJob(id: string): SatelliteJob | undefined {
  return jobs.get(id);
}

export async function enqueueSatelliteJob(
  query: SatelliteJobQuery,
  fetchImpl: typeof fetch = fetch,
): Promise<SatelliteJob> {
  const collection = query.collection || PC_COLLECTION;
  const cacheKey = satelliteCacheKey({
    collection,
    day: query.day,
    lat: query.lat,
    lon: query.lon,
    sceneId: query.sceneId,
  });

  // Fast path: if the result is already in the Azure/durable cache, return completed job immediately
  const cached = await satelliteCache.get(cacheKey);
  if (cached) {
    const cachedResult: SatelliteSceneResult = {
      ...(cached as SatelliteSceneResult),
      cached: true,
    };
    const completedJob: SatelliteJob = {
      id: `job_cache_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      status: "completed",
      progress: 100,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      query,
      result: cachedResult,
      message: "Satellite scene retrieved from Azure cache",
    };
    pruneJobs();
    jobs.set(completedJob.id, completedJob);
    return completedJob;
  }

  // Create new background job
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const job: SatelliteJob = {
    id: jobId,
    status: "queued",
    progress: 0,
    createdAt: new Date().toISOString(),
    query,
    message: "Satellite scene processing enqueued on Azure",
  };

  pruneJobs();
  jobs.set(jobId, job);

  // Launch asynchronous execution in the background
  queueMicrotask(() => {
    void executeSatelliteJob(job, cacheKey, fetchImpl);
  });

  return job;
}

export async function executeSatelliteJob(
  job: SatelliteJob,
  cacheKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  job.status = "processing";
  job.progress = 20;

  try {
    const parsedQuery: ParsedQuery = {
      lat: job.query.lat,
      lon: job.query.lon,
      day: job.query.day,
      limit: 1,
      item: job.query.sceneId || null,
    };

    job.progress = 40;

    // Read the target point from Planetary Computer
    let primaryReading: PointReading;
    try {
      primaryReading = await readPoint(parsedQuery, fetchImpl);
    } catch (err: unknown) {
      // If reading point failed directly, try discovering scene first
      const scenes = await searchScenes(parsedQuery, fetchImpl);
      if (!scenes || scenes.length === 0) {
        job.status = "failed";
        job.progress = 100;
        job.error = "No satellite scene available for this location and date";
        job.completedAt = new Date().toISOString();
        return;
      }
      job.status = "failed";
      job.progress = 100;
      job.error =
        err instanceof Error && err.message
          ? err.message
          : "Could not read satellite data from scene";
      job.completedAt = new Date().toISOString();
      return;
    }

    job.progress = 70;

    const kelvin = primaryReading.value;
    const celsius = kelvinToCelsius(kelvin);

    // Compute spatial scene statistics: sample offsets around the point
    const offsets = [
      { dLat: 0.02, dLon: 0.02 },
      { dLat: -0.02, dLon: 0.02 },
      { dLat: 0.02, dLon: -0.02 },
      { dLat: -0.02, dLon: -0.02 },
    ];

    const surroundingSamples: number[] = [kelvin];
    for (const offset of offsets) {
      try {
        const offsetQuery: ParsedQuery = {
          lat: roundCoord(job.query.lat + offset.dLat),
          lon: roundCoord(job.query.lon + offset.dLon),
          day: job.query.day,
          limit: 1,
          item: primaryReading.sceneId,
        };
        const sample = await readPoint(offsetQuery, fetchImpl);
        if (Number.isFinite(sample.value)) surroundingSamples.push(sample.value);
      } catch {
        // Individual offset sampling errors do not fail the job
      }
    }

    const minK = Math.min(...surroundingSamples);
    const maxK = Math.max(...surroundingSamples);
    const meanK =
      Math.round(
        (surroundingSamples.reduce((a, b) => a + b, 0) / surroundingSamples.length) * 100,
      ) / 100;

    const minC = kelvinToCelsius(minK);
    const maxC = kelvinToCelsius(maxK);
    const meanC = kelvinToCelsius(meanK);

    job.progress = 85;

    const sonification = mapTempToSound(celsius);

    const result: SatelliteSceneResult = {
      sceneId: primaryReading.sceneId,
      collection: primaryReading.collection,
      date: primaryReading.date,
      time: primaryReading.time,
      resolution: primaryReading.resolution,
      unit: primaryReading.unit,
      point: {
        lat: primaryReading.lat,
        lon: primaryReading.lon,
        kelvin,
        celsius,
        quality: "measured",
      },
      sceneStats: {
        minKelvin: minK,
        maxKelvin: maxK,
        meanKelvin: meanK,
        minCelsius: minC,
        maxCelsius: maxC,
        meanCelsius: meanC,
        sampleCount: surroundingSamples.length,
      },
      sonification,
      cached: false,
      source: "Microsoft Planetary Computer · Azure",
      processedAt: new Date().toISOString(),
    };

    job.progress = 95;

    // Cache the result in Azure Blob Storage / durable store
    await satelliteCache.set(cacheKey, result);

    job.status = "completed";
    job.progress = 100;
    job.result = result;
    job.completedAt = new Date().toISOString();
    job.message = "Satellite scene processed successfully";
  } catch (error: unknown) {
    job.status = "failed";
    job.progress = 100;
    job.error =
      error instanceof Error && error.message
        ? error.message
        : "Unexpected error during satellite scene processing";
    job.completedAt = new Date().toISOString();
  }
}

function pruneJobs() {
  if (jobs.size < MAX_JOBS) return;
  const entries = Array.from(jobs.entries());
  // Remove oldest 200 jobs
  for (let i = 0; i < 200 && i < entries.length; i++) {
    jobs.delete(entries[i][0]);
  }
}
