import { MAP_REGIONS } from "@/data/exploreMap";
import { pointInShape, shapeById, wrapLng } from "@/components/listen/regionGeometry";
import type { LivePlace } from "@/lib/live/types";

/**
 * Spatial helpers for averaging gridded data over a place.
 *
 * Method (standard area weighting, see xarray "area weighted temperature" example):
 *   mean = Σ wᵢ·xᵢ / Σ wᵢ,  wᵢ = cos(latᵢ) × (fraction of cell i inside the box)
 * Missing cells are skipped and their weights dropped.
 * Custom boxes use the overlap fraction, so a box smaller than one grid cell still gets the cell it sits in.
 * Named regions use the cells whose centres fall inside the region outline (continents use Natural Earth
 * coastlines; ocean basins use the app's approximate basin outlines).
 */

export interface Box {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

export interface GridSpec {
  /** Cell-centre latitudes. */
  readonly lats: readonly number[];
  /** Cell-centre longitudes (either −180…180 or 0…360). */
  readonly lons: readonly number[];
  readonly dLat: number;
  readonly dLon: number;
}

export interface WeightedCell {
  readonly i: number; // lat index
  readonly j: number; // lon index
  readonly w: number;
}

const RAD = Math.PI / 180;

/** Overlap length of [a0,a1] with [b0,b1] on a 360° circle (b may wrap, i.e. b0 > b1). */
function lonOverlap(a0: number, a1: number, b0: number, b1: number): number {
  const pieces: Array<[number, number]> = b0 <= b1 ? [[b0, b1]] : [[b0, 180], [-180, b1]];
  let total = 0;
  for (const [p0, p1] of pieces) {
    for (const shift of [-360, 0, 360]) {
      const lo = Math.max(a0 + shift, p0);
      const hi = Math.min(a1 + shift, p1);
      if (hi > lo) total += hi - lo;
    }
  }
  return total;
}

export function boxCells(grid: GridSpec, box: Box): WeightedCell[] {
  const cells: WeightedCell[] = [];
  const west = wrapLng(box.west);
  const east = wrapLng(box.east);
  const fullLon = box.east - box.west >= 359.9;
  for (let i = 0; i < grid.lats.length; i += 1) {
    const lat = grid.lats[i];
    const latLo = Math.max(lat - grid.dLat / 2, box.south);
    const latHi = Math.min(lat + grid.dLat / 2, box.north);
    if (latHi <= latLo) continue;
    const latFrac = (latHi - latLo) / grid.dLat;
    for (let j = 0; j < grid.lons.length; j += 1) {
      const lon = wrapLng(grid.lons[j]);
      const overlap = fullLon ? grid.dLon : lonOverlap(lon - grid.dLon / 2, lon + grid.dLon / 2, west, east);
      if (overlap <= 0) continue;
      cells.push({ i, j, w: Math.cos(lat * RAD) * latFrac * (overlap / grid.dLon) });
    }
  }
  return cells;
}

export function regionCells(grid: GridSpec, regionId: string): WeightedCell[] {
  const cells: WeightedCell[] = [];
  for (let i = 0; i < grid.lats.length; i += 1) {
    const lat = grid.lats[i];
    for (let j = 0; j < grid.lons.length; j += 1) {
      if (pointInShape(regionId, grid.lons[j], lat)) cells.push({ i, j, w: Math.cos(lat * RAD) });
    }
  }
  return cells;
}

export function placeCells(grid: GridSpec, place: LivePlace): WeightedCell[] {
  if (place.kind === "region" && place.regionId) {
    const cells = regionCells(grid, place.regionId);
    if (cells.length > 0) return cells;
  }
  return boxCells(grid, place);
}

/** Bounding box of a named region (dateline-crossing regions get the wrapped box). */
export function regionBox(regionId: string): Box {
  const shape = shapeById(regionId);
  if (!shape) return { west: -180, south: -90, east: 180, north: 90 };
  const lngs = shape.rings.flatMap((ring) => ring.map((point) => point[0]));
  const lats = shape.rings.flatMap((ring) => ring.map((point) => point[1]));
  return { west: Math.min(...lngs), south: Math.min(...lats), east: Math.max(...lngs), north: Math.max(...lats) };
}

export function regionPlace(regionId: string): LivePlace {
  const region = MAP_REGIONS.find((item) => item.id === regionId);
  return { kind: "region", regionId, name: region?.name ?? regionId, ...regionBox(regionId) };
}

export function boxCentre(box: Box): { lng: number; lat: number } {
  const span = box.west <= box.east ? box.east - box.west : box.east + 360 - box.west;
  return { lng: wrapLng(box.west + span / 2), lat: (box.south + box.north) / 2 };
}
